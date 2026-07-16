import { NextRequest, NextResponse } from "next/server"
import {
  createServiceBooking,
  deleteHotelReservation,
  getBusinessConfig,
  getHotelReservations,
  getPackages,
  getRateRestrictions,
  getRateSeasons,
  getResortServices,
  getRoomBlocks,
  getRoomTypes,
  getRooms,
  findGuestMembershipByCode,
  getMemberships,
  recordGuestPassUse,
  saveHotelReservation,
} from "@/lib/orders"
import { isGuestMembershipActive, normalizeDiscountPct } from "@/lib/hotelMemberships"
import { dispatchHotelWebhooks } from "@/lib/hotelWebhookDispatch"
import { evaluateStayRestrictions } from "@/lib/rateRestrictions"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import {
  isValidStayRange,
  nightsBetween,
  normalizeStayDate,
  type ConflictCandidate,
} from "@/lib/hotelReservationConflicts"
import { getReservationNow } from "@/lib/reservationConflicts"
import { availableTypesForStay, pickFreeRoomOfType } from "@/lib/hotelAvailability"
import {
  DEFAULT_HOTEL_TERMS,
  HOTEL_BOOKING_FIELD_DEFINITIONS,
  type HotelBookingFieldsConfig,
} from "@/lib/hotelBooking"
import { quoteStay } from "@/lib/rateSeasons"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Motor de reservas PÚBLICO del hotel (Fase 8). El huésped consulta tipos
// disponibles con precio (temporadas) y reserva. No expone habitaciones
// individuales; al reservar el sistema asigna una libre del tipo y crea una
// reserva `source='web'` en estado pendiente, que aparece en el módulo Reservas
// del hotel para que recepción la confirme.

const MAX_DAYS_AHEAD = 365

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  return NextResponse.json(data, { ...init, headers })
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

async function getBookingContext() {
  const config = await getBusinessConfig()
  const raw = config as unknown as Record<string, unknown>
  const access = getModulePlanAccess(raw, "bookingEngine")
  const servicesAccess = getModulePlanAccess(raw, "resortServices")
  const packagesAccess = getModulePlanAccess(raw, "hotelPackages")
  const membershipsAccess = getModulePlanAccess(raw, "guestMemberships")
  return {
    enabled: access.includedInPlan && access.effectiveEnabled,
    membershipsEnabled: membershipsAccess.includedInPlan && membershipsAccess.effectiveEnabled,
    bookingFields: config.hotelBookingFields as HotelBookingFieldsConfig,
    termsText: config.hotelTermsText || DEFAULT_HOTEL_TERMS,
    roomTypeDetails: config.hotelRoomTypeDetails,
    upsell: config.hotelUpsell,
    servicesEnabled: servicesAccess.includedInPlan && servicesAccess.effectiveEnabled,
    packagesEnabled: packagesAccess.includedInPlan && packagesAccess.effectiveEnabled,
  }
}

// Catálogo de extras que se ofrecen al reservar (servicios y paquetes activos,
// con su foto si el dueño la configuró). Falla suave: sin extras, la reserva
// de habitación sigue funcionando igual.
async function getUpsellCatalog(
  context: Awaited<ReturnType<typeof getBookingContext>>,
  branchId: string | null,
) {
  const { upsell } = context
  const wantServices = context.servicesEnabled && upsell.showServices
  const wantPackages = context.packagesEnabled && upsell.showPackages
  try {
    const [services, packages] = await Promise.all([
      wantServices ? getResortServices(branchId) : Promise.resolve([]),
      wantPackages ? getPackages(branchId) : Promise.resolve([]),
    ])
    return {
      style: upsell.style,
      services: services
        .filter((s) => s.active)
        .map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          description: s.description,
          price: s.price,
          durationMin: s.durationMin,
          imageUrl: upsell.style === "fotos" ? upsell.serviceImages[s.id] || "" : "",
        })),
      packages: packages
        .filter((p) => p.active)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          includes: p.includes,
          price: p.price,
          imageUrl: upsell.style === "fotos" ? upsell.packageImages[p.id] || "" : "",
        })),
    }
  } catch (error) {
    captureError(error, { route: "/api/public/hotel", action: "upsell-catalog" })
    return { style: upsell.style, services: [], packages: [] }
  }
}

