import { NextRequest, NextResponse } from "next/server"
import {
  createOpenAccount,
  getBusinessConfig,
  getOpenAccounts,
  type CreateOpenAccountInput,
  type OpenAccountStatus,
} from "@/lib/orders"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"

import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getRequestPassword(request: NextRequest) {
  return request.headers.get("x-local-password") || request.headers.get("x-admin-password") || ""
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 })
}

function forbiddenResponse(message = "Esta clave no tiene permiso para manejar cuentas abiertas") {
  return NextResponse.json({ error: message }, { status: 403 })
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: unauthorizedResponse(), role: null, roleLabel: "" }
  }

  if (!allowedRoles.includes(access.role)) {
    return { ok: false as const, response: forbiddenResponse(), role: access.role, roleLabel: access.roleLabel }
  }

  return { ok: true as const, response: null, role: access.role, roleLabel: access.roleLabel }
}

function getModuleUnavailableMessage(reason: "plan" | "owner") {
  if (reason === "plan") {
    return "Cuentas abiertas no está incluido en el plan activo. Solicita activación o sube el plan para usar esta función."
  }

  return "Cuentas abiertas está desactivado desde Configuración del negocio."
}

async function checkOpenAccountsModule() {
  const businessConfig = await getBusinessConfig()
  const moduleAccess = getModulePlanAccess(
    businessConfig as unknown as Record<string, unknown>,
    "openAccounts"
  )

  if (!moduleAccess.includedInPlan) {
    return { ok: false as const, response: forbiddenResponse(getModuleUnavailableMessage("plan")) }
  }

  if (!moduleAccess.effectiveEnabled) {
    return { ok: false as const, response: forbiddenResponse(getModuleUnavailableMessage("owner")) }
  }

  return { ok: true as const, response: null }
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function normalizeStatus(value: unknown): OpenAccountStatus | "all" | undefined {
  if (value === "Abierta" || value === "Cerrada" || value === "Cancelada" || value === "all") {
    return value
  }

  return undefined
}

function normalizeCreateInput(body: Record<string, unknown>, openedBy: string): CreateOpenAccountInput {
  const tableNumber = cleanText(body.tableNumber)
  const customerName = cleanText(body.customerName) || tableNumber

  if (!tableNumber) {
    throw new Error("Indica la mesa o ubicación para abrir la cuenta")
  }

  if (!customerName) {
    throw new Error("Indica el cliente o referencia de la cuenta")
  }

  return {
    tableNumber,
    customerName,
    customerPhone: cleanText(body.customerPhone),
    note: cleanText(body.note),
    openedBy,
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = checkRole(request, ["owner", "manager", "cashier", "waiter"])
    if (!access.ok) return access.response

    const moduleCheck = await checkOpenAccountsModule()
    if (!moduleCheck.ok) return moduleCheck.response

    const status = normalizeStatus(request.nextUrl.searchParams.get("status") || "Abierta")
    const openAccounts = await getOpenAccounts({ status }, await resolveBranchId(request))

    return NextResponse.json({
      ok: true,
      openAccounts,
      access: { role: access.role, roleLabel: access.roleLabel },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las cuentas abiertas" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-open-accounts-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de cuentas abiertas. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const access = checkRole(request, ["owner", "manager", "cashier", "waiter"])
    if (!access.ok) return access.response

    const moduleCheck = await checkOpenAccountsModule()
    if (!moduleCheck.ok) return moduleCheck.response

    const body = (await request.json()) as Record<string, unknown>
    const input = normalizeCreateInput(body, access.roleLabel || "Local")
    const openAccount = await createOpenAccount(input, await resolveBranchId(request))

    return NextResponse.json({ ok: true, openAccount }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo abrir la cuenta" },
      { status: 400 }
    )
  }
}
