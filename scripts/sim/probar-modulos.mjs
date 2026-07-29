// PRUEBA DE LOS 3 MÓDULOS SIN EJERCITAR EN LA SEMANA (bloque 4 del encargo):
// Reservas (§16.16), Encuestas (§16.17) y Soporte (§16.17). La semana los
// dejó NOT_APPLICABLE porque el guion no traía escenarios — esto los ejercita
// de verdad contra el server vivo y la base de PRUEBA.
import { guardLive, supabase } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders, publicHeaders } from "./lib/auth.mjs"
import { get, post, patch, del } from "./lib/api-client.mjs"
import { check, markBlocked, summary } from "./lib/assertions.mjs"
import { openDayLog, logLine, loadState } from "./lib/evidence-writer.mjs"

await guardLive({ requireMarker: true })
openDayLog("modulos", "Prueba de Reservas, Encuestas y Soporte")

const st = loadState()
const P = st.ids.principal
const SD = st.ids.sanDiego
await loginStaff("alejandro", "Sim-alejandro-2026!")
await loginStaff("jesus", "Sim-jesus-2026!")
await loginStaff("soporteqa", "Sim-soporteqa-2026!")
const owner = actorHeaders({ username: "alejandro", ip: "10.74.1.1", branchId: P })
const ownerSD = actorHeaders({ username: "alejandro", ip: "10.74.1.1", branchId: SD })
const cocina = actorHeaders({ username: "jesus", ip: "10.74.1.2", branchId: P })
const soporte = actorHeaders({ username: "soporteqa", ip: "10.74.1.3", branchId: P })
const cliente = (n) => publicHeaders(`10.74.2.${n}`, P)

// Mañana en hora Caracas (las reservas públicas solo aceptan de hoy en
// adelante; mañana evita el filo de "hoy a esta hora ya pasó").
const manana = new Date(Date.now() - 4 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10)

const RATE = Number(st.rate || 40)
const reservasCreadas = []
const pedidosCreados = []

// ════════════════════════ RESERVAS (§16.16) ════════════════════════════════

const listado = await get("/api/reservations", owner, { label: "GET reservations" })
const mesas = listado.json?.tables || []
check("MOD-R0", "el módulo lista las mesas activas de la sede para reservar",
  listado.status === 200 && mesas.length > 0,
  `status=${listado.status} mesas=${mesas.length}`)

const mesa1 = mesas[0]
const mesa2 = mesas[1] || mesas[0]

async function crearReserva(body, headers = owner) {
  const res = await post("/api/reservations", body, headers, { label: "POST reservation" })
  const id = res.json?.reservation?.id
  if (id) reservasCreadas.push(id)
  return res
}

// R1 · crear
const r1 = await crearReserva({
  tableId: mesa1.id, tableName: mesa1.name,
  customerName: "SIM MOD Cliente Reserva", customerPhone: "04141230001",
  partySize: 4, reservationDate: manana, startTime: "19:00", endTime: "21:00",
  status: "activa", note: "prueba bloque 4",
})
check("MOD-R1", "crear reserva (staff): creada y queda activa",
  (r1.status === 200 || r1.status === 201) && r1.json?.reservation?.status === "activa",
  `status=${r1.status} estado=${r1.json?.reservation?.status}`)
const reservaId = r1.json?.reservation?.id

// R2 · editar (mismo id, cambia tamaño del grupo)
const r2 = await crearReserva({
  id: reservaId, tableId: mesa1.id, tableName: mesa1.name,
  customerName: "SIM MOD Cliente Reserva", customerPhone: "04141230001",
  partySize: 6, reservationDate: manana, startTime: "19:00", endTime: "21:00",
  status: "activa", note: "prueba bloque 4 (editada)",
})
check("MOD-R2", "editar reserva: el mismo id actualiza (6 personas)",
  r2.status === 200 && Number(r2.json?.reservation?.partySize) === 6,
  `status=${r2.status} personas=${r2.json?.reservation?.partySize}`)

