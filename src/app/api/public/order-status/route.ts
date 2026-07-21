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
      .select("id,status,seq,branch_seq,branch_code,customer_note")
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
    const branchSeq = Number(data.branch_seq || 0)
    const branchCode = String(data.branch_code || "").trim()
    const displayNumber =
      branchSeq > 0
        ? `#${String(branchSeq).padStart(2, "0")}${branchCode ? `-${branchCode}` : ""}`
        : seq > 0
          ? `#${String(seq).padStart(2, "0")}`
          : ""
    const rawStatus = String(data.status || "").trim()
    const status = PUBLIC_STATUSES.has(rawStatus) ? rawStatus : "Pendiente"

    // Contenido del pedido (nombre, cantidad y personalización): el cliente
    // que guarda el link quiere ver QUÉ pidió, no solo el estado. Mismo modelo
    // de confianza del resto de la respuesta: id imprevisible, sin datos
    // personales (ni teléfono ni dirección).
    const { data: itemRows } = await supabase
      .from("order_items")
      .select("name,quantity,price,selection_summary,sort_order")
      .eq("order_id", orderId)
      .order("sort_order", { ascending: true })

    const items = (itemRows ?? []).map((raw) => {
      const item = raw as Record<string, unknown>
      const quantity = Number(item.quantity || 0)
      const price = Number(item.price || 0)
      return {
        name: String(item.name || "").trim() || "Producto",
        quantity,
        selectionSummary: String(item.selection_summary || "").trim(),
        subtotalUSD: Math.round((price * quantity + Number.EPSILON) * 100) / 100,
      }
    })

    // Pedido anulado: el motivo se guarda en la nota como "ANULADO: …"; se
    // extrae SOLO ese tramo (sin el resto de la nota) para mostrárselo al
    // cliente en su seguimiento.
    const cancelMatch =
      status === "Cancelado"
        ? String(data.customer_note || "").match(/ANULADO:\s*([^|]+)/)
        : null
    const cancelReason = cancelMatch ? cancelMatch[1].trim() : ""

    return noStoreResponse({
      ok: true,
      orderId: String(data.id || orderId),
      displayNumber,
      status,
      items,
      ...(cancelReason ? { cancelReason } : {}),
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
