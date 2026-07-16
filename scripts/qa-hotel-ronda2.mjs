// ============================================================
// QA RONDA 2 — blindaje fino del PMS (casos que rompen sistemas reales)
// Rotación de huéspedes el mismo día, temporadas partidas, capacidad,
// fuera de servicio, no-show, cupos de spa, paquetes al folio, CRM,
// series con prefijo y borrados peligrosos. Limpia TODO al final.
// Requiere el dev server corriendo y .env.local en la raíz.
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

const cleanup = {
  reservationIds: [],
  roomIds: [],
  roomTypeIds: [],
  serviceId: null,
  bookingIds: [],
  packageId: null,
  guestProfileId: null,
  restoreRoom: null, // {id, payload} para revertir fuera de servicio
}

const roomsData = (await staff("/api/rooms")).data
const IND = roomsData.roomTypes.find((t) => t.name === "Individual")
const indRooms = roomsData.rooms.filter((r) => r.roomTypeId === IND.id && r.active && !r.outOfService)

try {
  // ---------- 1. Parámetros basura nunca dan 500 ----------
  let r = await pub("/api/public/hotel?checkIn=banana&checkOut=%00%22'--")
  check("1 GET con basura en fechas → 200 sin tipos", r.status === 200 && (r.data.types || []).length === 0)
  r = await pub(`/api/public/hotel?checkIn=${plus(30)}&checkOut=${plus(30)}`)
  check("2 entrada = salida (0 noches) → sin tipos", r.status === 200 && (r.data.types || []).length === 0)
  r = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: indRooms[0].id, roomTypeId: IND.id, guestName: "QA basura", guestPhone: "0000000", checkInDate: "banana", checkOutDate: "sandía", ratePerNight: 75 }) })
  check("3 staff con fechas basura → 400 con mensaje", r.status === 400, r.data?.error)

  // ---------- 2. Capacidad del grupo ----------
  r = await pub("/api/public/hotel", { method: "POST", body: JSON.stringify({ roomTypeId: IND.id, guestName: "Familia Grande QA", guestPhone: "04141230001", checkIn: plus(30), checkOut: plus(31), adults: 2, children: 2, termsAccepted: true }) })
  check("4 grupo de 4 en Individual (cap 1) → 400 claro", r.status === 400, r.data?.error)

  // ---------- 3. Nota kilométrica se trunca sin romper ----------
  r = await pub("/api/public/hotel", { method: "POST", body: JSON.stringify({ roomTypeId: IND.id, guestName: "Notas Largas QA", guestPhone: "04141230002", checkIn: plus(30), checkOut: plus(31), adults: 1, termsAccepted: true, note: "x".repeat(2000) }) })
  const noteResv = r.data?.reservation
  check("5 nota de 2000 caracteres → reserva creada igual", Boolean(noteResv?.code), `code=${noteResv?.code}`)
  if (noteResv) cleanup.reservationIds.push(null) // se resuelve por código al final
  const noteCode = noteResv?.code

  // ---------- 4. Rotación el mismo día (checkout exclusivo) ----------
  const K = plus(40), K2 = plus(42), K4 = plus(44)
  const roomR = indRooms[1]
  r = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: roomR.id, roomTypeId: IND.id, guestName: "QA Huésped Saliente", guestPhone: "0000000", checkInDate: K, checkOutDate: K2, ratePerNight: 75 }) })
  if (r.data?.reservation) cleanup.reservationIds.push(r.data.reservation.id)
  const out1 = r.status
  r = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: roomR.id, roomTypeId: IND.id, guestName: "QA Huésped Entrante", guestPhone: "0000000", checkInDate: K2, checkOutDate: K4, ratePerNight: 75 }) })
  if (r.data?.reservation) cleanup.reservationIds.push(r.data.reservation.id)
  check("6 sale a las 12 y entra otro el MISMO día → permitido", out1 === 201 && r.status === 201, `${out1}/${r.status}`)

  // ---------- 5. Temporada partida (una noche base + una en temporada) ----------
  // "Fin de Año" empieza el 15-dic: la noche del 14 es base y la del 15 ya no.
  r = await pub("/api/public/hotel?checkIn=2026-12-14&checkOut=2026-12-16")
  const split = (r.data?.types || []).find((t) => t.roomTypeId === IND.id)
  const expected = 75 + 75 * 1.35
  check("7 estadía que cruza el inicio de temporada cobra mixto", split && Math.abs(split.quote.total - expected) < 0.01, `total=$${split?.quote.total} (esperado $${expected})`)

  // ---------- 6. Fuera de servicio sale de la venta ----------
  const L = plus(50), L2 = plus(51)
  const before = (await pub(`/api/public/hotel?checkIn=${L}&checkOut=${L2}`)).data.types.find((t) => t.roomTypeId === IND.id)?.freeCount ?? 0
  const oos = indRooms[2]
  cleanup.restoreRoom = oos
  await staff("/api/rooms", { method: "POST", body: JSON.stringify({ id: oos.id, roomTypeId: oos.roomTypeId, name: oos.name, floor: oos.floor, capacity: oos.capacity, baseRate: oos.baseRate, housekeepingStatus: oos.housekeepingStatus, outOfService: true, amenities: oos.amenities, notes: oos.notes, active: true }) })
  const after = (await pub(`/api/public/hotel?checkIn=${L}&checkOut=${L2}`)).data.types.find((t) => t.roomTypeId === IND.id)?.freeCount ?? 0
  check("8 fuera de servicio baja el cupo público en 1", after === before - 1, `${before}→${after}`)
  await staff("/api/rooms", { method: "POST", body: JSON.stringify({ id: oos.id, roomTypeId: oos.roomTypeId, name: oos.name, floor: oos.floor, capacity: oos.capacity, baseRate: oos.baseRate, housekeepingStatus: oos.housekeepingStatus, outOfService: false, amenities: oos.amenities, notes: oos.notes, active: true }) })
  cleanup.restoreRoom = null
  const restored = (await pub(`/api/public/hotel?checkIn=${L}&checkOut=${L2}`)).data.types.find((t) => t.roomTypeId === IND.id)?.freeCount ?? 0
  check("9 al volver a servicio el cupo se restaura", restored === before)

  // ---------- 7. El no-show libera la habitación ----------
  const M = plus(60), M2 = plus(61)
  const roomN = indRooms[3]
  r = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: roomN.id, roomTypeId: IND.id, guestName: "QA No Show", guestPhone: "0000000", checkInDate: M, checkOutDate: M2, ratePerNight: 75 }) })
  const nsId = r.data?.reservation?.id
  if (nsId) cleanup.reservationIds.push(nsId)
  await staff(`/api/hotel-reservations/${nsId}`, { method: "PATCH", body: JSON.stringify({ status: "no_show" }) })
  r = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: roomN.id, roomTypeId: IND.id, guestName: "QA Reemplazo", guestPhone: "0000000", checkInDate: M, checkOutDate: M2, ratePerNight: 75 }) })
  if (r.data?.reservation) cleanup.reservationIds.push(r.data.reservation.id)
  check("10 tras marcar no-show la habitación se puede revender", r.status === 201, `status=${r.status}`)

  // ---------- 8. Cupo de servicios del resort (spa lleno) ----------
  r = await staff("/api/resort-services", { method: "POST", body: JSON.stringify({ action: "saveService", name: "QA Masaje BORRAR", kind: "spa", price: 30, capacity: 2 }) })
  cleanup.serviceId = r.data?.service?.id
  check("11 crear servicio con cupo 2", Boolean(cleanup.serviceId))
  const slotDate = plus(70)
  r = await staff("/api/resort-services", { method: "POST", body: JSON.stringify({ action: "createBooking", serviceId: cleanup.serviceId, date: slotDate, time: "10:00", people: 2, guestName: "QA Pareja" }) })
  if (r.data?.booking) cleanup.bookingIds.push(r.data.booking.id)
  const full = await staff("/api/resort-services", { method: "POST", body: JSON.stringify({ action: "createBooking", serviceId: cleanup.serviceId, date: slotDate, time: "10:00", people: 1, guestName: "QA Tercero" }) })
  check("12 franja llena → 409 con motivo", r.status === 201 && full.status === 409, full.data?.error)
  const other = await staff("/api/resort-services", { method: "POST", body: JSON.stringify({ action: "createBooking", serviceId: cleanup.serviceId, date: slotDate, time: "11:00", people: 2, guestName: "QA Otra Hora" }) })
  if (other.data?.booking) cleanup.bookingIds.push(other.data.booking.id)
  check("13 otra franja del mismo día sí acepta", other.status === 201)

  // ---------- 9. Paquete cargado al folio ----------
  r = await staff("/api/packages", { method: "POST", body: JSON.stringify({ action: "savePackage", name: "QA Romántico BORRAR", price: 50, description: "QA" }) })
  cleanup.packageId = r.data?.package?.id || r.data?.hotelPackage?.id
  const N = plus(80), N2 = plus(81)
  r = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: indRooms[4].id, roomTypeId: IND.id, guestName: "QA Paquete BORRAR", guestPhone: "0000000", checkInDate: N, checkOutDate: N2, ratePerNight: 75 }) })
  const pkgResv = r.data?.reservation
  if (pkgResv) cleanup.reservationIds.push(pkgResv.id)
  if (!pkgResv) throw new Error(`No se pudo crear la reserva del paquete (${r.status}: ${r.data?.error || "sin detalle"}); se aborta y se limpia.`)
  const noFolio = await staff("/api/packages", { method: "POST", body: JSON.stringify({ action: "applyToReservation", packageId: cleanup.packageId, reservationId: pkgResv.id }) })
  check("14 aplicar paquete SIN check-in → 409 claro", noFolio.status === 409, noFolio.data?.error)
  let f = await staff("/api/folios", { method: "POST", body: JSON.stringify({ action: "open", reservationId: pkgResv.id }) })
  const pkgFolio = f.data?.folio
  await staff("/api/packages", { method: "POST", body: JSON.stringify({ action: "applyToReservation", packageId: cleanup.packageId, reservationId: pkgResv.id }) })
  f = await staff(`/api/folios?reservationId=${pkgResv.id}`)
  check("15 paquete cargado al folio (habitación + paquete)", f.data?.balance === 75 + 50, `balance=$${f.data?.balance}`)
  for (const item of f.data?.items || []) {
    await staff("/api/folios", { method: "POST", body: JSON.stringify({ action: "deleteItem", itemId: item.id, folioId: pkgFolio.id, reservationId: pkgResv.id }) })
  }

  // ---------- 10. CRM: ficha de huésped ----------
  r = await staff("/api/guest-profiles", { method: "POST", body: JSON.stringify({ fullName: "QA VIP BORRAR", phone: "04140009999", vip: true, tags: "qa", notes: "borrar" }) })
  cleanup.guestProfileId = r.data?.profile?.id || r.data?.guestProfile?.id
  const list = await staff("/api/guest-profiles")
  const found = JSON.stringify(list.data || {}).includes("QA VIP BORRAR")
  check("16 CRM guarda y lista la ficha", Boolean(cleanup.guestProfileId) && found)

  // ---------- 11. Serie con prefijo + borrar tipo protegido ----------
  r = await staff("/api/rooms", { method: "POST", body: JSON.stringify({ kind: "roomType", name: "QA Cabaña BORRAR", baseRate: 99, baseCapacity: 2, maxCapacity: 2 }) })
  const qaTypeId = r.data?.roomType?.id
  cleanup.roomTypeIds.push(qaTypeId)
  r = await staff("/api/rooms", { method: "POST", body: JSON.stringify({ kind: "roomsBulk", roomTypeId: qaTypeId, fromNumber: 1, toNumber: 2, prefix: "QA-", floor: "0" }) })
  const qaRooms = r.data?.created || []
  for (const room of qaRooms) cleanup.roomIds.push(room.id)
  check("17 serie con prefijo crea QA-1 y QA-2", qaRooms.map((x) => x.name).join(",") === "QA-1,QA-2")
  const guarded = await staff(`/api/rooms/${qaTypeId}?kind=roomType`, { method: "DELETE" })
  check("18 borrar tipo CON habitaciones → 409 explicando cuáles", guarded.status === 409, guarded.data?.error)
  for (const room of qaRooms) await staff(`/api/rooms/${room.id}`, { method: "DELETE" })
  cleanup.roomIds = []
  const freed = await staff(`/api/rooms/${qaTypeId}?kind=roomType`, { method: "DELETE" })
  check("19 sin habitaciones el tipo sí se borra", freed.status === 200)
  if (freed.status === 200) cleanup.roomTypeIds = cleanup.roomTypeIds.filter((x) => x !== qaTypeId)

  // ---------- 12. La nota larga sigue consultable por el huésped ----------
  if (noteCode) {
    r = await pub("/api/public/hotel/lookup", { method: "POST", body: JSON.stringify({ code: noteCode, phone: "04141230002" }) })
    check("20 lookup de la reserva con nota truncada funciona", r.status === 200)
  }

  // ---------- 13. P1-A · Cobro online: el huésped reporta su abono ----------
  const PAY_PHONE = "04149000123"
  // Fechas dentro de la ventana de la Caja de recepción (±60 / +30 días) para
  // que el depósito aparezca con su reserva; loop para dar con una habitación libre.
  const P = plus(20), P2 = plus(22)
  let payResv = null
  for (const room of indRooms) {
    const cr = await staff("/api/hotel-reservations", { method: "POST", body: JSON.stringify({ roomId: room.id, roomTypeId: IND.id, guestName: "QA Abono BORRAR", guestPhone: PAY_PHONE, checkInDate: P, checkOutDate: P2, ratePerNight: 80 }) })
    if (cr.data?.reservation?.id) { payResv = cr.data.reservation; break }
  }
  if (payResv) cleanup.reservationIds.push(payResv.id)
  check("21 reserva para el cobro online creada", Boolean(payResv?.id))
  if (payResv) {
    // Reporte público SIN login (código + últimos 4 del teléfono).
    const pay = await pub("/api/public/hotel/pay", { method: "POST", body: JSON.stringify({ action: "report", code: payResv.code, phone: PAY_PHONE, amount: 60, method: "pago_movil", reference: "QA-ABONO" }) })
    check("22 abono reportado desde el teléfono → 201", pay.status === 201 && pay.data?.ok === true, `status=${pay.status} ${pay.data?.error || ""}`)
    const wrong = await pub("/api/public/hotel/pay", { method: "POST", body: JSON.stringify({ action: "report", code: payResv.code, phone: "04140000000", amount: 10 }) })
    check("23 abono con teléfono equivocado → 404", wrong.status === 404)
    // Cae como depósito por confirmar en Caja recepción (/api/folios/summary).
    const sum = await staff("/api/folios/summary")
    const pending = (sum.data?.depositsPending || []).find((d) => d.code === payResv.code)
    check("24 el abono aparece en Caja recepción (por confirmar)", Boolean(pending) && pending.amount === 60, pending ? `amount=${pending.amount}` : "no aparece")
    // Al confirmar entra en 'cobrado hoy' (mismo cálculo del Cierre del día).
    const pays = (await staff("/api/reservation-payments")).data?.payments || []
    const mine = pays.find((p) => p.reservationId === payResv.id)
    if (mine) await staff("/api/reservation-payments", { method: "POST", body: JSON.stringify({ action: "status", id: mine.id, status: "confirmado" }) })
    const sum2 = await staff("/api/folios/summary")
    const collected = (sum2.data?.collectedRows || []).find((row) => row.code === payResv.code && row.kind === "deposito")
    check("25 al confirmar entra en 'cobrado hoy' (Cierre)", Boolean(collected) && collected.amount === 60, collected ? `amount=${collected.amount}` : `cobradoHoy=${sum2.data?.totals?.collectedToday}`)
  }
} finally {
  results.push("— limpieza —")
  const all = (await staff(`/api/hotel-reservations?from=${plus(20)}&to=${plus(100)}`)).data.reservations || []
  const qaIds = new Set(cleanup.reservationIds.filter(Boolean))
  for (const resv of all) {
    if (qaIds.has(resv.id) || /QA |QA$|BORRAR|Notas Largas QA/.test(resv.guestName)) {
      const del = await staff(`/api/hotel-reservations/${resv.id}`, { method: "DELETE" })
      if (del.status !== 200) {
        await staff(`/api/hotel-reservations/${resv.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelada" }) })
        await staff(`/api/hotel-reservations/${resv.id}`, { method: "DELETE" })
      }
    }
  }
  for (const id of cleanup.bookingIds) {
    await staff("/api/resort-services", { method: "POST", body: JSON.stringify({ action: "deleteBooking", id }) })
  }
  if (cleanup.serviceId) await staff("/api/resort-services", { method: "POST", body: JSON.stringify({ action: "deleteService", id: cleanup.serviceId }) })
  if (cleanup.packageId) await staff("/api/packages", { method: "POST", body: JSON.stringify({ action: "deletePackage", id: cleanup.packageId }) })
  if (cleanup.guestProfileId) await staff("/api/guest-profiles", { method: "POST", body: JSON.stringify({ action: "delete", id: cleanup.guestProfileId }) })
  for (const id of cleanup.roomIds) await staff(`/api/rooms/${id}`, { method: "DELETE" })
  for (const id of cleanup.roomTypeIds) await staff(`/api/rooms/${id}?kind=roomType`, { method: "DELETE" })
  if (cleanup.restoreRoom) {
    const room = cleanup.restoreRoom
    await staff("/api/rooms", { method: "POST", body: JSON.stringify({ id: room.id, roomTypeId: room.roomTypeId, name: room.name, floor: room.floor, capacity: room.capacity, baseRate: room.baseRate, housekeepingStatus: room.housekeepingStatus, outOfService: false, amenities: room.amenities, notes: room.notes, active: true }) })
  }
  // verificación de que el hotel quedó como estaba
  const fin = (await staff("/api/rooms")).data
  results.push(`Estado final: ${fin.rooms.length} habitaciones · ${fin.roomTypes.length} tipos`)
}

console.log(results.join("\n"))
console.log(`\n${failures === 0 ? "🟢 RONDA 2 PERFECTA" : `🔴 ${failures} FALLO(S)`} — ${results.filter((l) => l.startsWith("✅")).length} checks OK`)
process.exit(failures === 0 ? 0 : 1)
