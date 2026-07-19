import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DOCS_BUCKET = "documents"
function text(v: unknown) { return String(v ?? "").trim() }

export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, documents: [] })
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from("documents").select("*").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(100)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, documents: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin condominio" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    if (text(body.kind) === "delete") {
      const { error } = await supabase.from("documents").delete().eq("id", text(body.id)).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    const title = text(body.title)
    if (!title) return NextResponse.json({ error: "Escribe el título" }, { status: 400 })
    let url = text(body.url)
    let fileName = text(body.fileName)
    const dataUrl = String(body.dataUrl ?? "")
    if (!url && dataUrl.startsWith("data:")) {
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!m) return NextResponse.json({ error: "Archivo no soportado" }, { status: 400 })
      const buffer = Buffer.from(m[2], "base64")
      if (buffer.length > 12_000_000) return NextResponse.json({ error: "El archivo supera 12 MB" }, { status: 400 })
      await supabase.storage.createBucket(DOCS_BUCKET, { public: true }).catch(() => undefined)
      const ext = (fileName.split(".").pop() || "pdf").toLowerCase()
      const path = `${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from(DOCS_BUCKET).upload(path, buffer, { contentType: m[1], upsert: true })
      if (up.error) throw new Error(up.error.message)
      url = supabase.storage.from(DOCS_BUCKET).getPublicUrl(path).data.publicUrl
      if (!fileName) fileName = path
    }
    if (!url) return NextResponse.json({ error: "Falta el archivo o URL" }, { status: 400 })

    const { data, error } = await supabase.from("documents").insert({
      branch_id: branchId, title, category: text(body.category) || "general", description: text(body.description),
      file_url: url, file_name: fileName, visibility: text(body.visibility) || "residentes", uploaded_by: "admin",
    }).select().maybeSingle()
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, document: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}
