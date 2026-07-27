// QA ronda 2026-07-27 · F1-A: el LOTE DE PAGOS del 26 de julio, ejercitado
// contra la API real (13 commits, casi todos sobre dinero).
// Lo que se ataca: confirmar dos comprobantes A LA VEZ (33bebbe), la 2ª pata
// del mixto (8b3524f), dónde viven de verdad las validaciones del reporte de
// pago (cbc0122 y el lote de evidencia por pata), el apagado de "En revisión"
// al cobrar en caja, y el seguimiento del pedido nuevo (918e326).
//
// Uso:  npm run qa:payments      (dev server en :3177)
import {
  BASE,
  BRANCH_SAN_DIEGO,
  BRANCH_VINEDO,
  assertBrotherhood,
  check,
  get,
  patch,
  post,
  postOrderThrottled,
  summary,
  supabase,
} from "./qa-lib.mjs"

const RUN = `ZZTEST-${Date.now()}`
const A = BRANCH_SAN_DIEGO
const RATE = 40

// PNG 1x1 válido (el servidor valida mime y que el base64 sea múltiplo de 4).
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

const publicPost = (path, body, branchId = A) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-branch-id": branchId },
    body: JSON.stringify(body),
  })

const publicGet = (path, branchId = A) =>
  fetch(`${BASE}${path}`, { headers: { "x-branch-id": branchId } }).then((r) => r.json())

async function createOrder({ total, paymentMethod, orderType = "Para llevar", tag = "PED", phone = "04140000002" }) {
  const { json, status } = await postOrderThrottled(
    {
      customerName: `${RUN}-${tag}`,
      customerPhone: phone,
      tableNumber: orderType === "Delivery" ? "delivery" : "Mesa 2",
      orderType,
      exchangeRate: RATE,
      paymentMethod,
      ...(orderType === "Delivery"
        ? { deliveryAddress: "ZZTEST calle de prueba 123", deliveryZone: "San Diego" }
        : {}),
      items: [{ id: 999003, name: `${RUN}-ITEM`, price: total, quantity: 1 }],
    },
    { "x-branch-id": A },
  )
  return { order: json?.order, status, json }
}

// El POST público de comprobantes tiene freno de 10/120s por IP: los scripts
// mandan muchos más. Espera la ventana en vez de dar un falso FALLO.
async function sendProof(body, branchId = A, tries = 5) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const res = await publicPost("/api/payment-proofs", body, branchId)
    if (res.status !== 429) return res
    const retryAfter = Number(res.headers.get("retry-after")) || 30
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 125) * 1000 + 500))
  }
  return { status: 429 }
}

async function proofsOf(orderId) {
  const { json } = await get(`/api/payment-proofs?orderId=${encodeURIComponent(orderId)}`, { "x-branch-id": A })
  return json?.paymentProofs || []
}

async function orderRow(id) {
  const { data } = await supabase
    .from("orders")
    .select("id, amount_received_usd, amount_received_ves, payment_status, payment_method, payment_received_equiv_usd, status")
    .eq("id", id)
    .maybeSingle()
  return data
}

const review = (proofId, body) =>
  patch(`/api/payment-proofs/${proofId}/review`, body, { "x-branch-id": A })

