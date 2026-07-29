// Exportaciones "ricas" del historial de cierres: PDF (jsPDF + autotable) y
// Excel real .xlsx (SheetJS). Las librerías se cargan DINÁMICAMENTE al usarlas
// para no engordar el bundle del panel. Incluyen SEDE y el detalle de
// pedidos CANCELADOS (auditoría/pedido del dueño 2026-07-24).
import {
  getCloseNetAfterPurchasesUSD,
  getCloseNetEstimatedUSD,
  type SavedDayClose,
} from "@/app/local-santo/cierres/domain"

function money(value: number | undefined) {
  return `$${Number(value || 0).toFixed(2)}`
}

function fmtDate(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-VE", { timeZone: "America/Caracas" })
}

function summaryRows(close: SavedDayClose, branchName: string) {
  return [
    ["Sede", branchName || "—"],
    ["Fecha del cierre", fmtDate(close.createdAt)],
    ["Pedidos registrados", String(close.ordersRegistered ?? 0)],
    ["Pedidos entregados", String(close.deliveredOrders ?? 0)],
    ["Pedidos activos", String(close.activeOrders ?? 0)],
    ["Pedidos cancelados", String(close.canceledOrders ?? 0)],
    ["Total vendido", money(close.totalSoldUSD)],
    ["Cobrado real", money(close.realCollectedUSD)],
    ["Gastos", money(close.expensesTotalUSD)],
    // Con el fallback de la UI: los cierres viejos sin el campo guardado
    // exportaban "Neto $0.00" (auditoría 2026-07-24, P1 #15).
    ["Neto estimado", money(getCloseNetEstimatedUSD(close))],
    ["Neto después de compras", money(getCloseNetAfterPurchasesUSD(close))],
  ]
}

function orderRows(close: SavedDayClose) {
  return (close.orders || []).map((o) => [
    o.displayNumber || o.id,
    o.customerName || "",
    o.orderType || "",
    o.status || "",
    o.paymentStatus || "",
    money(o.totalUSD),
  ])
}

// Detalle 0036 (política 2026-07-29): origen, quién, dinero e insumos.
// Cierres viejos exportan las columnas nuevas vacías.
function canceledRows(close: SavedDayClose) {
  return (close.orders || [])
    .filter((o) => o.status === "Cancelado")
    .map((o) => [
      o.displayNumber || o.id,
      o.customerName || "",
      o.cancelReason || "(sin motivo)",
      o.cancelOrigin === "automatico"
        ? "Automática"
        : o.cancelOrigin === "cliente"
          ? "Cliente"
          : o.cancelOrigin === "personal"
            ? "Personal"
            : "",
      o.cancelledBy || "",
      o.receivedEquivalentUSD > 0
        ? o.cancelRefund === "se_quedo"
          ? `Se quedó en caja (${money(o.receivedEquivalentUSD)})`
          : `Devuelto (${money(o.receivedEquivalentUSD)})`
        : "Sin cobrar",
      o.cancelInventoryUsed === true
        ? "Consumidos"
        : o.cancelInventoryUsed === false
          ? "Devueltos al stock"
          : "",
      money(o.totalUSD),
    ])
}

const CANCELED_HEADER = [
  "#",
  "Cliente",
  "Motivo",
  "Origen",
  "Quién anuló",
  "Dinero",
  "Insumos",
  "Total",
]

function safeName(base: string) {
  return base.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60)
}

// ---------- PDF de un cierre ----------
export async function exportCloseToPdf(close: SavedDayClose, branchName: string) {
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default
  const doc = new jsPDF({ unit: "pt", format: "a4" })

  doc.setFontSize(16)
  doc.text("Cierre de caja", 40, 42)
  doc.setFontSize(10)
  doc.text(`${branchName || ""}  ·  ${fmtDate(close.createdAt)}`, 40, 60)

  autoTable(doc, {
    startY: 78,
    head: [["Resumen", ""]],
    body: summaryRows(close, branchName),
    theme: "grid",
    headStyles: { fillColor: [245, 166, 35] },
    styles: { fontSize: 9 },
  })

  const canceled = canceledRows(close)
  if (canceled.length > 0) {
    autoTable(doc, {
      // @ts-expect-error lastAutoTable lo agrega el plugin
      startY: (doc.lastAutoTable?.finalY || 200) + 18,
      head: [["Pedidos CANCELADOS del día (no cuentan como venta)", "", "", "", "", "", "", ""]],
      body: [CANCELED_HEADER, ...canceled],
      theme: "grid",
      headStyles: { fillColor: [200, 40, 40] },
      styles: { fontSize: 8 },
    })
  }

  autoTable(doc, {
    // @ts-expect-error lastAutoTable lo agrega el plugin
    startY: (doc.lastAutoTable?.finalY || 260) + 18,
    head: [["#", "Cliente", "Tipo", "Estado", "Pago", "Total"]],
    body: orderRows(close),
    theme: "striped",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 8 },
  })

  doc.save(`cierre-${safeName(branchName)}-${safeName(fmtDate(close.createdAt))}.pdf`)
}

// ---------- Excel real (.xlsx) de un cierre ----------
export async function exportCloseToXlsx(close: SavedDayClose, branchName: string) {
  const XLSX = await import("xlsx")
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Campo", "Valor"], ...summaryRows(close, branchName)]),
    "Resumen",
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["#", "Cliente", "Tipo", "Estado", "Pago", "Total"],
      ...orderRows(close),
    ]),
    "Pedidos",
  )
  const canceled = canceledRows(close)
  if (canceled.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([CANCELED_HEADER, ...canceled]),
      "Cancelados",
    )
  }
  XLSX.writeFile(wb, `cierre-${safeName(branchName)}-${safeName(fmtDate(close.createdAt))}.xlsx`)
}

// ---------- Excel real de TODO el historial filtrado (con columna de sede) ----------
export async function exportDayClosesToXlsx(
  closes: SavedDayClose[],
  branchNameOf: (branchId?: string) => string,
) {
  const XLSX = await import("xlsx")
  const rows = [
    [
      "Sede", "Fecha", "Registrados", "Entregados", "Activos", "Cancelados",
      "Total vendido", "Cobrado", "Gastos", "Neto",
    ],
    ...closes.map((c) => [
      branchNameOf(c.branchId),
      fmtDate(c.createdAt),
      c.ordersRegistered ?? 0,
      c.deliveredOrders ?? 0,
      c.activeOrders ?? 0,
      c.canceledOrders ?? 0,
      Number(c.totalSoldUSD || 0),
      Number(c.realCollectedUSD || 0),
      Number(c.expensesTotalUSD || 0),
      // Mismo fallback que la UI (cierres viejos exportaban Neto 0).
      Number(getCloseNetEstimatedUSD(c) || 0),
    ]),
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Cierres")
  XLSX.writeFile(wb, `historial-cierres-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
