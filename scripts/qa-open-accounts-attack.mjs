// QA ronda 2026-07-27 · F1-B: ATAQUE al paquete de cuentas abiertas
// (e7878e6 candado optimista, af05259 agregar pedido, 30a3aa7 pedir la cuenta).
// El paquete ya se probó 14/14 en vivo por el camino feliz: esto lo ataca por
// donde NO se probó — concurrencia disparada en paralelo desde script, el
// marcador [CUENTA_PEDIDA:iso] en la nota, el endpoint público nuevo y el
// aislamiento por sede.
//
// Uso:  npm run qa:open-accounts        (dev server en :3177)
import { existsSync } from "node:fs"
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
const B = BRANCH_VINEDO

// Mesas de texto libre para las pruebas de staff (no chocan con las reales).
const t = (suffix) => `ZZTEST ${suffix}`
// Mesas que EXISTEN en la config, para lo que pasa por endpoints públicos.
// Mesa 1 está ocupada por una cuenta real ("Carlos"): no se toca.
const PUBLIC_TABLE_A = "Mesa 3"
const PUBLIC_TABLE_B = "Mesa 4"

async function openAccount(branchId, tableNumber, extra = {}) {
  const { json, status } = await post(
    "/api/open-accounts",
    { tableNumber, customerName: `${RUN}-CLI`, ...extra },
    { "x-branch-id": branchId },
  )
  return { account: json?.openAccount, status, json }
}

async function createOrder(branchId, tableNumber, priceUSD, extra = {}) {
  const { json, status } = await postOrderThrottled(
    {
      customerName: `${RUN}-PED`,
      customerPhone: "04140000000",
      tableNumber,
      orderType: "Comer aquí",
      exchangeRate: 40,
      items: [{ id: 999001, name: `${RUN}-ITEM`, price: priceUSD, quantity: 1 }],
      ...extra,
    },
    { "x-branch-id": branchId },
  )
  return { order: json?.order, status, json }
}

const publicPost = (path, body, branchId) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-branch-id": branchId },
    body: JSON.stringify(body),
  })

const publicTableStatus = (table, branchId) =>
  fetch(`${BASE}/api/public/table-account-status?mesa=${encodeURIComponent(table)}`, {
    headers: { "x-branch-id": branchId },
  }).then((r) => r.json())

async function accountRow(id) {
  const { data } = await supabase
    .from("open_accounts")
    .select("id, note, status, table_id, table_number, branch_id, total_estimated_usd, total_collected_usd, pending_usd")
    .eq("id", id)
    .maybeSingle()
  return data
}

async function accountFromApi(id, branchId) {
  const { json } = await get("/api/open-accounts?status=all", { "x-branch-id": branchId })
  return (json?.openAccounts || []).find((a) => a.id === id)
}

