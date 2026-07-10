import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getLocalAccessAuditActor, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { filterBranchesForAccess } from "@/lib/branch"
import {
  createStaffAccessConfig,
  getDisplayName,
  getDisplayUsername,
  getEffectiveStaffBranchAccess,
  getEffectiveStaffModules,
  getStaffUsersConfig,
  saveStaffUserAccessConfig,
} from "@/lib/staffUsers"
import {
  createInternalStaffEmail,
  normalizeStaffUsername,
} from "@/lib/staffIdentity"
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
  "promoter",
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
  if (!access.ok) {
    return { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }), access }
  }
  if (access.role !== "owner" && access.role !== "support") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Solo dueño o soporte pueden gestionar usuarios" }, { status: 403 }),
      access,
    }
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

function resolveCreateEmail(body: Record<string, unknown>) {
  const username = normalizeStaffUsername(body.username || body.user || body.email)
  const rawEmail = cleanText(body.email).toLowerCase()
  if (rawEmail && rawEmail.includes("@") && !body.username) return rawEmail
  return createInternalStaffEmail(username)
}

export async function GET(request: NextRequest) {
  const auth = requireStaffAdmin(request)
  if (!auth.ok) return auth.response

  const supabase = getSupabaseAdmin()
  const [{ data, error }, configUsers, branchesResponse] = await Promise.all([
    supabase
      .from("staff_users")
      .select("id, email, full_name, role, is_active, created_at")
      .order("created_at", { ascending: true }),
    getStaffUsersConfig(),
    supabase
      .from("branches")
      .select("id, name, is_active, sort_order")
      .order("sort_order", { ascending: true }),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const configById = new Map(configUsers.map((item) => [item.id, item]))
  const staff = (data ?? []).map((row) => {
    const item = row as {
      id: string
      email: string
      full_name: string
      role: LocalRole
      is_active: boolean
      created_at?: string
    }
    const staffConfig = configById.get(item.id) || null
    const branchAccess = getEffectiveStaffBranchAccess(item.role, staffConfig)
    const modules = getEffectiveStaffModules(item.role, staffConfig)

    return {
      ...item,
      username: getDisplayUsername(item.email, staffConfig),
      displayName: getDisplayName(item.full_name, staffConfig),
      full_name: getDisplayName(item.full_name, staffConfig),
      permissionsMode: staffConfig?.permissionsMode || "role",
      allowedModules: modules,
      allBranches: branchAccess.allBranches,
      allowedBranchIds: branchAccess.allowedBranchIds,
      lastAccessAt: staffConfig?.lastAccessAt || "",
    }
  })

  return NextResponse.json({
    ok: true,
    staff,
    branches: filterBranchesForAccess(branchesResponse.data ?? [], auth.access),
  })
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

  const auth = requireStaffAdmin(request)
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const username = normalizeStaffUsername(body.username || body.user || body.email)
  const email = resolveCreateEmail(body)
  const password = cleanText(body.password)
  const role = readRole(body.role)
  const fullName = cleanText(body.fullName || body.full_name || body.displayName)

  if (!username || !email || !password || !role) {
    return NextResponse.json({ error: "Faltan datos: usuario, contraseña y rol" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error) {
    return NextResponse.json(
      { error: created.error.message.replace(/^.*registered.*$/i, "Ese usuario ya tiene cuenta") },
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
    await supabase.auth.admin.deleteUser(created.data.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const staffConfig = createStaffAccessConfig({
    id: created.data.user.id,
    email,
    username,
    displayName: fullName,
    role,
    permissionsMode: body.permissionsMode,
    allowedModules: body.allowedModules,
    allBranches: body.allBranches,
    allowedBranchIds: body.allowedBranchIds,
  })
  await saveStaffUserAccessConfig(staffConfig)

  await writeAuditLog({
    action: "staff.created",
    entityType: "staff_user",
    entityId: created.data.user.id,
    actor: getLocalAccessAuditActor(auth.access),
    request,
    metadata: { username, role, fullName },
  })

  return NextResponse.json(
    {
      ok: true,
      staff: {
        id: created.data.user.id,
        email,
        username,
        full_name: fullName,
        displayName: fullName,
        role,
        is_active: true,
        permissionsMode: staffConfig.permissionsMode,
        allowedModules: getEffectiveStaffModules(role, staffConfig),
        allBranches: getEffectiveStaffBranchAccess(role, staffConfig).allBranches,
        allowedBranchIds: getEffectiveStaffBranchAccess(role, staffConfig).allowedBranchIds,
      },
    },
    { status: 201 },
  )
}
