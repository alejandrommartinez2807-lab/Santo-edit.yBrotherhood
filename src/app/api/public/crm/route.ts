import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }

const KINDS = new Set(["reclamo", "sugerencia", "consulta", "objeto_perdido", "solicitud_local", "propuesta_proveedor", "otro"])

// POST: el público envía un caso (reclamo, sugerencia, objeto perdido, etc.).
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: false, error: "No disponible" }, { status: 400 })

    const name = text(body.customerName)
    const message = text(body.message)
    if (!name || !message) return NextResponse.json({ ok: false, error: "Escribe tu nombre y el mensaje" }, { status: 400 })
    if (message.length > 4000) return NextResponse.json({ ok: false, error: "Mensaje demasiado largo" }, { status: 400 })

    const kind = text(body.kind)
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from("crm_cases").insert({
      branch_id: branchId,
      kind: KINDS.has(kind) ? kind : "consulta",
      subject: text(body.subject).slice(0, 200),
      message,
      customer_name: name.slice(0, 160),
      customer_phone: text(body.customerPhone).slice(0, 40),
      customer_email: text(body.customerEmail).slice(0, 160),
      channel: "web",
      status: "nuevo",
      priority: "media",
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}