// Resuelve el beneficio de membresía desde el código propio o el pase de
// invitado (si el módulo está activo, la membresía vale y no venció). El
// descuento es SUGERIDO: se anota en la reserva y recepción lo confirma.
async function resolveMembershipBenefit(code: string, branchId: string | null) {
  const clean = cleanText(code)
  if (!clean) return null
  const match = await findGuestMembershipByCode(clean, branchId)
  if (!match) return null
  if (!isGuestMembershipActive(match.guestMembership, getReservationNow().date)) return null
  const memberships = await getMemberships(branchId)
  const membership = memberships.find((m) => m.id === match.guestMembership.membershipId)
  if (!membership || !membership.active) return null
  return {
    guestMembership: match.guestMembership,
    viaPass: match.viaPass,
    membership,
    discountPct: normalizeDiscountPct(membership.discountPct),
  }
}

function toCandidates(
  reservations: Array<{ id: string; roomId: string; checkInDate: string; checkOutDate: string; status: string }>,
): ConflictCandidate[] {
  return reservations.map((r) => ({
    id: r.id,
    roomId: r.roomId,
    checkInDate: r.checkInDate,
    checkOutDate: r.checkOutDate,
    status: r.status,
  }))
}

// GET ?checkIn=&checkOut= : tipos disponibles con precio para el rango.
export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-get",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas. Espera unos segundos e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const context = await getBookingContext()
    const { enabled, bookingFields, termsText, roomTypeDetails } = context
    if (!enabled) return noStoreResponse({ ok: true, enabled: false, types: [] })

    const checkIn = normalizeStayDate(request.nextUrl.searchParams.get("checkIn"))
    const checkOut = normalizeStayDate(request.nextUrl.searchParams.get("checkOut"))
    if (!isValidStayRange({ checkIn, checkOut })) {
      return noStoreResponse({ ok: true, enabled: true, nights: 0, types: [], bookingFields, termsText })
    }

    const branchId = await resolveBranchId(request)
    const [rooms, roomTypes, reservations, seasons, blocks, restrictions] = await Promise.all([
      getRooms(branchId),
      getRoomTypes(branchId),
      getHotelReservations({ from: checkIn, to: checkOut }, branchId),
      getRateSeasons(branchId),
      getRoomBlocks({ from: checkIn, to: checkOut }, branchId),
      getRateRestrictions(branchId),
    ])

    const types = availableTypesForStay({
      rooms,
      roomTypes,
      reservations: toCandidates(reservations),
      seasons,
      checkIn,
      checkOut,
      blocks,
      restrictions,
    })

    // Detalle comercial por tipo (camas, m², vista, amenidades) para que la
    // tarjeta pública venda de verdad, como en los motores de reserva reales.
    const typesWithDetails = types.map((t) => ({
      ...t,
      details: roomTypeDetails[t.roomTypeId] || null,
    }))

    // Extras para completar la estadía (servicios y paquetes del hotel).
    const upsellCatalog = await getUpsellCatalog(context, branchId)

    return noStoreResponse({
      ok: true,
      enabled: true,
      nights: nightsBetween(checkIn, checkOut),
      types: typesWithDetails,
      bookingFields,
      termsText,
      upsell: upsellCatalog,
    })
  } catch (error) {
    captureError(error, { route: "/api/public/hotel", action: "GET" })
    return noStoreResponse({ ok: false, error: "No se pudo consultar la disponibilidad" }, { status: 500 })
  }
}

