// ============================================================
// QA DE VIDA REAL — Hotel Lidotel (demo con 25 habitaciones)
// Simula todo lo que pasa cuando clientes reales entran, reservan,
// llegan, consumen y salen — incluyendo errores, cupos agotados y
// dos clientes peleando por la última habitación. Limpia TODO al final.
// ============================================================
import { readFileSync } from "node:fs"

const WT = process.cwd()
const env = readFileSync(`${WT}/.env.local`, "utf8")
const PW = (env.match(/^ORDERS_ADMIN_PASSWORD=(.*)$/m)?.[1] || "").replace(/^"|"$/g, "").trim()
const BASE = "http://localhost:3000"
const STAFF = { "Content-Type": "application/json", "x-admin-password": PW, Origin: BASE }
const PUB = { "Content-Type": "application/json", Origin: BASE }

const results = []
let failures = 0
function check(name, ok, detail = "") {
  results.push(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const plus = (days) => iso(new Date(Date.now() + days * 86400e3))

async function pub(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: PUB, ...opts })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}
async function staff(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: STAFF, ...opts })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}
const bookBody = (o) => JSON.stringify({ adults: 2, children: 0, termsAccepted: true, ...o })

// ids de reservas QA para limpiar al final
const createdReservations = []
let restrictionId = null
let blockId = null

// ---------- Contexto: tipos y habitaciones ----------
const roomsData = (await staff("/api/rooms")).data
const types = Object.fromEntries(roomsData.roomTypes.map((t) => [t.name, t]))
const IND = types["Individual"]
const rooms = roomsData.rooms
const indRooms = rooms.filter((r) => r.roomTypeId === IND.id && r.active && !r.outOfService)
check("Contexto: 25 habitaciones activas", rooms.filter((r) => r.active).length === 25, `${rooms.length} totales, Individual=${indRooms.length}`)