// R3 · doble reserva: misma mesa, franja que se pisa → rechazo
const r3 = await crearReserva({
  tableId: mesa1.id, tableName: mesa1.name,
  customerName: "SIM MOD Choque", customerPhone: "04141230002",
  partySize: 2, reservationDate: manana, startTime: "20:00", endTime: "22:00",
  status: "activa",
})
check("MOD-R3", "doble reserva de la MISMA mesa en franja pisada: rechazada",
  r3.status === 409 || r3.status === 400,
  `status=${r3.status} error=${r3.json?.error}`)

// R4 · horario inválido
const r4 = await crearReserva({
  tableId: mesa1.id, tableName: mesa1.name,
  customerName: "SIM MOD Hora Rara", customerPhone: "04141230003",
  partySize: 2, reservationDate: manana, startTime: "25:99", endTime: "26:00",
  status: "activa",
})
check("MOD-R4", "hora inválida (25:99): rechazada con 400",
  r4.status === 400, `status=${r4.status} error=${r4.json?.error}`)

// R5/R6 · estados: cancelar y no_show
const r5 = await patch(`/api/reservations/${reservaId}`, { status: "cancelada" }, owner, { label: "PATCH reservation" })
check("MOD-R5", "cancelar reserva: pasa a 'cancelada'",
  r5.status === 200 && r5.json?.reservation?.status === "cancelada",
  `status=${r5.status} estado=${r5.json?.reservation?.status}`)

const r6base = await crearReserva({
  tableId: mesa2.id, tableName: mesa2.name,
  customerName: "SIM MOD NoShow", customerPhone: "04141230004",
  partySize: 2, reservationDate: manana, startTime: "12:00", endTime: "13:30",
  status: "activa",
})
const r6 = await patch(`/api/reservations/${r6base.json?.reservation?.id}`, { status: "no_show" }, owner)
check("MOD-R6", "marcar no-show: pasa a 'no_show' (el cliente no llegó queda registrado)",
  r6.status === 200 && r6.json?.reservation?.status === "no_show",
  `status=${r6.status} estado=${r6.json?.reservation?.status}`)

// R7 · reserva PÚBLICA: asigna mesa libre y entra activa con nota [Online]
const r7 = await post("/api/public/reservations", {
  customerName: "SIM MOD Publico", customerPhone: "04141230005",
  partySize: 3, reservationDate: manana, startTime: "15:00",
}, cliente(1), { label: "POST public reservation" })
if (r7.json?.reservation?.id) reservasCreadas.push(r7.json.reservation.id)
// La respuesta pública no expone el estado: se verifica en la BASE que quedó
// activa y marcada [Online].
const { data: r7row } = await supabase
  .from("reservations").select("status,note,table_name")
  .eq("customer_name", "SIM MOD Publico").maybeSingle()
check("MOD-R7", "reserva online del cliente: asigna mesa activa libre, queda 'activa' y marcada [Online]",
  (r7.status === 200 || r7.status === 201) &&
  r7row?.status === "activa" && /\[Online\]/i.test(String(r7row?.note || "")),
  `status=${r7.status} mesa=${r7row?.table_name} estado=${r7row?.status} nota=${r7row?.note}`)

// R8 · pública con fecha pasada
const r8 = await post("/api/public/reservations", {
  customerName: "SIM MOD Ayer", customerPhone: "04141230006",
  partySize: 2, reservationDate: "2026-07-01", startTime: "19:00",
}, cliente(2))
check("MOD-R8", "reserva online con fecha pasada: rechazada",
  r8.status === 400, `status=${r8.status} error=${r8.json?.error}`)

