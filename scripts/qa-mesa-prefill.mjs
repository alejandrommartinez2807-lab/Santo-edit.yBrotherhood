// QA 2026-07-28 · El pedido de MESA sin cuenta y su reporte de pago:
// ¿caja recibe por API todo lo que necesita para precargar "Registrar cobro"?
//
// La precarga en sí es de pantalla (createPaymentFormFromOrder, con tests de
// unidad propios). Esto verifica el CONTRATO que la alimenta:
//   M1 · un pedido de mesa se crea SIN método de pago (así es el checkout).
//   M2 · el cliente puede reportar su pago (el botón nuevo de la confirmación).
//   M3 · GET /api/payment-proofs devuelve ese comprobante con su método y su
//        monto, atado al pedido — que es de donde sale la precarga.
//
// Uso:  npm run qa:mesa-prefill      (dev server en :3177)
import {
  BRANCH_SAN_DIEGO,
  assertBrotherhood,
  check,
  cleanupRunOrders,
  get,
  postOrderThrottled,
  post,
  summary,
  supabase,
} from "./qa-lib.mjs"

const RUN = `ZZTEST-${Date.now()}`
const A = BRANCH_SAN_DIEGO
const RATE = 40

const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

await assertBrotherhood()
console.log(`Mesa sin cuenta · precarga del cobro · run=${RUN}\n`)

let restored = false
async function restore() {
  if (restored) return
  restored = true
  const { data: orders } = await supabase.from("orders").select("id").ilike("customer_name", "ZZTEST%")
  const ids = (orders || []).map((row) => row.id)
  if (ids.length) await supabase.from("payment_proofs").delete().in("order_id", ids)
  const { leftovers } = await cleanupRunOrders("ZZTEST")
  check("limpieza · 0 pedidos y 0 comprobantes de prueba", leftovers === 0, `quedan=${leftovers}`)
}

process.on("uncaughtException", async (error) => {
  console.error("\n✗ excepción:", error?.message)
  await restore()
  process.exit(1)
})

try {
  // ── M1 · pedido de mesa, sin método de pago (así lo manda el checkout)
  const { json, status } = await postOrderThrottled(
    {
      customerName: `${RUN}-MESA`,
      tableNumber: "Mesa 4",
      orderType: "Comer aquí",
      exchangeRate: RATE,
      items: [{ id: 999080, name: `${RUN}-BURGER`, price: 46.5, quantity: 1 }],
    },
    { "x-branch-id": A },
  )
  const order = json?.order
  check(
    "M1 · el pedido de mesa se crea sin exigir método de pago",
    (status === 200 || status === 201) && Boolean(order?.id),
    `status=${status}`,
  )

  const { data: row } = await supabase
    .from("orders")
    .select("payment_method, order_type, open_account_id")
    .eq("id", order.id)
    .maybeSingle()
  check(
    "M1 · queda SIN método elegido (por eso caja no tenía qué precargar)",
    !String(row?.payment_method || "").trim() && row?.order_type === "Comer aquí" && !row?.open_account_id,
    `payment_method="${row?.payment_method}" tipo=${row?.order_type} cuenta=${row?.open_account_id}`,
  )

  // ── M2 · el cliente reporta su pago desde la confirmación
  const montoVES = 46.5 * RATE
  const proof = await post(
    "/api/payment-proofs",
    {
      orderId: order.id,
      reportedMethod: `Pago móvil (Bs ${montoVES.toFixed(2)})`,
      amountReportedUSD: 0,
      amountReportedVES: montoVES,
      paymentReference: "998877665",
      dataUrl: PNG_1x1,
      fileName: "mesa.png",
      mimeType: "image/png",
    },
    { "x-branch-id": A },
  )
  check("M2 · el cliente de mesa puede reportar su pago", proof.status === 201 || proof.status === 200, `status=${proof.status}`)

  // ── M3 · caja recibe el comprobante con método y monto atados al pedido
  const proofs = (await get("/api/payment-proofs", { "x-branch-id": A })).json?.paymentProofs || []
  const mine = proofs.find((item) => item.orderId === order.id)
  check("M3 · el comprobante llega a caja atado a ESE pedido", Boolean(mine), `comprobantes=${proofs.length}`)
  check(
    "M3 · trae el método y el monto que precargan el modal (Pago móvil · Bs 1.860)",
    /pago m[oó]vil/i.test(String(mine?.reportedMethod || "")) &&
      Math.abs(Number(mine?.amountReportedVES || 0) - montoVES) < 0.01,
    `método="${mine?.reportedMethod}" Bs=${mine?.amountReportedVES}`,
  )
  check(
    "M3 · el comprobante está ACTIVO (los resueltos no precargan)",
    mine?.status === "Comprobante enviado" || mine?.status === "En revisión",
    `estado=${mine?.status}`,
  )
} finally {
  await restore()
}

process.exit(summary("Mesa sin cuenta · precarga del cobro") > 0 ? 1 : 0)
