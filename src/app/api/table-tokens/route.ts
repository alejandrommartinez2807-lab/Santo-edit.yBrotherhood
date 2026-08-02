import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import { canLocalAccessUseModule, getRequestAccess } from "@/lib/localAccess"
import { resolveBranchId } from "@/lib/branch"
import { getLocalTablesForBranch } from "@/lib/branchLocalTables"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import { isTableTokenEnabled, signTableToken } from "@/lib/tableAccessToken"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Tokens de mesa para los QR (auditoría 2026-08-02).
//
// El panel que imprime los QR corre en el navegador y no puede firmar nada: el
// secreto del negocio vive solo en el servidor. Esta ruta le devuelve, para la
// sede indicada, la firma de cada mesa, y con ella el panel arma los enlaces.
//
// Es PRIVADA a propósito: quien tenga estos tokens puede consultar el consumo
// de cualquier mesa, que es exactamente lo que se está cerrando. Solo entra
// quien puede ver el módulo de QR de mesas.

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-table-tokens-get",
    limit: 60,
    windowMs: 60_000,
  })

  if (rateLimitResponse) return rateLimitResponse

  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (!canLocalAccessUseModule(access, "qrTables")) {
    return NextResponse.json(
      { error: "Esta clave no tiene permiso para los QR de mesas" },
      { status: 403 },
    )
  }

  try {
    const branchId = await resolveBranchId(request)
    const config = (await getBusinessConfig()) as unknown as Record<string, unknown>
    const tables = await getLocalTablesForBranch(branchId, config.localTables)

    const tokens: Record<string, string> = {}

    for (const table of Array.isArray(tables) ? tables : []) {
      const name = String(
        (table as Record<string, unknown>)?.name ?? table ?? "",
      ).trim()
      if (!name) continue
      tokens[name] = signTableToken(name, branchId)
    }

    return NextResponse.json({
      ok: true,
      // false = el negocio no tiene ORDERS_API_SECRET y los QR salen sin token
      // (la consulta pública sigue comportándose como antes).
      enabled: isTableTokenEnabled(),
      branchId,
      tokens,
    })
  } catch (error) {
    captureError(error, { route: "/api/table-tokens", action: "GET" })

    return NextResponse.json(
      { error: "No se pudieron generar los códigos de las mesas" },
      { status: 500 },
    )
  }
}
