import {
  getBusinessConfig,
  getGuestMemberships,
  getGuestProfiles,
  getGuests,
  getHotelReservations,
  getSentPromoKeys,
  logPromoSend,
  promoKeyOf,
} from "@/lib/orders"
import { buildCampaignRows } from "@/lib/hotelCampaigns"
import { planAutoPromos, type AutoPromoKind } from "@/lib/hotelAutoPromos"
import {
  getCampaignTemplateName,
  isWhatsAppBusinessConfigured,
  normalizePhoneForWhatsAppApi,
  sendWhatsAppBusinessCampaignTemplate,
  sendWhatsAppBusinessText,
} from "@/lib/whatsappBusiness"

// ============================================================
// Ejecuta el envío de promociones por WhatsApp: recorre los trabajos, saca los
// ya enviados (bitácora), manda por la API (plantilla de marketing si está
// configurada → llega a todos; si no, texto libre → solo ventana 24 h) y
// registra cada envío exitoso para no repetir. Lo usan el botón manual de
// campañas y el cron de promos automáticas.
// ============================================================

export type PromoJob = {
  phoneKey: string
  phone: string
  guestName?: string
  text: string
  templateParams: string[]
  promoKind: string
  periodKey: string
}

export type PromoDispatchResult = {
  attempted: number
  sent: number
  failed: number
  alreadySent: number
  invalidPhone: number
  usedTemplate: boolean
  errors: string[]
}

/** Modo de envío legible para la UI. */
export function campaignSendMode(): "template" | "freetext" | "off" {
  if (!isWhatsAppBusinessConfigured()) return "off"
  return getCampaignTemplateName() ? "template" : "freetext"
}

export async function dispatchPromoJobs(
  jobs: PromoJob[],
  branchId?: string | null,
  opts?: { sentSet?: Set<string> },
): Promise<PromoDispatchResult> {
  const result: PromoDispatchResult = {
    attempted: jobs.length,
    sent: 0,
    failed: 0,
    alreadySent: 0,
    invalidPhone: 0,
    usedTemplate: Boolean(getCampaignTemplateName()),
    errors: [],
  }

  if (!isWhatsAppBusinessConfigured()) {
    result.errors.push("WhatsApp Business no está configurado")
    return result
  }

  // Envíos previos (otras corridas / clics) para no repetir. Se va ampliando
  // dentro del lote para blindar duplicados en la misma corrida.
  const sentSet = opts?.sentSet ?? (await getSentPromoKeys(branchId))
  const useTemplate = result.usedTemplate

  for (const job of jobs) {
    const key = promoKeyOf(job.promoKind, job.periodKey, job.phoneKey)
    if (sentSet.has(key)) {
      result.alreadySent += 1
      continue
    }
    const to = normalizePhoneForWhatsAppApi(job.phone)
    if (!to) {
      result.invalidPhone += 1
      continue
    }

    const sendResult = useTemplate
      ? await sendWhatsAppBusinessCampaignTemplate(job.phone, job.templateParams)
      : await sendWhatsAppBusinessText(job.phone, job.text)

    if (sendResult.ok) {
      result.sent += 1
      sentSet.add(key)
      // Registrar solo tras el envío exitoso (así un fallo se puede reintentar).
      await logPromoSend(
        {
          phoneKey: job.phoneKey,
          promoKind: job.promoKind,
          periodKey: job.periodKey,
          guestName: job.guestName,
        },
        branchId,
      ).catch(() => ({ inserted: false }))
    } else {
      result.failed += 1
      if (sendResult.error && result.errors.length < 5) result.errors.push(sendResult.error)
    }
  }

  return result
}

export type AutoPromosRunResult = {
  planned: number
  byKind: Record<AutoPromoKind, number>
  dispatch: PromoDispatchResult
}

/**
 * Corre las promociones automáticas de HOY para una sede: junta la base de
 * huéspedes, planifica según la config y despacha. Lo llaman el cron y el
 * botón "enviar las de hoy" del panel.
 */
export async function runAutoPromos(
  branchId?: string | null,
  todayISO?: string,
): Promise<AutoPromosRunResult> {
  const today = String(todayISO || new Date().toISOString().slice(0, 10)).slice(0, 10)
  const [profiles, guests, reservations, memberships, config, sentSet] = await Promise.all([
    getGuestProfiles(branchId),
    getGuests(branchId).catch(() => []),
    getHotelReservations({}, branchId).catch(() => []),
    getGuestMemberships(branchId).catch(() => []),
    getBusinessConfig(),
    getSentPromoKeys(branchId),
  ])
  const rows = buildCampaignRows({ profiles, guests, reservations, memberships, todayISO: today })
  const planned = planAutoPromos({
    rows,
    todayISO: today,
    config: config.hotelAutoPromos,
    hotelName: config.businessName,
    sentKeys: sentSet,
  })
  const byKind: Record<AutoPromoKind, number> = {
    cumpleanos: 0,
    post_estadia: 0,
    inactivo: 0,
  }
  for (const job of planned) byKind[job.promoKind] += 1

  const dispatch = await dispatchPromoJobs(planned, branchId, { sentSet })
  return { planned: planned.length, byKind, dispatch }
}
