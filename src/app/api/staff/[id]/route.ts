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

// Evita dejar el negocio sin ningún dueño activo.
async function wouldRemoveLastOwner(targetId: string) {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from("staff_users")
    .select("id")
    .eq("role", "owner")
    .eq("is_active", true)
  const activeOwners = (data ?? []).map((r) => (r as { id: string }).id)
  return activeOwners.length <= 1 && activeOwners.includes(targetId)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-staff-patch",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de personal. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  const auth = requireOwner(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const supabase = getSupabaseAdmin()

  // Restablecer contraseña (el dueño fija una nueva para el usuario).
  if (body.password !== undefined) {
    const newPassword = cleanText(body.password)
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }
    const upd = await supabase.auth.admin.updateUserById(id, { password: newPassword })
    if (upd.error) {
      return NextResponse.json({ error: upd.error.message }, { status: 500 })
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.role !== undefined) {
    const role = cleanText(body.role) as LocalRole
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
    }
    if (role !== "owner" && (await wouldRemoveLastOwner(id))) {
      return NextResponse.json({ error: "No puedes quitar al último dueño activo" }, { status: 400 })
    }
    patch.role = role
  }

  if (body.is_active !== undefined) {
    const isActive = body.is_active === true
    if (!isActive && (await wouldRemoveLastOwner(id))) {
      return NextResponse.json({ error: "No puedes desactivar al último dueño activo" }, { status: 400 })
    }
    patch.is_active = isActive
  }

  if (body.full_name !== undefined) {
    patch.full_name = cleanText(body.full_name)
  }

  const { data, error } = await supabase
    .from("staff_users")
    .update(patch)
    .eq("id", id)
    .select("id, email, full_name, role, is_active")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, staff: data })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-staff-delete",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 128_000,
    rateLimitMessage: "Demasiados cambios de personal. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  const auth = requireOwner(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  if (await wouldRemoveLastOwner(id)) {
    return NextResponse.json({ error: "No puedes eliminar al último dueño activo" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  // Borra la fila de rol y el usuario de Auth (cascade también limpiaría la fila).
  await supabase.from("staff_users").delete().eq("id", id)
  const del = await supabase.auth.admin.deleteUser(id)
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