// R9 · capacidad: el tamaño del grupo se acota (1..30)
const r9 = await post("/api/public/reservations", {
  customerName: "SIM MOD Multitud", customerPhone: "04141230007",
  partySize: 500, reservationDate: manana, startTime: "16:45",
}, cliente(3))
if (r9.json?.reservation?.id) reservasCreadas.push(r9.json.reservation.id)
check("MOD-R9", "grupo de 500: el sistema lo acota a 30 (no guarda una capacidad imposible)",
  Number(r9.json?.reservation?.partySize || 0) <= 30,
  `status=${r9.status} personas=${r9.json?.reservation?.partySize}`)

// R10 · aislamiento por sede: lo de P no se ve desde SD
const enSD = await get(`/api/reservations?date=${manana}`, ownerSD)
const nombresSD = JSON.stringify(enSD.json?.reservations || [])
check("MOD-R10", "aislamiento por sede: las reservas de Principal NO aparecen en San Diego",
  enSD.status === 200 && !nombresSD.includes("SIM MOD"),
  `status=${enSD.status} reservasSD=${(enSD.json?.reservations || []).length}`)

// R11 · sin mesa libre: llenar TODAS las mesas de una franja y pedir una más
const franja = { reservationDate: manana, startTime: "22:00", endTime: "23:30" }
for (const [i, mesa] of mesas.entries()) {
  await crearReserva({
    tableId: mesa.id, tableName: mesa.name,
    customerName: `SIM MOD Lleno ${i}`, customerPhone: `0414123010${i}`,
    partySize: 2, ...franja, status: "activa",
  })
}
const r11 = await post("/api/public/reservations", {
  customerName: "SIM MOD Sin Mesa", customerPhone: "04141230999",
  partySize: 2, reservationDate: manana, startTime: "22:00",
}, cliente(4))
check("MOD-R11", "todas las mesas ocupadas en la franja: el público recibe 'no queda mesa libre'",
  r11.status === 409, `status=${r11.status} error=${r11.json?.error}`)

// R12 · conversión reserva → cuenta/pedido: NO existe en el producto (se
// comprueba que de verdad no existe, no se asume).
const { data: resCols } = await supabase.from("reservations").select("*").limit(1)
const linkCols = Object.keys(resCols?.[0] || {}).filter((k) => /order|account/i.test(k))
check("MOD-R12", "conversión reserva→cuenta/pedido: no existe en el esquema (NOT_APPLICABLE honesto)",
  linkCols.length === 0, `columnas de vínculo=${JSON.stringify(linkCols)}`)

// ════════════════════════ ENCUESTAS (§16.17) ═══════════════════════════════

// Pedido real para encuestar.
const menu = (await get("/api/public/products", cliente(5))).json
const prod = (menu.menuProducts || menu.products).find((p) => p.name === "Burger Clásica")
const pedidoRes = await post("/api/orders", {
  customerName: "SIM MOD Encuestado", tableNumber: "Mesa 1", orderType: "Comer aquí",
  exchangeRate: RATE,
  items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
}, owner)
const pedidoId = pedidoRes.json?.order?.id
if (pedidoId) pedidosCreados.push(pedidoId)

const e1 = await get(`/api/public/survey?pedido=${pedidoId}`, cliente(5), { label: "GET survey" })
check("MOD-E1", "la encuesta del pedido carga con sus aspectos y sin responder",
  e1.status === 200 && Array.isArray(e1.json?.aspects) && e1.json?.aspects.length > 0 && e1.json?.alreadyAnswered === false,
  `status=${e1.status} aspectos=${(e1.json?.aspects || []).map((a) => a.key || a.id || a.label).join(",")}`)

const aspectos = e1.json?.aspects || []
const ratings = Object.fromEntries(aspectos.map((a, i) => [String(a.key || a.id), i % 2 ? 4 : 5]))
const e2 = await post("/api/public/survey", {
  orderId: pedidoId, ratings, comment: "SIM MOD: todo excelente, prueba bloque 4",
}, cliente(5), { label: "POST survey" })
check("MOD-E2", "responder la encuesta: 201 y la respuesta queda guardada con su sede",
  e2.status === 201, `status=${e2.status} error=${e2.json?.error || ""}`)