try {
  // ============ A. CLIENTE PÚBLICO: consultas ============
  const A = plus(150), A2 = plus(152)
  let r = await pub(`/api/public/hotel?checkIn=${A}&checkOut=${A2}`)
  const typesOffered = r.data?.types || []
  check("A1 disponibilidad rango válido ofrece los 3 tipos", typesOffered.length === 3, typesOffered.map((t) => `${t.name}:${t.freeCount}`).join(" "))
  check("A2 cotización correcta (2 noches × tarifa)", typesOffered.every((t) => t.quote.total === t.quote.averageRate * 2))
  check("A3 fotos vienen en la oferta pública", typesOffered.every((t) => Array.isArray(t.photos) && t.photos.length > 0))
  const freeIndBase = typesOffered.find((t) => t.roomTypeId === IND.id)?.freeCount ?? 0

  r = await pub(`/api/public/hotel?checkIn=${A2}&checkOut=${A}`)
  check("A4 rango invertido en GET → sin tipos (sin 500)", r.status === 200 && (r.data.types || []).length === 0)

  // ============ B. CLIENTE PÚBLICO: reservas con errores (5 POST) ============
  // Pausa preventiva: si esta ronda corre justo después de otra (o de la ronda
  // 2), el rate limit público (8 POST/min) sigue caliente y daría 429 falsos.
  results.push("… pausa 62s por rate limit público …")
  await sleep(62_000)

  r = await pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "Cliente QA", guestPhone: "04140000001", checkIn: A2, checkOut: A }) })
  check("B1 reservar con rango invertido → 400", r.status === 400, r.data?.error)

  r = await pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "Cliente QA", guestPhone: "04140000001", checkIn: "2020-01-01", checkOut: "2020-01-02" }) })
  check("B2 reservar en el pasado → 400", r.status === 400, r.data?.error)

  r = await pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "Cliente QA", guestPhone: "04140000001", checkIn: plus(400), checkOut: plus(402) }) })
  check("B3 reservar a más de un año → 400", r.status === 400, r.data?.error)

  r = await pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "AB", guestPhone: "04140000001", checkIn: A, checkOut: A2 }) })
  check("B4 nombre demasiado corto → 400", r.status === 400, r.data?.error)

  r = await pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "Cliente QA", guestPhone: "123", checkIn: A, checkOut: A2 }) })
  check("B5 teléfono inválido → 400", r.status === 400, r.data?.error)

  r = await pub("/api/public/hotel", { method: "POST", body: JSON.stringify({ roomTypeId: IND.id, guestName: "Cliente QA", guestPhone: "04140000001", adults: 2, checkIn: A, checkOut: A2 }) })
  check("B6 sin aceptar términos → 400", r.status === 400, r.data?.error)

  // ============ C. Reserva feliz + caracteres especiales (2 POST) ============
  // B(6) + C(2) = 8 POST caben justo en la misma ventana de 8/min tras la pausa.
  r = await pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "María José Pérez QA", guestPhone: "04141112233", checkIn: A, checkOut: A2, note: "Llegada tarde ~23:00" }) })
  const happy = r.data?.reservation
  check("C1 reserva feliz → código + total", Boolean(happy?.code) && happy.totalAmount === happy.ratePerNight * 2, `code=${happy?.code} total=$${happy?.totalAmount} ${happy ? "" : `status=${r.status} ${r.data?.error || ""}`}`)
  if (happy) createdReservations.push({ code: happy.code })
  if (!happy) throw new Error(`La reserva feliz falló (${r.status}: ${r.data?.error || "sin detalle"}); se aborta la ronda y se limpia.`)

  r = await pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: types["Doble Superior"].id, guestName: "Ñandú Ödipo <b>QA</b> 🏨", guestPhone: "04149998877", checkIn: A, checkOut: A2, note: "Cuna extra & vista <script>alert(1)</script>" }) })
  const weird = r.data?.reservation
  check("C2 tildes/emoji/HTML se guardan como texto plano", Boolean(weird?.code), `code=${weird?.code}`)
  if (weird) createdReservations.push({ code: weird.code })

  // Lookup del cliente (con y sin datos correctos)
  r = await pub("/api/public/hotel/lookup", { method: "POST", body: JSON.stringify({ code: happy.code, phone: "04141112233" }) })
  check("C3 lookup con código+teléfono correcto", r.status === 200 && r.data.reservation?.guestName === "María José Pérez QA")
  r = await pub("/api/public/hotel/lookup", { method: "POST", body: JSON.stringify({ code: happy.code, phone: "04140000000" }) })
  check("C4 lookup con teléfono equivocado → 404", r.status === 404)
  r = await pub("/api/public/hotel/lookup", { method: "POST", body: JSON.stringify({ code: "NOEXISTE", phone: "04141112233" }) })
  check("C5 lookup con código inexistente → 404", r.status === 404)
  r = await pub("/api/public/hotel/lookup", { method: "POST", body: JSON.stringify({ code: weird.code, phone: "04149998877" }) })
  check("C6 lookup devuelve el nombre raro intacto", r.data?.reservation?.guestName === "Ñandú Ödipo <b>QA</b> 🏨", JSON.stringify(r.data?.reservation?.guestName))

  // Reseña del huésped
  r = await pub("/api/public/hotel/review", { method: "POST", body: JSON.stringify({ code: happy.code, guestName: "María QA", rating: 5, comment: "QA BORRAR: excelente" }) })
  check("C7 reseña con reserva válida → aceptada", r.status === 200 || r.status === 201, `status=${r.status}`)
  r = await pub("/api/public/hotel/review", { method: "POST", body: JSON.stringify({ code: happy.code, guestName: "María QA", rating: 99, comment: "QA BORRAR rating 99" }) })
  const clamped = r.status === 400 || (r.status < 300 && (r.data?.review?.rating === undefined || (r.data.review.rating >= 1 && r.data.review.rating <= 5)))
  check("C8 rating 99 → rechazado o acotado 1..5", clamped, `status=${r.status} rating=${r.data?.review?.rating}`)

  // ============ D. Temporadas y feeds públicos ============
  r = await pub(`/api/public/hotel?checkIn=2026-12-20&checkOut=2026-12-22`)
  const decInd = (r.data?.types || []).find((t) => t.roomTypeId === IND.id)
  check("D1 temporada Fin de Año aplica (+35%)", Boolean(decInd?.quote.seasonApplied) && decInd.quote.averageRate > IND.baseRate, `$${decInd?.quote.averageRate}/noche vs base $${IND.baseRate}`)

  r = await pub("/api/public/hotel/profile")
  check("D2 perfil público con datos", r.status === 200 && Boolean(r.data.profile?.headline))
  r = await pub("/api/public/hotel/services")
  check("D3 servicios del resort públicos", r.status === 200 && (r.data.services || []).length >= 5, `${(r.data.services || []).length} servicios`)
  r = await pub("/api/public/hotel/review")
  check("D4 reseñas públicas + promedio", r.status === 200 && (r.data.summary?.count ?? 0) >= 5, `avg=${r.data.summary?.average} n=${r.data.summary?.count}`)
  const ical = await fetch(`${BASE}/api/public/hotel/ical`)
  const icalText = await ical.text()
  check("D5 feed iCal válido", ical.status === 200 && icalText.startsWith("BEGIN:VCALENDAR"))

  // ============ E. AGOTAMIENTO + CARRERA por la última habitación ============
  // Rango G: llenamos con reservas de staff todas las Individual menos UNA,
  // y soltamos 2 clientes públicos EN PARALELO por la última.
  const G = plus(160), G2 = plus(161)
  const fillCount = indRooms.length - 1
  for (let i = 0; i < fillCount; i++) {
    const room = indRooms[i]
    const res = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: room.id, roomTypeId: IND.id, guestName: `QA Relleno ${i + 1}`, guestPhone: "0000000", checkInDate: G, checkOutDate: G2, ratePerNight: 75 }) })
    if (res.data?.reservation?.id) createdReservations.push({ id: res.data.reservation.id })
  }
  r = await pub(`/api/public/hotel?checkIn=${G}&checkOut=${G2}`)
  const lastFree = (r.data?.types || []).find((t) => t.roomTypeId === IND.id)?.freeCount
  check("E1 queda exactamente 1 Individual libre", lastFree === 1, `freeCount=${lastFree}`)

  // pausa para respetar el rate limit público (8 POST/min) antes de la carrera
  results.push("… pausa 62s por rate limit público …")
  await sleep(62_000)

  const race = await Promise.all([
    pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "Corredor Uno QA", guestPhone: "04141000001", checkIn: G, checkOut: G2 }) }),
    pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "Corredor Dos QA", guestPhone: "04141000002", checkIn: G, checkOut: G2 }) }),
  ])
  const winners = race.filter((x) => x.status < 300 && x.data?.reservation)
  for (const w of winners) createdReservations.push({ code: w.data.reservation.code })
  // Verificación de NO doble asignación: por habitación, máx 1 reserva bloqueante en G
  const all = (await staff(`/api/hotel-reservations?from=${G}&to=${G2}`)).data.reservations || []
  const blocking = all.filter((x) => ["pendiente", "confirmada", "checkin"].includes(x.status) && x.checkInDate < G2 && G < x.checkOutDate)
  const perRoom = {}
  for (const b of blocking) perRoom[b.roomId] = (perRoom[b.roomId] || 0) + 1
  const overbooked = Object.values(perRoom).some((n) => n > 1)
  check("E2 carrera: no hay doble asignación de habitación", !overbooked, `ganadores=${winners.length}, reservas bloqueantes=${blocking.length}`)
  check("E3 carrera: exactamente 1 cliente ganó la última", winners.length === 1, race.map((x) => x.status).join(" vs "))

  r = await pub(`/api/public/hotel?checkIn=${G}&checkOut=${G2}`)
  const soldOut = !(r.data?.types || []).some((t) => t.roomTypeId === IND.id)
  check("E4 tipo agotado deja de ofrecerse", soldOut)
  r = await pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "Tarde QA", guestPhone: "04141000003", checkIn: G, checkOut: G2 }) })
  check("E5 reservar agotado → 409", r.status === 409, r.data?.error)

  // ============ F. Restricciones de venta (mínimo de noches) ============
  const H = plus(170), H1 = plus(171), H3 = plus(173)
  let rr = await staff("/api/rate-restrictions", { method: "POST", body: JSON.stringify({ roomTypeId: IND.id, fromDate: H, toDate: H3, minStay: 3 }) })
  restrictionId = rr.data?.restriction?.id || null
  check("F1 crear restricción min 3 noches", Boolean(restrictionId))
  r = await pub(`/api/public/hotel?checkIn=${H}&checkOut=${H1}`)
  check("F2 estadía de 1 noche ya no ofrece Individual", !(r.data?.types || []).some((t) => t.roomTypeId === IND.id))
  r = await pub("/api/public/hotel", { method: "POST", body: bookBody({ roomTypeId: IND.id, guestName: "Corto QA", guestPhone: "04141000004", checkIn: H, checkOut: H1 }) })
  check("F3 reservar 1 noche con mínimo 3 → 409", r.status === 409, r.data?.error)
  await staff("/api/rate-restrictions", { method: "POST", body: JSON.stringify({ action: "delete", id: restrictionId }) })
  restrictionId = null
  r = await pub(`/api/public/hotel?checkIn=${H}&checkOut=${H1}`)
  check("F4 al borrar la restricción vuelve a ofrecerse", (r.data?.types || []).some((t) => t.roomTypeId === IND.id))

  // ============ G. Bloqueo de habitación (mantenimiento) ============
  const I = plus(180), I2 = plus(182)
  const before = (await pub(`/api/public/hotel?checkIn=${I}&checkOut=${I2}`)).data.types.find((t) => t.roomTypeId === IND.id)?.freeCount ?? 0
  let rb = await staff("/api/room-blocks", { method: "POST", body: JSON.stringify({ roomId: indRooms[0].id, fromDate: I, toDate: I2, reason: "QA mantenimiento BORRAR" }) })
  blockId = rb.data?.block?.id || rb.data?.roomBlock?.id || null
  const after = (await pub(`/api/public/hotel?checkIn=${I}&checkOut=${I2}`)).data.types.find((t) => t.roomTypeId === IND.id)?.freeCount ?? 0
  check("G1 bloquear una habitación baja el cupo público en 1", Boolean(blockId) && after === before - 1, `${before}→${after}`)
  await staff("/api/room-blocks", { method: "POST", body: JSON.stringify({ action: "delete", id: blockId }) })
  blockId = null
  const restored = (await pub(`/api/public/hotel?checkIn=${I}&checkOut=${I2}`)).data.types.find((t) => t.roomTypeId === IND.id)?.freeCount ?? 0
  check("G2 al quitar el bloqueo el cupo se restaura", restored === before)

  // ============ H. Ciclo operativo completo (recepción) ============
  const J = plus(190), J2 = plus(191)
  const suite = rooms.filter((x) => x.roomTypeId === types["Suite Ejecutiva"].id)[0]
  let hr = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: suite.id, roomTypeId: suite.roomTypeId, guestName: "QA Operación BORRAR", guestPhone: "0000000", checkInDate: J, checkOutDate: J2, ratePerNight: 220 }) })
  const opResv = hr.data?.reservation
  if (opResv) createdReservations.push({ id: opResv.id })
  check("H1 reserva staff en suite", Boolean(opResv?.id))
  // solape en la misma habitación → 409
  hr = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: suite.id, roomTypeId: suite.roomTypeId, guestName: "QA Solape", guestPhone: "0000000", checkInDate: J, checkOutDate: J2, ratePerNight: 220 }) })
  check("H2 solape misma habitación → 409", hr.status === 409, hr.data?.error)

  let f = await staff("/api/folios", { method: "POST", body: JSON.stringify({ action: "open", reservationId: opResv.id, guest: { fullName: "QA Operación BORRAR", documentNumber: "V-QA-1" } }) })
  const folio = f.data?.folio
  check("H3 check-in abre folio con cargo de habitación", Boolean(folio?.id) && f.data.balance === 220, `balance=$${f.data?.balance}`)
  f = await staff("/api/folios", { method: "POST", body: JSON.stringify({ action: "charge", folioId: folio.id, reservationId: opResv.id, amount: 45, category: "restaurante", description: "QA room service" }) })
  check("H4 cargo de room service", f.data?.balance === 265, `balance=$${f.data?.balance}`)
  f = await staff("/api/folios", { method: "POST", body: JSON.stringify({ action: "close", folioId: folio.id, reservationId: opResv.id }) })
  check("H5 checkout con saldo pendiente → 409", f.status === 409, f.data?.error)
  f = await staff("/api/folios", { method: "POST", body: JSON.stringify({ action: "payment", folioId: folio.id, reservationId: opResv.id, amount: 265, method: "tarjeta" }) })
  check("H6 pago total deja saldo 0", f.data?.balance === 0)
  f = await staff("/api/folios", { method: "POST", body: JSON.stringify({ action: "close", folioId: folio.id, reservationId: opResv.id }) })
  check("H7 checkout con saldo 0 cierra", f.status === 200)
  const hk = (await staff("/api/housekeeping")).data
  const hkRoom = hk.rooms.find((x) => x.id === suite.id)
  const hkTask = hk.tasks.find((t) => t.roomId === suite.id && t.status !== "hecha")
  check("H8 checkout encola limpieza de salida", hkRoom?.housekeepingStatus === "sucia" && hkTask?.type === "salida")
  if (hkTask) await staff("/api/housekeeping", { method: "POST", body: JSON.stringify({ action: "deleteTask", id: hkTask.id }) })
  await staff("/api/housekeeping", { method: "POST", body: JSON.stringify({ action: "setRoomStatus", roomId: suite.id, status: "limpia" }) })

  // ============ I. Reportes y APIs del panel con 25 habitaciones ============
  const rep = (await staff(`/api/hotel-reports?from=${plus(1)}&to=${plus(2)}`)).data
  const availableNights = rep?.report?.roomNightsAvailable
  check("I1 reporte: 25 noches disponibles en 1 día", availableNights === 25 && rep?.report?.roomCount === 25, `roomNightsAvailable=${availableNights}`)

  for (const [name, path] of [
    ["housekeeping", "/api/housekeeping"],
    ["cierre de día", `/api/night-audit?date=${iso(new Date())}`],
    ["facturación", "/api/invoices"],
    ["temporadas", "/api/rate-seasons"],
    ["servicios resort", "/api/resort-services"],
    ["reseñas staff", "/api/reviews"],
    ["CRM", "/api/guest-profiles"],
    ["paquetes", "/api/packages"],
    ["notificaciones", "/api/notifications"],
    ["pagos online", "/api/reservation-payments"],
  ]) {
    const resp = await staff(path)
    check(`I2 panel ${name} responde 200`, resp.status === 200, resp.status !== 200 ? `status=${resp.status}` : "")
  }
} finally {
  // ============ LIMPIEZA TOTAL ============
  results.push("— limpieza —")
  // resolver ids de las reservas públicas por código
  const all = (await staff(`/api/hotel-reservations?from=${plus(140)}&to=${plus(200)}`)).data.reservations || []
  for (const item of createdReservations) {
    if (!item.id && item.code) item.id = all.find((x) => x.code === item.code)?.id
  }
  let cleaned = 0
  for (const item of createdReservations) {
    if (!item.id) continue
    const del = await staff(`/api/hotel-reservations/${item.id}`, { method: "DELETE" })
    if (del.status === 200) cleaned++
    else {
      await staff(`/api/hotel-reservations/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelada" }) })
      const retry = await staff(`/api/hotel-reservations/${item.id}`, { method: "DELETE" })
      if (retry.status === 200) cleaned++
    }
  }
  if (restrictionId) await staff("/api/rate-restrictions", { method: "POST", body: JSON.stringify({ action: "delete", id: restrictionId }) })
  if (blockId) await staff("/api/room-blocks", { method: "POST", body: JSON.stringify({ action: "delete", id: blockId }) })
  // reseñas QA fuera (si el módulo de moderación permite borrar)
  const reviews = (await staff("/api/reviews")).data?.reviews || []
  for (const rev of reviews.filter((x) => String(x.comment || "").includes("QA BORRAR"))) {
    await staff("/api/reviews", { method: "POST", body: JSON.stringify({ action: "delete", id: rev.id }) })
  }
  results.push(`Reservas QA borradas: ${cleaned}/${createdReservations.filter((x) => x.id).length}`)
}

console.log(results.join("\n"))
console.log(`\n${failures === 0 ? "🟢 TODO PERFECTO" : `🔴 ${failures} FALLO(S)`} — ${results.filter((l) => l.startsWith("✅")).length} checks OK`)
process.exit(failures === 0 ? 0 : 1)
