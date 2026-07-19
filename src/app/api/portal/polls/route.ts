import { NextRequest, NextResponse } from "next/server"
import { getPortalResident } from "../_resident"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }

// GET (Bearer): votaciones abiertas + opciones + si ya voté (por mi unidad).
export async function GET(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  const [polls, opts, myVotes] = await Promise.all([
    ctx.supabase.from("polls").select("id, question, description, weighting, status").eq("branch_id", ctx.branchId).eq("status", "abierta").order("created_at", { ascending: false }),
    ctx.supabase.from("poll_options").select("id, poll_id, label, sort_order").eq("branch_id", ctx.branchId).order("sort_order"),
    ctx.supabase.from("votes").select("poll_id, option_id").in("unit_id", ctx.unitIds.length ? ctx.unitIds : ["_none_"]),
  ])
  const votedBy: Record<string, string> = {}
  for (const v of (myVotes.data ?? []) as { poll_id: string; option_id: string }[]) votedBy[v.poll_id] = v.option_id
  const options = (opts.data ?? []) as { id: string; poll_id: string; label: string }[]
  const list = ((polls.data ?? []) as { id: string }[]).map((p) => ({ ...p, options: options.filter((o) => o.poll_id === p.id), myVote: votedBy[p.id] || null }))
  return NextResponse.json({ ok: true, polls: list })
}

// POST (Bearer): votar. Peso = alícuota de mi unidad (o 1 si un_voto_por_unidad).
export async function POST(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const pollId = text(body.pollId)
    const optionId = text(body.optionId)
    const link = ctx.links.find((l) => l.can_vote) || ctx.links[0]
    if (!link) return NextResponse.json({ error: "No tienes una unidad para votar" }, { status: 400 })
    const { data: poll } = await ctx.supabase.from("polls").select("id, weighting, status").eq("id", pollId).eq("branch_id", ctx.branchId).maybeSingle()
    if (!poll || poll.status !== "abierta") return NextResponse.json({ error: "La votación no está abierta" }, { status: 409 })
    const weight = poll.weighting === "un_voto_por_unidad" ? 1 : Number(link.units?.alicuota || 0)
    const { error } = await ctx.supabase.from("votes").insert({ branch_id: ctx.branchId, poll_id: pollId, option_id: optionId, unit_id: link.unit_id, resident_id: ctx.residentId, weight })
    if (error) {
      if (String(error.message).toLowerCase().includes("duplicate")) return NextResponse.json({ error: "Tu unidad ya votó" }, { status: 409 })
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo votar" }, { status: 500 })
  }
}