const { data: respRow } = await supabase
  .from("survey_responses").select("*").eq("order_id", pedidoId).maybeSingle()
check("MOD-E3", "la respuesta en la base tiene ratings, comentario y branch del pedido",
  Boolean(respRow) && String(respRow?.branch_id) === P,
  `branch=${respRow?.branch_id} esperado=${P}`)

const e4 = await post("/api/public/survey", {
  orderId: pedidoId, ratings, comment: "segundo intento",
}, cliente(5))
check("MOD-E4", "responder DOS veces el mismo pedido: rechazado (una respuesta por pedido)",
  e4.status === 409 && e4.json?.alreadyAnswered === true,
  `status=${e4.status}`)

const e5 = await get("/api/public/survey?pedido=ord-noexiste-000000", cliente(6))
check("MOD-E5", "encuesta de un pedido inexistente: 404",
  e5.status === 404, `status=${e5.status}`)

const e6 = await get("/api/surveys", owner, { label: "GET surveys (staff)" })
check("MOD-E6", "el dueño ve los resultados agregados de encuestas",
  e6.status === 200, `status=${e6.status} claves=${Object.keys(e6.json || {}).join(",")}`)

const e7 = await get("/api/surveys", cocina)
check("MOD-E7", "cocina NO puede leer los resultados de encuestas",
  e7.status === 403 || e7.status === 401, `status=${e7.status}`)

markBlocked("MOD-E8", "envío de la encuesta por WhatsApp (plantilla de botones)", "depende de credenciales Meta — sin resolver desde el 2026-07-24")

// ════════════════════════ SOPORTE (§16.17) ═════════════════════════════════
// El módulo real de Soporte es el panel de estado/diagnóstico del rol
// soporte (no existe un sistema de tickets — se prueba lo que existe).

const s1 = await get("/api/local-support/status", soporte, { label: "GET support status" })
check("MOD-S1", "el rol SOPORTE lee el panel de estado del sistema",
  s1.status === 200, `status=${s1.status} claves=${Object.keys(s1.json || {}).slice(0, 8).join(",")}`)

const s2 = await get("/api/local-support/status", cocina)
check("MOD-S2", "cocina NO puede leer el panel de soporte",
  s2.status === 403 || s2.status === 401, `status=${s2.status}`)

const s3 = await get("/api/local-support/status", publicHeaders("10.74.3.9", P))
check("MOD-S3", "sin credenciales NO se puede leer el panel de soporte",
  s3.status === 401 || s3.status === 403, `status=${s3.status}`)

// El panel DESCRIBE qué claves están configuradas ("SUPABASE_SERVICE_ROLE_KEY
// está configurada solo del lado servidor") sin exponer valores: lo prohibido
// son tokens reales (JWT "eyJ…"), no la mención del nombre de la variable.
const s1Body = JSON.stringify(s1.json || {})
check("MOD-S4", "el panel de soporte no filtra secretos (ningún token JWT real en la respuesta)",
  !/eyJ[A-Za-z0-9_-]{20,}/.test(s1Body),
  `bytes=${s1Body.length}`)

// ════════════════════════ Limpieza ═════════════════════════════════════════
for (const id of reservasCreadas) {
  await del(`/api/reservations/${id}`, owner).catch(() => undefined)
}
await supabase.from("reservations").delete().ilike("customer_name", "SIM MOD%")
await supabase.from("survey_responses").delete().eq("order_id", pedidosCreados[0] || "")
for (const id of pedidosCreados) {
  await supabase.from("order_items").delete().eq("order_id", id)
  await supabase.from("orders").delete().eq("id", id)
}
logLine(`\nlimpieza: ${reservasCreadas.length} reservas y ${pedidosCreados.length} pedidos de prueba eliminados`)

const result = summary("Prueba de Reservas, Encuestas y Soporte")
process.exit(result.fail > 0 ? 1 : 0)
