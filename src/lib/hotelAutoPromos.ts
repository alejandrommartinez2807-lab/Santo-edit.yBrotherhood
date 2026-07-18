// ============================================================
// Hotel · Promociones automáticas programadas — lógica PURA.
//
// Decide QUIÉN recibe QUÉ promoción hoy, sin base de datos ni red. Tres
// disparadores:
//   - cumpleanos   : huéspedes que cumplen años este mes.
//   - post_estadia : X días después del check-out (agradecer + volver).
//   - inactivo     : sin volver hace X meses (win-back).
// (La "oferta de temporada" es un envío puntual: se hace desde Campañas con el
// botón "Enviar por WhatsApp", no necesita disparador de calendario.)
//
// El envío real y el registro anti-duplicado los hace el servidor (dispatch).
// Aquí solo se ARMA la lista, deduplicando por la bitácora (sentKeys) para no
// repetir dentro del mismo periodo.
// ============================================================

import { addDaysISO } from "@/lib/rateSeasons"
import { normalizePhoneKey, renderCampaignTemplate } from "@/lib/hotelCampaigns"
import type { CampaignGuestRow } from "@/lib/hotelCampaigns"

export type AutoPromoKind = "cumpleanos" | "post_estadia" | "inactivo"

export type AutoPromoTriggerConfig = {
  enabled: boolean
  message: string
}

export type HotelAutoPromosConfig = {
  birthday: AutoPromoTriggerConfig
  postStay: AutoPromoTriggerConfig & { days: number }
  winback: AutoPromoTriggerConfig & { months: number }
}

export const DEFAULT_HOTEL_AUTO_PROMOS: HotelAutoPromosConfig = {
  birthday: {
    enabled: false,
    message:
      "¡Feliz cumpleaños, {nombre}! En {hotel} queremos celebrarte con una atención especial este mes. Responde este mensaje y te reservamos.",
  },
  postStay: {
    enabled: false,
    days: 7,
    message:
      "Hola {nombre}, gracias por hospedarte en {hotel}. Vuelve pronto: tenemos una tarifa especial para tu próxima visita. Responde este mensaje y te reservamos.",
  },
  winback: {
    enabled: false,
    months: 6,
    message:
      "Hola {nombre}, te extrañamos en {hotel}. Tenemos una oferta de regreso para tu próxima visita. ¿Te reservamos?",
  },
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function normalizeTrigger(
  value: unknown,
  fallback: AutoPromoTriggerConfig,
): AutoPromoTriggerConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const message = String(raw.message ?? "").trim()
  return {
    enabled: raw.enabled === true,
    message: (message || fallback.message).slice(0, 1000),
  }
}

export function normalizeHotelAutoPromos(value: unknown): HotelAutoPromosConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const postStayRaw = (raw.postStay && typeof raw.postStay === "object" ? raw.postStay : {}) as Record<string, unknown>
  const winbackRaw = (raw.winback && typeof raw.winback === "object" ? raw.winback : {}) as Record<string, unknown>
  return {
    birthday: normalizeTrigger(raw.birthday, DEFAULT_HOTEL_AUTO_PROMOS.birthday),
    postStay: {
      ...normalizeTrigger(raw.postStay, DEFAULT_HOTEL_AUTO_PROMOS.postStay),
      days: clampInt(postStayRaw.days, 1, 90, DEFAULT_HOTEL_AUTO_PROMOS.postStay.days),
    },
    winback: {
      ...normalizeTrigger(raw.winback, DEFAULT_HOTEL_AUTO_PROMOS.winback),
      months: clampInt(winbackRaw.months, 1, 36, DEFAULT_HOTEL_AUTO_PROMOS.winback.months),
    },
  }
}

/** Un trabajo de promo automática listo para despachar (mismo shape que PromoJob). */
export type PlannedPromo = {
  phoneKey: string
  phone: string
  guestName: string
  text: string
  templateParams: string[]
  promoKind: AutoPromoKind
  periodKey: string
}

function firstNameOf(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || ""
}

/** Resta `months` meses a una fecha ISO (yyyy-mm-dd), devuelve yyyy-mm-dd. */
export function subMonthsISO(iso: string, months: number): string {
  const base = String(iso || "").slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base)
  if (!m) return base
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

/**
 * Arma la lista de promos automáticas a enviar HOY. `sentKeys` es el conjunto
 * de claves ya enviadas (promoKind|periodKey|phoneKey) para no repetir.
 */
export function planAutoPromos(input: {
  rows: CampaignGuestRow[]
  todayISO: string
  config: HotelAutoPromosConfig
  hotelName: string
  sentKeys?: Set<string>
}): PlannedPromo[] {
  const today = String(input.todayISO || "").slice(0, 10)
  const month = Number(today.slice(5, 7))
  const hotelName = String(input.hotelName || "").trim()
  const sent = input.sentKeys ?? new Set<string>()
  const out: PlannedPromo[] = []
  const seenInBatch = new Set<string>()

  const push = (
    row: CampaignGuestRow,
    kind: AutoPromoKind,
    periodKey: string,
    message: string,
  ) => {
    const phoneKey = normalizePhoneKey(row.phone)
    if (phoneKey.length < 7) return
    const composite = `${kind}|${periodKey}|${phoneKey}`
    if (sent.has(composite) || seenInBatch.has(composite)) return
    seenInBatch.add(composite)
    const first = firstNameOf(row.name)
    out.push({
      phoneKey,
      phone: String(row.phone || "").trim(),
      guestName: first,
      text: renderCampaignTemplate(message, { nombre: first, hotel: hotelName }),
      templateParams: [first || "huésped", hotelName],
      promoKind: kind,
      periodKey,
    })
  }

  for (const row of input.rows || []) {
    // Cumpleaños del mes.
    if (input.config.birthday.enabled && row.birthMonth === month) {
      push(row, "cumpleanos", `bday:${today.slice(0, 7)}`, input.config.birthday.message)
    }

    // Post-estadía: check-out fue hace exactamente `days` días.
    if (input.config.postStay.enabled) {
      const target = addDaysISO(today, -input.config.postStay.days)
      const matched = (row.stayRanges || []).some((s) => String(s.checkOut || "").slice(0, 10) === target)
      if (matched) {
        push(row, "post_estadia", `post:${target}`, input.config.postStay.message)
      }
    }

    // Reactivar inactivos: última llegada anterior al umbral de meses. Una sola
    // promo por periodo de inactividad (clave atada a su última llegada).
    if (input.config.winback.enabled && row.stays > 0 && row.lastCheckIn) {
      const threshold = subMonthsISO(today, input.config.winback.months)
      if (row.lastCheckIn.slice(0, 10) <= threshold) {
        push(row, "inactivo", `winback:${row.lastCheckIn.slice(0, 10)}`, input.config.winback.message)
      }
    }
  }

  return out
}