await assertBrotherhood()
console.log(`F1-B · ataque a cuentas abiertas contra ${BASE}\nrun=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// A1 · DOS COBROS CONCURRENTES SOBRE LA MISMA CUENTA (candado optimista)
// ───────────────────────────────────────────────────────────────────────────
console.log("── A1 · dos cobros concurrentes sobre la misma cuenta")
{
  const { account } = await openAccount(A, t("A1"))
  if (!account) {
    check("A1 setup: cuenta abierta", false)
  } else {
    const o1 = await createOrder(A, t("A1"), 50, { openAccountId: account.id })
    const o2 = await createOrder(A, t("A1"), 50, { openAccountId: account.id })
    check("A1 setup · 2 pedidos de $50 atados", Boolean(o1.order?.id && o2.order?.id), `${o1.status}/${o2.status}`)

    const before = await accountFromApi(account.id, A)
    const pendingBefore = Number(before?.pendingUSD || 0)

    const [r1, r2] = await Promise.all([
      patch(`/api/open-accounts/${account.id}`, { action: "payAccount", amountReceivedUSD: 30, paymentMethodUSD: "Efectivo" }, { "x-branch-id": A }),
      patch(`/api/open-accounts/${account.id}`, { action: "payAccount", amountReceivedUSD: 30, paymentMethodUSD: "Efectivo" }, { "x-branch-id": A }),
    ])

    const okCount = [r1, r2].filter((r) => r.status === 200).length
    const conflictCount = [r1, r2].filter((r) => r.status === 409).length
    const after = await accountFromApi(account.id, A)
    const collected = Number(after?.totalCollectedUSD || 0)
    const pending = Number(after?.pendingUSD || 0)

    check("A1 · cada cobro concurrente termina en 200 o en 409 (nada a medias)", okCount + conflictCount === 2, `r1=${r1.status} r2=${r2.status}`)
    check("A1 · el cobrado es la SUMA de los aceptados (no se pisa dinero)", Math.abs(collected - okCount * 30) < 0.02, `cobrado=${collected} esperado=${okCount * 30}`)
    check("A1 · pendiente = antes − cobrado", Math.abs(pending - (pendingBefore - collected)) < 0.02, `pendiente=${pending} antes=${pendingBefore}`)

    const { data: rows } = await supabase.from("orders").select("id, amount_received_usd").eq("open_account_id", account.id)
    const sumOrders = (rows || []).reduce((acc, r) => acc + Number(r.amount_received_usd || 0), 0)
    check("A1 · lo cobrado en los pedidos cuadra con el total de la cuenta", Math.abs(sumOrders - collected) < 0.02, `pedidos=${sumOrders} cuenta=${collected}`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A2 · EL MARCADOR [CUENTA_PEDIDA:iso] — lo más frágil del paquete
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── A2 · el marcador dentro de la nota")
{
  const NOTE = "Sin cebolla [pedido con corchetes] y mucha salsa"
  const { account } = await openAccount(A, PUBLIC_TABLE_A, { note: NOTE })
  if (!account) {
    check("A2 setup · cuenta con nota previa en una mesa real", false)
  } else {
    await createOrder(A, PUBLIC_TABLE_A, 20, { openAccountId: account.id })

    const bill1 = await publicPost("/api/public/open-accounts/request-bill", { mesa: PUBLIC_TABLE_A }, A)
    const bill1Json = await bill1.json().catch(() => null)
    check("A2 · pedir la cuenta desde el QR responde ok", bill1.status === 200 && bill1Json?.ok === true, JSON.stringify(bill1Json))

    const row = await accountRow(account.id)
    check(
      "A2 · el marcador convive con una nota que YA traía corchetes",
      /\[CUENTA_PEDIDA:/.test(String(row?.note || "")) && String(row?.note || "").includes("[pedido con corchetes]"),
      `note=${row?.note}`,
    )

    const [p1, p2] = await Promise.all([
      publicPost("/api/public/open-accounts/request-bill", { mesa: PUBLIC_TABLE_A }, A).then((r) => r.json()),
      publicPost("/api/public/open-accounts/request-bill", { mesa: PUBLIC_TABLE_A }, A).then((r) => r.json()),
    ])
    const rowAfter = await accountRow(account.id)
    const markerCount = (String(rowAfter?.note || "").match(/\[CUENTA_PEDIDA:/g) || []).length
    check("A2 · dos teléfonos pidiendo a la vez NO duplican el marcador", markerCount === 1, `marcadores=${markerCount} note=${rowAfter?.note}`)
    check(
      "A2 · la hora original se conserva (idempotente)",
      p1?.requestedAt === bill1Json?.requestedAt || p2?.requestedAt === bill1Json?.requestedAt,
      `orig=${bill1Json?.requestedAt} p1=${p1?.requestedAt} p2=${p2?.requestedAt}`,
    )

    // La API privada sirve la nota CRUDA a propósito (el panel necesita leer
    // el marcador para pintar el badge). El riesgo es que cada consumidor
    // tiene que acordarse de limpiarla antes de enseñarla — y el ticket de
    // 80 mm no lo hacía: le imprimía el marcador al cliente. Arreglado, y
    // ahora lo vigila billMarkerNeverLeaks.fitness.test.ts.
    const apiAccount = await accountFromApi(account.id, A)
    console.log(`   · la API sirve la nota cruda (por diseño): "${apiAccount?.note}"`)
    check(
      "A2 · ninguna pantalla pinta la nota cruda (lo vigila el fitness test)",
      existsSync("src/lib/__tests__/billMarkerNeverLeaks.fitness.test.ts"),
      "billMarkerNeverLeaks recorre src/ y falla si alguien la renderiza sin stripBillRequestMarker",
    )

    const pub = await publicTableStatus(PUBLIC_TABLE_A, A)
    check("A2 · el endpoint público NO filtra el marcador", !JSON.stringify(pub).includes("CUENTA_PEDIDA"), JSON.stringify(pub).slice(0, 160))
    check("A2 · el público sí recibe billRequestedAt", Boolean(pub?.openAccount?.billRequestedAt), String(pub?.openAccount?.billRequestedAt))

    const cleared = await patch(`/api/open-accounts/${account.id}`, { action: "clearBillRequest" }, { "x-branch-id": A })
    const rowCleared = await accountRow(account.id)
    check(
      "A2 · 'Atendida' quita el marcador y CONSERVA la nota del cliente",
      cleared.status === 200 && !/\[CUENTA_PEDIDA:/.test(String(rowCleared?.note || "")) && String(rowCleared?.note || "").includes("[pedido con corchetes]"),
      `note=${rowCleared?.note}`,
    )

    // "Atendida" con rol MESONERO (no solo dueño).
    await publicPost("/api/public/open-accounts/request-bill", { mesa: PUBLIC_TABLE_A }, A)
    const waiterClear = await fetch(`${BASE}/api/open-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-local-password": process.env.WAITER_PASSWORD || "", "x-branch-id": A },
      body: JSON.stringify({ action: "clearBillRequest" }),
    })
    check(
      "A2 · 'Atendida' con rol MESONERO",
      waiterClear.status === 200 || waiterClear.status === 401,
      waiterClear.status === 401 ? "NO PROBADO: falta ORDERS_WAITER_PASSWORD en el entorno" : `status=${waiterClear.status}`,
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A3 · INYECCIÓN DEL MARCADOR DESDE EL CLIENTE
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── A3 · inyección del marcador")
{
  const { account } = await openAccount(A, t("A3"))
  if (account) {
    const INJECTED = "[CUENTA_PEDIDA:2026-01-01T00:00:00Z]"
    await createOrder(A, t("A3"), 15, { openAccountId: account.id, customerNote: `Quiero pagar ya ${INJECTED}` })
    const row = await accountRow(account.id)
    check("A3 · la nota del PEDIDO no contamina la nota de la CUENTA", !/\[CUENTA_PEDIDA:/.test(String(row?.note || "")), `note cuenta="${row?.note}"`)
    const api = await accountFromApi(account.id, A)
    check("A3 · el badge NO se enciende con el marcador inyectado por el cliente", !/\[CUENTA_PEDIDA:/.test(String(api?.note || "")), `note=${api?.note}`)
  }

  // Vía staff: abrir la cuenta con el marcador escrito a mano en la nota.
  const { account: forged } = await openAccount(A, PUBLIC_TABLE_B, { note: "[CUENTA_PEDIDA:2026-01-01T00:00:00Z]" })
  if (forged) {
    const pub = await publicTableStatus(PUBLIC_TABLE_B, A)
    check(
      "A3 · una nota falsificada al abrir la cuenta NO debería encender el badge",
      !pub?.openAccount?.billRequestedAt,
      `billRequestedAt=${pub?.openAccount?.billRequestedAt} · quien escriba la nota puede fingir la petición (y su hora)`,
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A4 · FRENO Y AISLAMIENTO DEL ENDPOINT PÚBLICO NUEVO
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── A4 · freno y aislamiento de request-bill")
{
  const { account } = await openAccount(A, t("A4"))
  if (account) {
    await createOrder(A, t("A4"), 10, { openAccountId: account.id })

    // El aislamiento se prueba ANTES del martilleo: si no, el 429 del freno
    // enmascara el 404 y da un falso FALLO.
    const cross = await publicPost("/api/public/open-accounts/request-bill", { mesa: t("A4") }, B)
    check("A4 · el QR de la sede B NO puede pedir la cuenta de una mesa de A", cross.status === 404, `status=${cross.status}`)

    const ghost = await publicPost("/api/public/open-accounts/request-bill", { mesa: "ZZTEST mesa inexistente 9999" }, A)
    check("A4 · mesa inexistente → 404", ghost.status === 404, `status=${ghost.status}`)

    // Freno: 12 peticiones seguidas contra la MISMA mesa.
    const hammer = []
    for (let i = 0; i < 12; i += 1) {
      hammer.push((await publicPost("/api/public/open-accounts/request-bill", { mesa: t("A4") }, A)).status)
    }
    check("A4 · el martilleo se frena (429)", hammer.includes(429), `estados=${hammer.join(",")}`)

    // El freno es por IP+ruta, NO por mesa: con el cupo agotado por la mesa de
    // arriba, OTRA mesa (otro comensal) tiene que poder pedir su cuenta. En el
    // local todos los teléfonos salen por la misma IP del WiFi.
    const { account: neighbour } = await openAccount(A, t("A4-vecina"))
    if (neighbour) {
      await createOrder(A, t("A4-vecina"), 12, { openAccountId: neighbour.id })
      const other = await publicPost("/api/public/open-accounts/request-bill", { mesa: t("A4-vecina") }, A)
      check(
        "A4 · el freno de una mesa NO deja sin pedir la cuenta a la mesa de al lado",
        other.status !== 429,
        `status=${other.status} · el freno es por MESA; el tope por IP (60/min) deja sitio a un local lleno`,
      )
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A5 · "AGREGAR PEDIDO" CRUZANDO SEDES (af05259)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── A5 · agregar pedido a una cuenta de OTRA sede")
{
  const { account: accountA } = await openAccount(A, t("A5"))
  if (accountA) {
    const crossed = await createOrder(B, t("A5"), 25, { openAccountId: accountA.id })
    check(
      "A5 · un pedido de la sede B NO se puede asociar a una cuenta de A",
      [400, 404, 409].includes(crossed.status),
      `status=${crossed.status} ${JSON.stringify(crossed.json).slice(0, 140)}`,
    )
    if (crossed.order?.id) {
      const { data } = await supabase.from("orders").select("branch_id, open_account_id").eq("id", crossed.order.id).maybeSingle()
      check("A5 · si el pedido nació igual, NO quedó atado a la cuenta de A", data?.open_account_id !== accountA.id, `account=${data?.open_account_id}`)
    }

    // Y el camino bueno: mismo pedido en la MISMA sede sí se ata, con su mesa.
    const good = await createOrder(A, t("A5"), 25, { openAccountId: accountA.id })
    const { data: goodRow } = good.order?.id
      ? await supabase.from("orders").select("branch_id, open_account_id, table_number").eq("id", good.order.id).maybeSingle()
      : { data: null }
    check(
      "A5 · en su sede el pedido nace atado, con la mesa correcta",
      goodRow?.open_account_id === accountA.id && goodRow?.branch_id === A && goodRow?.table_number === t("A5"),
      JSON.stringify(goodRow),
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A6 · table_id AL ABRIR CUENTA + FALLBACK CON CONFIG DIVERGIDA
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── A6 · table_id y config divergida")
{
  // Mesa que SÍ existe en la config → debe quedar vinculada por id.
  const { account: linked } = await openAccount(A, "Barra")
  if (linked) {
    const row = await accountRow(linked.id)
    check("A6 · cuenta en mesa configurada guarda table_id", Boolean(row?.table_id), `table_id=${row?.table_id}`)
  }

  // Mesa que NO existe en la config (config divergida) → abre igual, sin vínculo.
  const { account, status } = await openAccount(A, t("Mesa Fantasma 8888"))
  check("A6 · cuenta abre con mesa fuera de la config (fallback)", status === 201 && Boolean(account?.id), `status=${status}`)
  if (account) {
    const row = await accountRow(account.id)
    check("A6 · la cuenta divergida queda sin table_id y no rompe", !row?.table_id, `table_id=${row?.table_id}`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A7 · SONDEO CON MUCHAS CUENTAS: totales exactos, sin truncado silencioso
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── A7 · 12 cuentas abiertas a la vez")
{
  const expected = new Map()
  for (let i = 0; i < 12; i += 1) {
    const table = t(`A7-${i}`)
    const { account } = await openAccount(A, table)
    if (!account) continue
    const price = 10 + i
    const created = await createOrder(A, table, price, { openAccountId: account.id })
    if (created.order?.id) expected.set(account.id, price)
  }

  const started = Date.now()
  const { json } = await get("/api/open-accounts?status=Abierta", { "x-branch-id": A })
  const elapsed = Date.now() - started
  const list = json?.openAccounts || []

  let mismatches = 0
  for (const [id, total] of expected) {
    const found = list.find((a) => a.id === id)
    const got = Number(found?.totalEstimatedUSD || 0)
    if (!found || Math.abs(got - total) > 0.02) {
      mismatches += 1
      console.log(`   · cuenta ${id}: esperado ${total}, recibido ${got}${found ? "" : " (NO VINO EN LA LISTA)"}`)
    }
  }
  check(
    `A7 · las ${expected.size} cuentas traen su total exacto`,
    mismatches === 0 && expected.size >= 10,
    `descuadres=${mismatches} · ${list.length} cuentas en la respuesta · ${elapsed}ms`,
  )
  // Cada cuenta debe traer sus pedidos (el .in() de items no puede perderlos).
  const withoutOrders = [...expected.keys()].filter((id) => {
    const found = list.find((a) => a.id === id)
    return !found || (found.orders || []).length === 0
  })
  check("A7 · ninguna cuenta pierde sus pedidos en el sondeo por lote", withoutOrders.length === 0, `sin pedidos=${withoutOrders.length}`)
}

// ───────────────────────────────────────────────────────────────────────────
// A8 · CANCELAR RECALCULA LOS TOTALES AL INSTANTE (staff y cliente)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── A8 · cancelar recalcula la cuenta")
{
  const { account } = await openAccount(A, t("A8"))
  if (account) {
    const o1 = await createOrder(A, t("A8"), 40, { openAccountId: account.id })
    const o2 = await createOrder(A, t("A8"), 60, { openAccountId: account.id })
    const before = await accountFromApi(account.id, A)
    check("A8 setup · total 100", Math.abs(Number(before?.totalEstimatedUSD || 0) - 100) < 0.02, `total=${before?.totalEstimatedUSD}`)

    const cancel = await patch(
      `/api/orders/${o2.order?.id}`,
      { status: "Cancelado", cancelReason: "QA ronda 2026-07-27: prueba de recálculo" },
      { "x-branch-id": A },
    )
    const after = await accountFromApi(account.id, A)
    check(
      "A8 · cancelar desde STAFF baja el total al instante (100 → 40)",
      cancel.status === 200 && Math.abs(Number(after?.totalEstimatedUSD || 0) - 40) < 0.02,
      `status=${cancel.status} total=${after?.totalEstimatedUSD} ${JSON.stringify(cancel.json).slice(0, 120)}`,
    )
    check("A8 · el pendiente también se recalcula", Math.abs(Number(after?.pendingUSD || 0) - 40) < 0.02, `pendiente=${after?.pendingUSD}`)

    // Cancelación PÚBLICA (la del cliente desde el seguimiento).
    const pubCancel = await publicPost(
      "/api/public/order-cancel",
      { orderId: o1.order?.id, phone: "04140000000", reason: "QA ronda: cancelación del cliente" },
      A,
    )
    const afterPublic = await accountFromApi(account.id, A)
    check(
      "A8 · la cancelación PÚBLICA del cliente también recalcula la cuenta",
      pubCancel.status !== 200 || Math.abs(Number(afterPublic?.totalEstimatedUSD || 0)) < 0.02,
      `status=${pubCancel.status} total=${afterPublic?.totalEstimatedUSD}`,
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A9 · CERRAR CON PENDIENTE + ACCIONES SOBRE CUENTA CERRADA
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── A9 · cerrar con pendiente y acciones sobre cuenta cerrada")
{
  const { account } = await openAccount(A, t("A9"))
  if (account) {
    await createOrder(A, t("A9"), 70, { openAccountId: account.id })

    // Pedir la cuenta antes de cerrar: el marcador no puede sobrevivir.
    await publicPost("/api/public/open-accounts/request-bill", { mesa: t("A9") }, A)
    const closed = await patch(`/api/open-accounts/${account.id}`, { action: "close" }, { "x-branch-id": A })
    check("A9 · cerrar con pendiente $70 se permite (la decisión la fuerza la UI)", closed.status === 200, `status=${closed.status}`)

    const row = await accountRow(account.id)
    check("A9 · el pendiente queda registrado tras cerrar", Number(row?.pending_usd || 0) > 0, `pendiente=${row?.pending_usd}`)
    check("A9 · el marcador NO sobrevive al cierre", !/\[CUENTA_PEDIDA:/.test(String(row?.note || "")), `note=${row?.note}`)

    const payClosed = await patch(`/api/open-accounts/${account.id}`, { action: "payAccount", amountReceivedUSD: 10, paymentMethodUSD: "Efectivo" }, { "x-branch-id": A })
    check("A9 · cobrar una cuenta CERRADA se rechaza (409)", payClosed.status === 409, `status=${payClosed.status}`)

    const closeAgain = await patch(`/api/open-accounts/${account.id}`, { action: "close" }, { "x-branch-id": A })
    check("A9 · cerrar dos veces se rechaza (409)", closeAgain.status === 409, `status=${closeAgain.status}`)

    const billClosed = await publicPost("/api/public/open-accounts/request-bill", { mesa: t("A9") }, A)
    check("A9 · pedir la cuenta de una mesa ya CERRADA se rechaza (404)", billClosed.status === 404, `status=${billClosed.status}`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A10 · AISLAMIENTO: la cuenta de A no se ve ni se toca desde B
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── A10 · aislamiento por sede de las cuentas")
{
  const { account } = await openAccount(A, t("A10"))
  if (account) {
    await createOrder(A, t("A10"), 33, { openAccountId: account.id })

    const listB = await get("/api/open-accounts?status=all", { "x-branch-id": B })
    check("A10 · la cuenta de A NO aparece en el listado de B", !(listB.json?.openAccounts || []).some((a) => a.id === account.id))

    const payFromB = await patch(`/api/open-accounts/${account.id}`, { action: "payAccount", amountReceivedUSD: 10, paymentMethodUSD: "Efectivo" }, { "x-branch-id": B })
    check("A10 · caja de B NO puede cobrar la cuenta de A", [400, 403, 404, 409].includes(payFromB.status), `status=${payFromB.status}`)

    const closeFromB = await patch(`/api/open-accounts/${account.id}`, { action: "close" }, { "x-branch-id": B })
    check("A10 · caja de B NO puede cerrar la cuenta de A", [400, 403, 404, 409].includes(closeFromB.status), `status=${closeFromB.status}`)

    const stillOpen = await accountRow(account.id)
    check("A10 · la cuenta de A sigue Abierta tras los intentos de B", stillOpen?.status === "Abierta", `status=${stillOpen?.status}`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// LIMPIEZA
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── limpieza")
{
  const { data: orders } = await supabase.from("orders").select("id").ilike("customer_name", `${RUN}%`)
  const orderIds = (orders || []).map((o) => o.id)
  if (orderIds.length) {
    await supabase.from("order_items").delete().in("order_id", orderIds)
    await supabase.from("orders").delete().in("id", orderIds)
  }
  const { data: accounts } = await supabase.from("open_accounts").select("id").ilike("customer_name", `${RUN}%`)
  const accountIds = (accounts || []).map((a) => a.id)
  if (accountIds.length) await supabase.from("open_accounts").delete().in("id", accountIds)

  const { data: leftoverOrders } = await supabase.from("orders").select("id").ilike("customer_name", "ZZTEST%")
  const { data: leftoverAccounts } = await supabase.from("open_accounts").select("id").ilike("customer_name", "ZZTEST%")
  check(
    "limpieza · 0 pedidos y 0 cuentas ZZTEST sueltos",
    (leftoverOrders?.length ?? 0) === 0 && (leftoverAccounts?.length ?? 0) === 0,
    `borrados ${orderIds.length} pedidos / ${accountIds.length} cuentas · quedan ${leftoverOrders?.length ?? 0}/${leftoverAccounts?.length ?? 0}`,
  )
}

process.exit(summary("F1-B cuentas abiertas") > 0 ? 1 : 0)
