import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../../_auth"
import { generateCode, hashCode } from "../../../portal/_session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST { residentId } -> genera un código de acceso para el residente y
// devuelve el código EN CLARO una sola vez (para que la administración se lo
// entregue). En la BD solo queda el hash.
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const residentId = String(body.residentId ?? "").trim()
    if (!residentId) return NextResponse.json({ error: "Falta el residente" }, { status: 400 })
    const branchId = await resolveBranchId(request)
    const supabase = getSupabaseAdmin()

    const code = generateCode()
    const row = {
      branch_id: branchId,
      resident_id: residentId,
      channel: "whatsapp",
      otp_hash: hashCode(code),
      otp_expires_at: null,
      is_blocked: false,
    }
    const { data: existing } = await supabase
      .from("portal_access")
      .select("id")
      .eq("resident_id", residentId)
      .maybeSingle()
    if (existing) {
      const { error } = await supabase.from("portal_access").update(row).eq("id", existing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from("portal_access").insert(row)
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ ok: true, code })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el código" },
      { status: 500 },
    )
  }
}
