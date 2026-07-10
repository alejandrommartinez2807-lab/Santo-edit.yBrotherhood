import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getLocalAccessAuditActor, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import {
  createStaffAccessConfig,
  getDisplayName,
  getDisplayUsername,
  getEffectiveStaffBranchAccess,
  getEffectiveStaffModules,
  getEmailForUsername,
  getStaffUserAccessConfig,
  saveStaffUserAccessConfig,
} from "@/lib/staffUsers"
import { normalizeStaffUsername } from "@/lib/staffIdentity"
import { writeAuditLog } from "@/lib/audit"

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

function requireStaffAdmin(request: NextRequest) {
  const access = getRequestAccess(request, getRequestPassword(request))
  if (!access.ok) return { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }), access }
  if (access.role !== "owner" && access.role !== "support") {
    return { ok: false as const, response: NextResponse.json({ error: "Solo dueño o soporte pueden gestionar usuarios" }, { status: 403 }), access }
  }
  return { ok: true as const, response: null, access }
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function readRole(value: unknown): LocalRole | null {
  const role = cleanText(value) as LocalRole
  return ASSIGNABLE_ROLES.includes(role) ? role : null
}

async function getStaffRow(id: string) {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from("staff_users")
    .select("id, email, full_name, role, is_active")
    .eq("id", id)
    .maybeSingle()
  return data as { id: string; email: string; full_name: string; role: LocalRole; is_active: boolean } | null
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

  const auth = requireStaffAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const supabase = getSupabaseAdmin()
  const current = await getStaffRow(id)

  if (!current) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  // Un empleado no puede autoconcederse más permisos, aunque su rol quede mal configurado.
  if (auth.access.ok && auth.access.staffId === id && auth.access.role !== "owner") {
    return NextResponse.json({ error: "No puedes editar tus propios permisos" }, { status: 403 })
  }

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
  let nextRole = current.role
  let nextFullName = current.full_name
  let nextEmail = current.email
  const existingConfig = await getStaffUserAccessConfig(id)

  if (body.role !== undefined) {
    const role = readRole(body.role)
    if (!role) return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
    if (role !== "owner" && (await wouldRemoveLastOwner(id))) {
      return NextResponse.json({ error: "No puedes quitar al último dueño activo" }, { status: 400 })
    }
    patch.role = role
    nextRole = role
  }

  if (body.is_active !== undefined) {
    const isActive = body.is_active === true
    if (!isActive && (await wouldRemoveLastOwner(id))) {
      return NextResponse.json({ error: "No puedes desactivar al último dueño activo" }, { status: 400 })
    }
    patch.is_active = isActive
  }

  if (body.fullName !== undefined || body.full_name !== undefined || body.displayName !== undefined) {
    nextFullName = cleanText(body.fullName || body.full_name || body.displayName)
    patch.full_name = nextFullName
  }

  if (body.username !== undefined || body.user !== undefined) {
    const username = normalizeStaffUsername(body.username || body.user)
    if (!username) return NextResponse.json({ error: "Usuario inválido" }, { status: 400 })
    nextEmail = getEmailForUsername(username)
    const authUpdate = await supabase.auth.admin.updateUserById(id, {
      email: nextEmail,
      email_confirm: true,
    })
    if (authUpdate.error) {
      return NextResponse.json({ error: authUpdate.error.message }, { status: 400 })
    }
    patch.email = nextEmail
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

  const saved = data as { id: string; email: string; full_name: string; role: LocalRole; is_active: boolean }
  const shouldUpdateAccessConfig = [
    "username",
    "user",
    "fullName",
    "full_name",
    "displayName",
    "role",
    "permissionsMode",
    "allowedModules",
    "allBranches",
    "allowedBranchIds",
  ].some((key) => Object.prototype.hasOwnProperty.call(body, key))

  let staffConfig = existingConfig
  if (shouldUpdateAccessConfig) {
    staffConfig = createStaffAccessConfig({
      id,
      email: saved.email,
      username: body.username ?? body.user ?? existingConfig?.username ?? getDisplayUsername(saved.email, existingConfig),
      displayName: body.fullName ?? body.full_name ?? body.displayName ?? existingConfig?.displayName ?? saved.full_name,
      role: nextRole,
      permissionsMode: body.permissionsMode ?? existingConfig?.permissionsMode ?? "role",
      allowedModules: body.allowedModules ?? existingConfig?.allowedModules ?? [],
      allBranches: body.allBranches ?? existingConfig?.allBranches ?? false,
      allowedBranchIds: body.allowedBranchIds ?? existingConfig?.allowedBranchIds ?? [],
    })
    await saveStaffUserAccessConfig(staffConfig)
  }

  const branchAccess = getEffectiveStaffBranchAccess(saved.role, staffConfig)

  await writeAuditLog({
    action: "staff.updated",
    entityType: "staff_user",
    entityId: id,
    actor: getLocalAccessAuditActor(auth.access),
    request,
    metadata: { changedKeys: Object.keys(body), role: saved.role, isActive: saved.is_active },
  })

  return NextResponse.json({
    ok: true,
    staff: {
      ...saved,
      username: getDisplayUsername(saved.email, staffConfig),
      displayName: getDisplayName(saved.full_name, staffConfig),
      full_name: getDisplayName(saved.full_name, staffConfig),
      permissionsMode: staffConfig?.permissionsMode || "role",
      allowedModules: getEffectiveStaffModules(saved.role, staffConfig),
      allBranches: branchAccess.allBranches,
      allowedBranchIds: branchAccess.allowedBranchIds,
      lastAccessAt: staffConfig?.lastAccessAt || "",
    },
  })
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

  const auth = requireStaffAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  if (await wouldRemoveLastOwner(id)) {
    return NextResponse.json({ error: "No puedes desactivar al último dueño activo" }, { status: 400 })
  }

  // Por seguridad operativa no borramos usuarios con posible historial: se desactivan.
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from("staff_users")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    action: "staff.deleted",
    entityType: "staff_user",
    entityId: id,
    actor: getLocalAccessAuditActor(auth.access),
    request,
    metadata: { deactivated: true },
  })

  return NextResponse.json({ ok: true, deactivated: true })
}
