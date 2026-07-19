import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }

type PollOption = { id: string; poll_id: string; label: string; sort_order: number; votes?: number; weight?: number }

export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, assemblies: [], polls: [] })
    const supabase = getSupabaseAdmin()
    const [asm, polls, opts, votes] = await Promise.all([
      supabase.from("assemblies").select("*").eq("branch_id", branchId).order("created_at", { ascending: false }),
      supabase.from("polls").select("*").eq("branch_id", branchId).order("created_at", { ascending: false }),
      supabase.from("poll_options").select("id, poll_id, label, sort_order").eq("branch_id", branchId).order("sort_order"),
      supabase.from("votes").select("poll_id, option_id, weight").eq("branch_id", branchId),
    ])
    if (polls.error) throw new Error(polls.error.message)
    const tally: Record<string, { votes: number; weight: number }> = {}
    for (const v of (votes.data ?? []) as { option_id: string; weight: number }[]) {
      const t = (tally[v.option_id] ||= { votes: 0, weight: 0 })
      t.votes += 1; t.weight += Number(v.weight || 0)
    }
    const options = ((opts.data ?? []) as PollOption[]).map((o) => ({ ...o, votes: tally[o.id]?.votes || 0, weight: Math.round((tally[o.id]?.weight || 0) * 1e6) / 1e6 }))
    const pollsWithOpts = ((polls.data ?? []) as Record<string, unknown>[]).map((p) => ({ ...p, options: options.filter((o) => o.poll_id === p.id) }))
    return NextResponse.json({ ok: true, assemblies: asm.data ?? [], polls: pollsWithOpts })
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
    const kind = text(body.kind)

    if (kind === "assembly") {
      const title = text(body.title)
      if (!title) return NextResponse.json({ error: "Escribe el título" }, { status: 400 })
      const { data, error } = await supabase.from("assemblies").insert({ branch_id: branchId, title, type: text(body.type) || "ordinaria", status: "convocada", scheduled_at: text(body.scheduledAt) || null, location: text(body.location), created_by: "admin" }).select().maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, assembly: data }, { status: 201 })
    }

    if (kind === "poll") {
      const question = text(body.question)
      const options = Array.isArray(body.options) ? (body.options as unknown[]).map(text).filter(Boolean) : []
      if (!question || options.length < 2) return NextResponse.json({ error: "Escribe la pregunta y al menos 2 opciones" }, { status: 400 })
      const { data: poll, error } = await supabase.from("polls").insert({ branch_id: branchId, assembly_id: text(body.assemblyId) || null, question, weighting: text(body.weighting) || "alicuota", type: "single", status: "abierta", opens_at: new Date().toISOString(), created_by: "admin" }).select("id").maybeSingle()
      if (error) throw new Error(error.message)
      const rows = options.map((label, i) => ({ branch_id: branchId, poll_id: poll!.id, label, sort_order: i }))
      const { error: oe } = await supabase.from("poll_options").insert(rows)
      if (oe) throw new Error(oe.message)
      return NextResponse.json({ ok: true, pollId: poll!.id }, { status: 201 })
    }

    if (kind === "pollStatus") {
      const status = text(body.status) === "abierta" ? "abierta" : "cerrada"
      const patch: Record<string, unknown> = { status }
      if (status === "cerrada") patch.closes_at = new Date().toISOString()
      const { error } = await supabase.from("polls").update(patch).eq("id", text(body.pollId)).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}
