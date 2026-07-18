import { NextRequest, NextResponse } from "next/server"
import {
  deleteGuestProfile,
  getBusinessConfig,
  getGuestMemberships,
  getGuestProfiles,
  getGuests,
  getHotelReservations,
  saveBusinessConfig,
  saveGuestProfile,
} from "@/lib/orders"
import {
  buildCampaignRows,
  filterCampaignRows,
  normalizeCampaignTemplates,
  type CampaignFilters,
} from "@/lib/hotelCampaigns"
import { buildCampaignSendJobs, manualCampaignPeriodKey } from "@/lib/hotelPromoSend"
import { normalizeHotelAutoPromos } from "@/lib/hotelAutoPromos"
import { campaignSendMode, dispatchPromoJobs, runAutoPromos, type PromoJob } from "@/lib/promoDispatch"
import { isWhatsAppBusinessConfigured } from "@/lib/whatsappBusiness"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkGuestCrmAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

// Normaliza los filtros de campaña que llegan del cliente a CampaignFilters.
function readCampaignFilters(value: unknown): CampaignFilters {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const monthNum = Number(raw.birthdayMonth)
  const membership = cleanText(raw.membership)
  return {
    stayedFrom: cleanText(raw.stayedFrom).slice(0, 10),
    stayedTo: cleanText(raw.stayedTo).slice(0, 10),
    minSpent: Math.max(0, Number(raw.minSpent) || 0),
    birthdayMonth: monthNum >= 1 && monthNum <= 12 ? monthNum : null,
    membership: membership === "member" || membership === "nonmember" ? membership : "",
    vipOnly: raw.vipOnly === true,
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkGuestCrmAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)

    // Vista de campañas: une fichas + huéspedes legales + reservas y devuelve
    // las filas ya agregadas (estadías, gasto, cumpleaños, membresía) más las
    // plantillas de mensaje del negocio. El filtrado fino lo hace el cliente.
    if (request.nextUrl.searchParams.get("view") === "campaigns") {
      const [profiles, guests, reservations, memberships, config] = await Promise.all([
        getGuestProfiles(branchId),
        getGuests(branchId).catch(() => []),
        getHotelReservations({}, branchId).catch(() => []),
        getGuestMemberships(branchId).catch(() => []),
        getBusinessConfig(),
      ])
      const rows = buildCampaignRows({ profiles, guests, reservations, memberships })
      return NextResponse.json({
        ok: true,
        rows,
        templates: config.hotelCampaignTemplates,
        hotelName: config.businessName,
        whatsappReady: isWhatsAppBusinessConfigured(),
        sendMode: campaignSendMode(),
        autoPromos: config.hotelAutoPromos,
      })
    }

    const profiles = await getGuestProfiles(branchId)
    return NextResponse.json({ ok: true, profiles })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las fichas" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-guest-profiles-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de fichas. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkGuestCrmAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (cleanText(body.action) === "delete") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Ficha no indicada" }, { status: 400 })
      await deleteGuestProfile(id, branchId)
      return NextResponse.json({ ok: true })
    }

    // Guarda las plantillas de campaña ({nombre}, {hotel}) en business_config.
    if (cleanText(body.action) === "saveCampaignTemplates") {
      const templates = normalizeCampaignTemplates(body.templates)
      await saveBusinessConfig({ hotelCampaignTemplates: templates })
      return NextResponse.json({ ok: true, templates })
    }

    // Envía la campaña por WhatsApp al segmento (un clic). Rearma las filas en
    // el servidor (no confía en las del cliente) y despacha por la API de Meta.
    if (cleanText(body.action) === "sendCampaign") {
      if (!isWhatsAppBusinessConfigured()) {
        return NextResponse.json(
          { error: "Conecta WhatsApp Business para enviar (variables WHATSAPP_BUSINESS_*)." },
          { status: 400 },
        )
      }
      const templateText = cleanText(body.templateText)
      if (!templateText) {
        return NextResponse.json({ error: "Escribe el mensaje de la campaña." }, { status: 400 })
      }
      const filters = readCampaignFilters(body.filters)
      const [profiles, guests, reservations, memberships, config] = await Promise.all([
        getGuestProfiles(branchId),
        getGuests(branchId).catch(() => []),
        getHotelReservations({}, branchId).catch(() => []),
        getGuestMemberships(branchId).catch(() => []),
        getBusinessConfig(),
      ])
      const rows = filterCampaignRows(
        buildCampaignRows({ profiles, guests, reservations, memberships }),
        filters,
      )
      const { jobs, truncated, skippedNoPhone } = buildCampaignSendJobs({
        rows,
        templateText,
        hotelName: config.businessName,
      })
      const today = new Date().toISOString().slice(0, 10)
      const periodKey = manualCampaignPeriodKey(today, templateText)
      const promoJobs: PromoJob[] = jobs.map((j) => ({
        phoneKey: j.phoneKey,
        phone: j.phone,
        guestName: j.name,
        text: j.text,
        templateParams: j.templateParams,
        promoKind: "manual",
        periodKey,
      }))
      const dispatch = await dispatchPromoJobs(promoJobs, branchId)
      return NextResponse.json({
        ok: true,
        recipients: jobs.length,
        truncated,
        skippedNoPhone,
        ...dispatch,
      })
    }

    // Guarda la configuración de promociones automáticas.
    if (cleanText(body.action) === "saveAutoPromos") {
      const autoPromos = normalizeHotelAutoPromos(body.autoPromos)
      await saveBusinessConfig({ hotelAutoPromos: autoPromos })
      return NextResponse.json({ ok: true, autoPromos })
    }

    // Ejecuta AHORA las promos automáticas de hoy (para probar sin esperar al
    // cron). Respeta la config y la bitácora anti-duplicado.
    if (cleanText(body.action) === "runAutoPromosNow") {
      if (!isWhatsAppBusinessConfigured()) {
        return NextResponse.json(
          { error: "Conecta WhatsApp Business para enviar (variables WHATSAPP_BUSINESS_*)." },
          { status: 400 },
        )
      }
      const run = await runAutoPromos(branchId)
      return NextResponse.json({ ok: true, ...run })
    }

    const fullName = cleanText(body.fullName)
    if (!fullName) return NextResponse.json({ error: "Escribe el nombre del huésped" }, { status: 400 })

    const profile = await saveGuestProfile(
      {
        id: cleanText(body.id) || undefined,
        fullName,
        phone: cleanText(body.phone),
        email: cleanText(body.email),
        tags: cleanText(body.tags),
        vip: body.vip === true,
        notes: cleanText(body.notes),
      },
      branchId,
    )
    return NextResponse.json({ ok: true, profile }, { status: body.id ? 200 : 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la ficha" },
      { status: 500 }
    )
  }
}
