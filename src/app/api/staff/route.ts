import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"

import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ASSIGNABLE_ROLES: LocalRole[] = [
  "owner",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "delivery",
  "support",
]

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

// Solo el dueño gestiona usuarios.
function requireOwner(request: NextRequest) {
  const access = getRequestAccess(request, getRequestPassword(request))
  if (!access.ok) {
    return { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  }
  if (access.role !== "owner") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Solo el dueño puede gestionar usuarios" }, { status: 403 }),
    }
  }
  return { ok: true as const, response: null }
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

export async function GET(request: NextRequest) {
  const auth = requireOwner(request)
  if (!auth.ok) return auth.response

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("staff_users")
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, staff: data ?? [] })
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-staff-post",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de personal. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  const auth = requireOwner(request)
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const email = cleanText(body.email).toLowerCase()
  const password = cleanText(body.password)
  const role = cleanText(body.role) as LocalRole
  const fullName = cleanText(body.fullName)

  if (!email || !password || !role) {
    return NextResponse.json({ error: "Faltan datos: correo, contraseña y rol" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error) {
    return NextResponse.json(
      { error: created.error.message.replace(/^.*registered.*$/i, "Ese correo ya tiene cuenta") },
      { status: 400 },
    )
  }

  const { error: insertError } = await supabase.from("staff_users").insert({
    id: created.data.user.id,
    email,
    full_name: fullName,
    role,
    is_active: true,
  })
  if (insertError) {
    // Revertir el usuario de Auth si no se pudo guardar el rol
    await supabase.auth.admin.deleteUser(created.data.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(
    { ok: true, staff: { id: created.data.user.id, email, full_name: fullName, role, is_active: true } },
    { status: 201 },
  )
}