// POST : crea la reserva pública (pendiente, source='web').
export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-post",
    limit: 8,
    windowMs: 60_000,
    message: "Demasiadas reservas seguidas. Espera un minuto e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const context = await getBookingContext()
    const { enabled, bookingFields } = context
    if (!enabled) {
      return noStoreResponse(
        { ok: false, error: "Las reservas online no están disponibles por ahora" },
        { status: 403 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const guestName = cleanText(body.guestName).slice(0, 80)
    const guestPhone = cleanText(body.guestPhone).slice(0, 25)
    const guestEmail = cleanText(body.guestEmail).slice(0, 120)
    const note = cleanText(body.note).slice(0, 200)
    const roomTypeId = cleanText(body.roomTypeId)

    // Campos extra según lo que el dueño configuró (cédula, dirección…).
    // Los apagados se ignoran aunque el cliente los envíe.
    const extraValues: Record<string, string> = {
      document: cleanText(body.document).slice(0, 30),
      email: guestEmail,
      address: cleanText(body.address).slice(0, 160),
      arrivalTime: cleanText(body.arrivalTime).slice(0, 20),
      requests: note,
    }
    for (const field of HOTEL_BOOKING_FIELD_DEFINITIONS) {
      const mode = bookingFields[field.id]
      if (mode === "off") extraValues[field.id] = ""
      if (mode === "required" && !extraValues[field.id]) {
        return noStoreResponse(
          { ok: false, error: `Falta un dato obligatorio: ${field.label.toLowerCase()}` },
          { status: 400 },
        )
      }
    }
    if (bookingFields.email === "required" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extraValues.email)) {
      return noStoreResponse({ ok: false, error: "Escribe un email válido" }, { status: 400 })
    }
    const adults = Math.min(Math.max(1, Number(body.adults) || 2), 20)
    const children = Math.min(Math.max(0, Number(body.children) || 0), 20)
    const checkIn = normalizeStayDate(body.checkIn)
    const checkOut = normalizeStayDate(body.checkOut)

    // El huésped debe aceptar los términos y condiciones (checkbox del
    // formulario); el servidor lo exige aunque manipulen el cliente.
    if (body.termsAccepted !== true) {
      return noStoreResponse(
        { ok: false, error: "Debes aceptar los términos y condiciones para reservar" },
        { status: 400 },
      )
    }

    if (guestName.length < 3) {
      return noStoreResponse({ ok: false, error: "Escribe tu nombre completo" }, { status: 400 })
    }
    if (guestPhone.replace(/\D+/g, "").length < 7) {
      return noStoreResponse(
        { ok: false, error: "Escribe un teléfono válido para confirmarte la reserva" },
        { status: 400 },
      )
    }
    if (!roomTypeId) {
      return noStoreResponse({ ok: false, error: "Elige un tipo de habitación" }, { status: 400 })
    }
    if (!isValidStayRange({ checkIn, checkOut })) {
      return noStoreResponse(
        { ok: false, error: "Revisa las fechas: la salida debe ser al menos una noche después de la entrada." },
        { status: 400 },
      )
    }

    // Solo desde hoy (hora Caracas) y con tope de un año.
    const now = getReservationNow()
    if (checkIn < now.date) {
      return noStoreResponse({ ok: false, error: "La fecha de entrada ya pasó" }, { status: 400 })
    }
    const maxDate = new Date(`${now.date}T00:00:00-04:00`)
    maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD)
    if (checkIn > maxDate.toISOString().slice(0, 10)) {
      return noStoreResponse(
        { ok: false, error: "Solo aceptamos reservas dentro del próximo año" },
        { status: 400 },
      )
    }

    const branchId = await resolveBranchId(request)
    // Código de membresía / pase de invitado (solo si el módulo está activo).
    const membershipCode = context.membershipsEnabled ? cleanText(body.membershipCode).slice(0, 40) : ""
    // El catálogo de extras y la membresía se traen AQUÍ (en paralelo) y no
    // después del chequeo de disponibilidad: cualquier await entre
    // pickFreeRoomOfType y el insert ensancha la ventana de doble reserva
    // (lo vigila el QA E2/E3).
    const [rooms, roomTypes, reservations, seasons, blocks, restrictions, upsellCatalog, membershipBenefit] =
      await Promise.all([
        getRooms(branchId),
        getRoomTypes(branchId),
        getHotelReservations({ from: checkIn, to: checkOut }, branchId),
        getRateSeasons(branchId),
        getRoomBlocks({ from: checkIn, to: checkOut }, branchId),
        getRateRestrictions(branchId),
        getUpsellCatalog(context, branchId),
        resolveMembershipBenefit(membershipCode, branchId).catch(() => null),
      ])

    const roomType = roomTypes.find((t) => t.id === roomTypeId)
    if (!roomType) {
      return noStoreResponse({ ok: false, error: "Ese tipo de habitación no existe" }, { status: 404 })
    }

    // Capacidad: el grupo debe caber en el tipo elegido (los niños cuentan).
    const capacity = Math.max(roomType.maxCapacity || roomType.baseCapacity || 1, 1)
    if (adults + children > capacity) {
      return noStoreResponse(
        {
          ok: false,
          error: `${roomType.name} aloja hasta ${capacity} persona(s). Elige otro tipo de habitación o reserva más de una.`,
        },
        { status: 400 },
      )
    }

    // Restricciones de venta (estancia mínima, cerrado a llegada/salida).
    const restriction = evaluateStayRestrictions({ restrictions, roomTypeId, checkIn, checkOut })
    if (!restriction.allowed) {
      return noStoreResponse({ ok: false, error: restriction.reason }, { status: 409 })
    }

    // Reconfirma disponibilidad justo antes de crear (evita doble reserva).
    const freeRoom = pickFreeRoomOfType({
      rooms,
      reservations: toCandidates(reservations),
      roomTypeId,
      checkIn,
      checkOut,
      blocks,
    })
    if (!freeRoom) {
      return noStoreResponse(
        { ok: false, error: "No queda una habitación de ese tipo en esas fechas. Prueba con otras fechas." },
        { status: 409 },
      )
    }

    const quote = quoteStay({
      baseRate: Math.max(0, Number(roomType.baseRate) || 0),
      roomTypeId,
      checkIn,
      checkOut,
      seasons,
    })

    // ---- Extras elegidos al reservar (servicios y paquete del hotel). Se
    // validan contra el catálogo activo; lo apagado se ignora en silencio. ----
    const requestedServices = Array.isArray(body.services) ? body.services.slice(0, 10) : []
    const selectedServices: { id: string; name: string; price: number; people: number }[] = []
    for (const rawService of requestedServices) {
      const item = (rawService && typeof rawService === "object" ? rawService : {}) as Record<
        string,
        unknown
      >
      const service = upsellCatalog.services.find((s) => s.id === cleanText(item.id))
      if (!service) continue
      const people = Math.min(Math.max(1, Number(item.people) || 1), 20)
      if (selectedServices.some((s) => s.id === service.id)) continue
      selectedServices.push({ id: service.id, name: service.name, price: service.price, people })
    }
    const selectedPackage = upsellCatalog.packages.find((p) => p.id === cleanText(body.packageId)) || null

    const servicesNote = selectedServices
      .map((s) => `${s.name}${s.people > 1 ? ` (${s.people}p)` : ""}`)
      .join(", ")
    const noteParts = [
      extraValues.email ? `Email: ${extraValues.email}` : "",
      extraValues.document ? `Documento: ${extraValues.document}` : "",
      extraValues.address ? `Dirección: ${extraValues.address}` : "",
      extraValues.arrivalTime ? `Llegada: ${extraValues.arrivalTime}` : "",
      selectedPackage ? `Paquete: ${selectedPackage.name} ($${selectedPackage.price})` : "",
      servicesNote ? `Servicios: ${servicesNote}` : "",
      membershipBenefit
        ? `Membresía ${membershipBenefit.membership.name}${membershipBenefit.membership.level ? ` ${membershipBenefit.membership.level}` : ""} (-${membershipBenefit.discountPct}% sugerido)${membershipBenefit.viaPass ? ` · Pase de ${membershipBenefit.guestMembership.guestName}` : ""}`
        : "",
      extraValues.requests,
    ].filter(Boolean)
    const reservation = await saveHotelReservation(
      {
        roomId: freeRoom.id,
        roomTypeId,
        guestName,
        guestPhone,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults,
        children,
        ratePerNight: quote.averageRate,
        status: "pendiente",
        source: "web",
        note: `[Web] ${noteParts.join(" · ")}`.trim(),
      },
      branchId,
    )

    // Doble chequeo OPTIMISTA contra carreras: si dos clientes pasaron el
    // chequeo de disponibilidad a la vez y ambos insertaron la misma
    // habitación, gana determinísticamente uno (created_at más antiguo; a
    // igualdad, id menor) y el resto revierte su reserva con 409. Ambas
    // peticiones aplican la MISMA regla, así que sobrevive exactamente una.
    const afterInsert = await getHotelReservations({ from: checkIn, to: checkOut }, branchId)
    const rivals = afterInsert.filter(
      (r) =>
        r.roomId === freeRoom.id &&
        r.id !== reservation.id &&
        r.status !== "cancelada" &&
        r.status !== "no_show" &&
        r.checkInDate < checkOut &&
        checkIn < r.checkOutDate,
    )
    const losesTo = (rival: (typeof rivals)[number]) =>
      rival.createdAt < reservation.createdAt ||
      (rival.createdAt === reservation.createdAt && rival.id < reservation.id)
    if (rivals.some(losesTo)) {
      await deleteHotelReservation(reservation.id, branchId).catch((error) =>
        captureError(error, { route: "/api/public/hotel", action: "race-rollback" }),
      )
      return noStoreResponse(
        { ok: false, error: "Esa habitación se acaba de ocupar. Prueba con otras fechas." },
        { status: 409 },
      )
    }

    // El pase de invitado usado suma un referido a la membresía (best-effort).
    if (membershipBenefit?.viaPass) {
      await recordGuestPassUse(
        membershipBenefit.guestMembership.id,
        `${guestName} · ${checkIn}`,
        branchId,
      ).catch((error) => captureError(error, { route: "/api/public/hotel", action: "membership-pass-use" }))
    }

    // Cada servicio queda como reserva de servicio VINCULADA a la estadía: al
    // hacer check-in aparece en el folio para cargarse a la cuenta del huésped.
    const bookedServices: { name: string; price: number; people: number; date: string }[] = []
    for (const service of selectedServices) {
      try {
        await createServiceBooking(
          {
            serviceId: service.id,
            reservationId: reservation.id,
            guestName,
            guestPhone,
            date: checkIn,
            people: service.people,
            note: `[Web] Reservado junto a la estadía #${reservation.code}`,
          },
          branchId,
        )
        bookedServices.push({
          name: service.name,
          price: service.price,
          people: service.people,
          date: checkIn,
        })
      } catch (error) {
        // La reserva de habitación ya existe; un extra fallido no la tumba.
        captureError(error, { route: "/api/public/hotel", action: "book-extra-service" })
      }
    }
    const extrasTotal =
      bookedServices.reduce((sum, s) => sum + s.price * s.people, 0) +
      (selectedPackage ? selectedPackage.price : 0)

    // Webhooks salientes (P2-E): la reserva ya está insertada; se awaitea
    // porque en serverless el trabajo suelto se congela al responder.
    await dispatchHotelWebhooks(
      "reserva_creada",
      {
        code: reservation.code,
        guestName: reservation.guestName,
        checkIn: reservation.checkInDate,
        checkOut: reservation.checkOutDate,
        nights: reservation.nights,
        roomType: roomType.name,
        totalAmount: reservation.totalAmount,
        source: "web",
      },
      branchId,
    )

    return noStoreResponse(
      {
        ok: true,
        reservation: {
          code: reservation.code,
          guestName: reservation.guestName,
          checkInDate: reservation.checkInDate,
          checkOutDate: reservation.checkOutDate,
          nights: reservation.nights,
          ratePerNight: reservation.ratePerNight,
          totalAmount: reservation.totalAmount,
          roomTypeName: roomType.name,
          services: bookedServices,
          packageName: selectedPackage?.name || "",
          packagePrice: selectedPackage?.price || 0,
          extrasTotal,
          membership: membershipBenefit
            ? {
                name: membershipBenefit.membership.name,
                discountPct: membershipBenefit.discountPct,
                viaPass: membershipBenefit.viaPass,
                referredBy: membershipBenefit.viaPass ? membershipBenefit.guestMembership.guestName : "",
              }
            : null,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    captureError(error, { route: "/api/public/hotel", action: "POST" })
    return noStoreResponse(
      { ok: false, error: "No se pudo registrar la reserva. Intenta de nuevo." },
      { status: 500 },
    )
  }
}
