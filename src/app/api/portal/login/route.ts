import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { signToken, hashCode } from "../_session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function digits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "")
}

// POST { phone, code } -> valida y devuelve token de sesión del residente.
export async function POST(request: NextRequest) {
  const guard = enforceApiMutationGuards(request, {
    id: "portal-login",
    limit: 20,
    windowMs: 60_000,
    maxBytes: 4_000,
    rateLimitMessage: "Demasiados intentos. Espera un momento.",
  })
  if (guard) return guard

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const phone = digits(body.phone)
    const code = String(body.code ?? "").trim()
    if (phone.length < 6 || code.length < 4) {
      return NextResponse.json({ error: "Escribe tu teléfono y tu código" }, { status: 400 })
    }
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "No disponible" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    // Buscar residentes del condominio y emparejar por dígitos del teléfono.
    const { data: residents, error } = await supabase
      .from("residents")
      .select("id, full_name, phone")
      .eq("branch_id", branchId)
      .eq("is_active", true)
    if (error) throw new Error(error.message)
    const match = (residents ?? []).find((r) => digits(r.phone) && digits(r.phone).endsWith(phone.slice(-8)))
    if (!match) {
      return NextResponse.json({ error: "No encontramos ese teléfono. Pídele el acceso a la administración." }, { status: 401 })
    }

    const { data: access } = await supabase
      .from("portal_access")
      .select("id, otp_hash, is_blocked")
      .eq("resident_id", match.id)
      .maybeSingle()

    if (!access || access.is_blocked || !access.otp_hash) {
      return NextResponse.json({ error: "Aún no tienes código de acceso. Pídeselo a la administración." }, { status: 401 })
    }
    if (access.otp_hash !== hashCode(code)) {
      return NextResponse.json({ error: "Código incorrecto." }, { status: 401 })
    }

    await supabase.from("portal_access").update({ last_login_at: new Date().toISOString() }).eq("id", access.id)

    return NextResponse.json({ ok: true, token: signToken(match.id), name: match.full_name })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo entrar" },
      { status: 500 },
    )
  }
}