await assertBrotherhood()
console.log(`F1-A · lote de pagos contra ${BASE}\nrun=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// P1 · CONFIRMAR DOS COMPROBANTES A LA VEZ (33bebbe)
// El pedido tiene que quedar con la SUMA, no con uno solo.
// ───────────────────────────────────────────────────────────────────────────
console.log("── P1 · dos comprobantes confirmados a la vez")
{
  // Mixto: $5 en Zelle + Bs 1.400 (=$35) → total $40.
  const { order } = await createOrder({
    total: 40,
    paymentMethod: `Mixto: Pago móvil Bs 1.400,00 + Zelle $5.00`,
    tag: "P1",
  })
  check("P1 setup · pedido mixto de $40", Boolean(order?.id), `id=${order?.id}`)

  if (order?.id) {
    const legVES = await sendProof({
      orderId: order.id,
      customerPhone: "04140000002",
      reportedMethod: "Pago móvil (Bs 1.400,00)",
      amountReportedUSD: 0,
      amountReportedVES: 1400,
      paymentReference: "004512789",
      dataUrl: PNG_1x1,
      fileName: "pm.png",
      mimeType: "image/png",
    })
    const legUSD = await sendProof({
      orderId: order.id,
      customerPhone: "04140000002",
      reportedMethod: "Zelle ($5.00)",
      amountReportedUSD: 5,
      amountReportedVES: 0,
      paymentReference: "998877661",
      dataUrl: PNG_1x1,
      fileName: "zelle.png",
      mimeType: "image/png",
    })
    check("P1 · las dos patas se aceptan como comprobantes separados", legVES.status === 201 && legUSD.status === 201, `VES=${legVES.status} USD=${legUSD.status}`)

    const proofs = await proofsOf(order.id)
    check("P1 · el pedido tiene 2 filas de comprobante (una por pata)", proofs.length === 2, `filas=${proofs.length}`)

    // Las dos confirmaciones, disparadas EN PARALELO desde dos "pestañas".
    const [r1, r2] = await Promise.all([
      review(proofs[0]?.id, { status: "Confirmado por caja", registerPayment: true }),
      review(proofs[1]?.id, { status: "Confirmado por caja", registerPayment: true }),
    ])
    const registered = [r1, r2].filter((r) => r.json?.paymentRegistered === true).length
    const row = await orderRow(order.id)
    const equiv = Number(row?.payment_received_equiv_usd || 0)

    check("P1 · las dos confirmaciones responden 200", r1.status === 200 && r2.status === 200, `${r1.status}/${r2.status}`)
    check(
      "P1 · el cobro queda con la SUMA de las dos patas ($5 + Bs1400/40 = $40)",
      Math.abs(equiv - 40) < 0.05,
      `equivalente=${equiv} USD=${row?.amount_received_usd} VES=${row?.amount_received_ves} · registradas=${registered} · motivos=${[r1, r2].map((r) => r.json?.paymentSkippedReason).filter(Boolean).join(" | ")}`,
    )
    check("P1 · el pedido queda Pagado", row?.payment_status === "Pagado", `estado=${row?.payment_status}`)

    // Reconfirmar el mismo comprobante no puede volver a sumar.
    const again = await review(proofs[0]?.id, { status: "Confirmado por caja", registerPayment: true })
    const rowAgain = await orderRow(order.id)
    check(
      "P1 · reconfirmar el MISMO comprobante no duplica el dinero",
      Math.abs(Number(rowAgain?.payment_received_equiv_usd || 0) - equiv) < 0.02,
      `antes=${equiv} después=${rowAgain?.payment_received_equiv_usd} · motivo="${again.json?.paymentSkippedReason || ""}"`,
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// P2 · LA 2ª PATA NO OBLIGA A CUADRAR A MANO (8b3524f), Y NO SE PASA DEL TOTAL
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── P2 · la 2ª pata suma sobre el cobro existente")
{
  const { order } = await createOrder({
    total: 40,
    paymentMethod: "Mixto: Pago móvil Bs 1.400,00 + Zelle $5.00",
    tag: "P2",
  })
  if (order?.id) {
    const leg1 = await sendProof({
      orderId: order.id,
      reportedMethod: "Zelle ($5.00)",
      amountReportedUSD: 5,
      amountReportedVES: 0,
      paymentReference: "111222333",
      dataUrl: PNG_1x1,
      fileName: "a.png",
      mimeType: "image/png",
    })
    const proofs1 = await proofsOf(order.id)
    await review(proofs1[0]?.id, { status: "Confirmado por caja", registerPayment: true })
    const mid = await orderRow(order.id)
    check("P2 · la 1ª pata deja $5 cobrados y el pedido parcial", Math.abs(Number(mid?.amount_received_usd || 0) - 5) < 0.02, `USD=${mid?.amount_received_usd} estado=${mid?.payment_status}`)

    const leg2 = await sendProof({
      orderId: order.id,
      reportedMethod: "Pago móvil (Bs 1.400,00)",
      amountReportedUSD: 0,
      amountReportedVES: 1400,
      paymentReference: "444555666",
      dataUrl: PNG_1x1,
      fileName: "b.png",
      mimeType: "image/png",
    })
    check("P2 · la 2ª pata se acepta aunque ya haya un cobro registrado", leg2.status === 201, `status=${leg2.status} ${JSON.stringify(leg2 && (await leg2.clone?.().json?.().catch(() => null))) || ""}`)

    const proofs2 = await proofsOf(order.id)
    const second = proofs2.find((p) => p.id !== proofs1[0]?.id)
    const r = await review(second?.id, { status: "Confirmado por caja", registerPayment: true })
    const after = await orderRow(order.id)
    check(
      "P2 · la 2ª pata SUMA sin obligar a cuadrar a mano",
      r.json?.paymentRegistered === true && Math.abs(Number(after?.payment_received_equiv_usd || 0) - 40) < 0.05,
      `equivalente=${after?.payment_received_equiv_usd} registrado=${r.json?.paymentRegistered} motivo="${r.json?.paymentSkippedReason || ""}"`,
    )

    // Una tercera pata que se pase del total tiene que rebotar.
    const extra = await sendProof({
      orderId: order.id,
      reportedMethod: "Zelle ($30.00)",
      amountReportedUSD: 30,
      amountReportedVES: 0,
      paymentReference: "777888999",
      dataUrl: PNG_1x1,
      fileName: "c.png",
      mimeType: "image/png",
      confirmDuplicate: true,
    })
    if (extra.status === 201) {
      const proofs3 = await proofsOf(order.id)
      const third = proofs3.find((p) => p.paymentReference === "777888999")
      const r3 = await review(third?.id, { status: "Confirmado por caja", registerPayment: true })
      const final = await orderRow(order.id)
      check(
        "P2 · un comprobante que dejaría el pedido con MÁS dinero del que vale se rechaza",
        r3.json?.paymentRegistered === false && Math.abs(Number(final?.payment_received_equiv_usd || 0) - 40) < 0.05,
        `equivalente=${final?.payment_received_equiv_usd} motivo="${r3.json?.paymentSkippedReason || ""}"`,
      )
    } else {
      check("P2 · el 3er comprobante que se pasa del total ni siquiera se acepta", extra.status === 409, `status=${extra.status}`)
    }
    void leg1
  }
}

// ───────────────────────────────────────────────────────────────────────────
// P3 · ¿DÓNDE VIVEN LAS VALIDACIONES DEL REPORTE DE PAGO?
// El lote endureció el formulario. Aquí se comprueba qué pasa cuando el
// request NO viene del formulario (un cliente pegando el endpoint).
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── P3 · las validaciones del formulario contra la API pelada")
{
  const { order } = await createOrder({ total: 20, paymentMethod: "Pago móvil", tag: "P3" })
  if (order?.id) {
    // Referencia de 4 dígitos (el formulario exige 6) y sin captura.
    const shortRef = await sendProof({
      orderId: order.id,
      reportedMethod: "Pago móvil (Bs 800,00)",
      amountReportedUSD: 0,
      amountReportedVES: 800,
      paymentReference: "4821",
    })
    check(
      "P3 · la API rechaza una referencia de 4 dígitos (el formulario exige 6)",
      shortRef.status >= 400,
      `status=${shortRef.status} · si acepta, la regla de los 6 dígitos vive SOLO en el navegador`,
    )

    // Sin captura y sin referencia: esto sí lo valida el servidor.
    const naked = await sendProof({
      orderId: order.id,
      reportedMethod: "Pago móvil (Bs 800,00)",
      amountReportedUSD: 0,
      amountReportedVES: 800,
      confirmDuplicate: true,
    })
    check("P3 · sin captura NI referencia la API rechaza (400)", naked.status === 400, `status=${naked.status}`)

    // Método único: basta captura O referencia (no debe haberse endurecido).
    const onlyPhoto = await sendProof({
      orderId: order.id,
      reportedMethod: "Pago móvil (Bs 800,00)",
      amountReportedUSD: 0,
      amountReportedVES: 800,
      dataUrl: PNG_1x1,
      fileName: "solo-foto.png",
      mimeType: "image/png",
      confirmDuplicate: true,
    })
    check("P3 · método único: con SOLO la captura se puede reportar", onlyPhoto.status === 201, `status=${onlyPhoto.status}`)
  }

  // Efectivo en divisas sin foto del billete (cbc0122).
  const { order: cashOrder } = await createOrder({
    total: 15,
    paymentMethod: "Efectivo en divisas",
    orderType: "Delivery",
    tag: "P3-CASH",
    phone: "04140000003",
  })
  if (cashOrder?.id) {
    const status = await publicGet(`/api/public/order-status?pedido=${cashOrder.id}`)
    check(
      "P3 · el pedido 100% efectivo NO queda pidiendo reporte electrónico (ad0e0bb)",
      status?.payment?.reportable === false,
      `expected=${status?.payment?.expected} reportable=${status?.payment?.reportable} pendiente=${status?.payment?.pendingReportUSD}`,
    )
    const { data: row } = await supabase.from("orders").select("payment_method").eq("id", cashOrder.id).maybeSingle()
    check(
      "P3 · el pedido en efectivo se creó SIN foto del billete por la API",
      Boolean(row?.payment_method),
      `método="${row?.payment_method}" · la exigencia de la foto (cbc0122) es del checkout, no del servidor`,
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// P4 · "EN REVISIÓN" SE APAGA AL COBRAR EN CAJA (cbc0122)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── P4 · 'En revisión' se apaga al cobrar en caja")
{
  const { order } = await createOrder({ total: 25, paymentMethod: "Pago móvil", tag: "P4" })
  if (order?.id) {
    await sendProof({
      orderId: order.id,
      reportedMethod: "Pago móvil (Bs 1.000,00)",
      amountReportedUSD: 0,
      amountReportedVES: 1000,
      paymentReference: "123456789",
      dataUrl: PNG_1x1,
      fileName: "p4.png",
      mimeType: "image/png",
    })
    const proofs = await proofsOf(order.id)
    await review(proofs[0]?.id, { status: "En revisión" })

    const before = await publicGet(`/api/public/order-status?pedido=${order.id}`)
    check("P4 · antes de cobrar, el cliente ve el pago SIN confirmar", before?.payment?.confirmed === false, `confirmed=${before?.payment?.confirmed}`)

    // Caja cobra directo (sin tocar el comprobante).
    const charge = await patch(
      `/api/orders/${order.id}/payment`,
      { amountReceivedUSD: 25, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas", paymentNote: `${RUN} cobro en caja` },
      { "x-branch-id": A },
    )
    const after = await publicGet(`/api/public/order-status?pedido=${order.id}`)
    const proofsAfter = await proofsOf(order.id)
    check("P4 · el cobro en caja responde 200", charge.status === 200, `status=${charge.status}`)
    check(
      "P4 · tras cobrar en caja, el cliente ya ve el pago confirmado ('En revisión' se apaga solo)",
      after?.payment?.confirmed === true,
      `confirmed=${after?.payment?.confirmed} · el comprobante en BD sigue en "${proofsAfter[0]?.status}"`,
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// P5 · SEGUIMIENTO DEL PEDIDO NUEVO (918e326)
// Dos pedidos del mismo teléfono, el viejo cancelado: el nuevo debe estar limpio.
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── P5 · el pedido nuevo no arrastra el 'cancelado' del viejo")
{
  const phone = "04140000009"
  const { order: oldOrder } = await createOrder({ total: 12, paymentMethod: "Pago móvil", tag: "P5-VIEJO", phone })
  const cancel = await patch(
    `/api/orders/${oldOrder?.id}`,
    { status: "Cancelado", cancelReason: "QA ronda 2026-07-27: pedido viejo del seguimiento" },
    { "x-branch-id": A },
  )
  const { order: newOrder } = await createOrder({ total: 18, paymentMethod: "Pago móvil", tag: "P5-NUEVO", phone })

  const oldStatus = await publicGet(`/api/public/order-status?pedido=${oldOrder?.id}`)
  const newStatus = await publicGet(`/api/public/order-status?pedido=${newOrder?.id}`)

  check("P5 setup · el viejo quedó cancelado", cancel.status === 200 && oldStatus?.status === "Cancelado", `status=${oldStatus?.status}`)
  check(
    "P5 · el seguimiento del pedido NUEVO está limpio (ni cancelado ni el número viejo)",
    newStatus?.status !== "Cancelado" && !newStatus?.cancelReason && newStatus?.orderId === newOrder?.id,
    `estado=${newStatus?.status} motivo=${newStatus?.cancelReason || "—"} id=${newStatus?.orderId}`,
  )
  check("P5 · cada pedido trae su propio número de display", oldStatus?.displayNumber !== newStatus?.displayNumber, `viejo=${oldStatus?.displayNumber} nuevo=${newStatus?.displayNumber}`)
}

// ───────────────────────────────────────────────────────────────────────────
// P6 · EL "LISTO" DEL DELIVERY (c3f40fe) Y EL DEL PICK UP
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── P6 · el 'Listo' del delivery vs el del pick up")
{
  const { order: del } = await createOrder({ total: 14, paymentMethod: "Pago móvil", orderType: "Delivery", tag: "P6-DEL", phone: "04140000004" })
  const { order: pick } = await createOrder({ total: 14, paymentMethod: "Pago móvil", orderType: "Para llevar", tag: "P6-PICK" })

  await patch(`/api/orders/${del?.id}`, { status: "Listo" }, { "x-branch-id": A })
  await patch(`/api/orders/${pick?.id}`, { status: "Listo" }, { "x-branch-id": A })

  const sDel = await publicGet(`/api/public/order-status?pedido=${del?.id}`)
  const sPick = await publicGet(`/api/public/order-status?pedido=${pick?.id}`)

  check("P6 · los dos quedan en Listo", sDel?.status === "Listo" && sPick?.status === "Listo", `${sDel?.status}/${sPick?.status}`)
  check(
    "P6 · la API distingue el tipo para que el texto del Listo cambie",
    sDel?.orderType === "Delivery" && sPick?.orderType === "Para llevar",
    `delivery=${sDel?.orderType} pickup=${sPick?.orderType} · el texto lo pinta el cliente con este campo`,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// P7 · AISLAMIENTO DE COMPROBANTES ENTRE SEDES
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── P7 · los comprobantes de A no se ven ni se confirman desde B")
{
  const { order } = await createOrder({ total: 10, paymentMethod: "Pago móvil", tag: "P7" })
  if (order?.id) {
    await sendProof({
      orderId: order.id,
      reportedMethod: "Pago móvil (Bs 400,00)",
      amountReportedUSD: 0,
      amountReportedVES: 400,
      paymentReference: "555444333",
      dataUrl: PNG_1x1,
      fileName: "p7.png",
      mimeType: "image/png",
    })
    const proofs = await proofsOf(order.id)
    const proofId = proofs[0]?.id

    const fromB = await get(`/api/payment-proofs?orderId=${encodeURIComponent(order.id)}`, { "x-branch-id": BRANCH_VINEDO })
    check("P7 · caja de B no ve el comprobante de A", ((fromB.json?.paymentProofs || []).length === 0), `filas vistas desde B=${(fromB.json?.paymentProofs || []).length}`)

    const reviewFromB = await patch(`/api/payment-proofs/${proofId}/review`, { status: "Confirmado por caja", registerPayment: true }, { "x-branch-id": BRANCH_VINEDO })
    const row = await orderRow(order.id)
    check(
      "P7 · caja de B no puede confirmar (ni cobrar) el comprobante de A",
      Number(row?.payment_received_equiv_usd || 0) === 0,
      `status=${reviewFromB.status} cobrado=${row?.payment_received_equiv_usd}`,
    )

    // Y un comprobante para un pedido de A mandado con la sede B en el header.
    const crossProof = await sendProof({
      orderId: order.id,
      reportedMethod: "Zelle ($10.00)",
      amountReportedUSD: 10,
      amountReportedVES: 0,
      paymentReference: "000111222",
      dataUrl: PNG_1x1,
      fileName: "cross.png",
      mimeType: "image/png",
      confirmDuplicate: true,
    }, BRANCH_VINEDO)
    check("P7 · no se puede adjuntar un comprobante a un pedido de otra sede", crossProof.status === 404, `status=${crossProof.status}`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// LIMPIEZA
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── limpieza")
{
  const { data: orders } = await supabase.from("orders").select("id").ilike("customer_name", `${RUN}%`)
  const ids = (orders || []).map((o) => o.id)
  if (ids.length) {
    await supabase.from("payment_proofs").delete().in("order_id", ids)
    await supabase.from("order_items").delete().in("order_id", ids)
    await supabase.from("orders").delete().in("id", ids)
  }
  const { data: leftovers } = await supabase.from("orders").select("id").ilike("customer_name", "ZZTEST%")
  const { data: leftoverProofs } = await supabase.from("payment_proofs").select("id").in("order_id", ids.length ? ids : ["-"])
  check(
    "limpieza · 0 pedidos y 0 comprobantes ZZTEST sueltos",
    (leftovers?.length ?? 0) === 0 && (leftoverProofs?.length ?? 0) === 0,
    `borrados=${ids.length} quedan=${leftovers?.length ?? 0}`,
  )
}

process.exit(summary("F1-A lote de pagos") > 0 ? 1 : 0)
