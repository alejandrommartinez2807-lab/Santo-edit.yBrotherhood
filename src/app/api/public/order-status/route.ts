import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Estados que el cliente puede ver en su confirmación. Cualquier otro valor
// de la BD se colapsa a "Pendiente" para no filtrar estados internos nuevos.
const PUBLIC_STATUSES = new Set(["Nuevo", "Pendiente", "Preparando", "Listo", "Entregado", "Cancelado"])

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)

  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")

  return NextResponse.json(data, {
    ...init,
    headers,
  })
}

// Estado público de UN pedido: el cliente lo consulta desde su pantalla de
// confirmación con el id que recibió al pedir (ord-..., imprevisible). Solo
// devuelve estado + número visible; nada de datos personales ni montos.
export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-order-status-get",
    limit: 90,
    windowMs: 60_000,
    message: "Demasiadas consultas de pedido. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const orderId = String(request.nextUrl.searchParams.get("pedido") || "")
      .trim()
      .toLowerCase()

    if (!orderId || !orderId.startsWith("ord-")) {
      return noStoreResponse(
        { ok: false, error: "Indica el pedido que quieres consultar" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    // branch-exempt: lookup puntual por id único e imprevisible (ord-...);
    // el pedido pertenece a una sola sede y no expone datos de otras.
    const { data, error } = await supabase
      .from("orders")
      .select("id,status,seq")
      .eq("id", orderId)
      .maybeSingle()

    if (error) throw new Error(error.message)

    if (!data) {
      return noStoreResponse(
        { ok: false, error: "Pedido no encontrado" },
        { status: 404 }
      )
    }

    const seq = Number(data.seq || 0)
    const rawStatus = String(data.status || "").trim()
    const status = PUBLIC_STATUSES.has(rawStatus) ? rawStatus : "Pendiente"

    return noStoreResponse({
      ok: true,
      orderId: String(data.id || orderId),
      displayNumber: seq > 0 ? `#${String(seq).padStart(2, "0")}` : "",
      status,
    })
  } catch (error) {
    captureError(error, { route: "/api/public/order-status", action: "GET" })

    return noStoreResponse(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo consultar el estado del pedido",
      },
      { status: 500 }
    )
  }
}
