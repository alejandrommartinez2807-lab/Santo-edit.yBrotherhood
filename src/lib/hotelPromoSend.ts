// ============================================================
// Hotel · Envío de promociones por WhatsApp — lógica PURA.
//
// Toma las filas de campaña (ya segmentadas) + la plantilla de mensaje y arma
// los "trabajos" de envío: teléfono normalizado, mensaje renderizado por
// huésped y los parámetros de la plantilla de marketing. Deduplica teléfonos
// y respeta un tope de destinatarios. Sin base de datos ni red: fácil de testear.
// El envío real (API de Meta) y el registro anti-duplicado los hace el servidor.
// ============================================================

import { normalizePhoneKey, renderCampaignTemplate } from "@/lib/hotelCampaigns"

export type CampaignRowLike = {
  name: string
  phone: string
}

export type CampaignSendJob = {
  phoneKey: string // solo dígitos (clave de dedupe y de la bitácora)
  phone: string // tal como se escribió (para normalizar al formato de la API)
  name: string // primer nombre del huésped
  text: string // mensaje renderizado (ruta de texto libre, ventana 24 h)
  templateParams: string[] // [primerNombre, hotel] (ruta de plantilla de marketing)
}

export const CAMPAIGN_MAX_RECIPIENTS = 500

function firstNameOf(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || ""
}

/** Un teléfono usable tiene al menos 7 dígitos; la API hace la validación final. */
export function hasUsablePhone(phone: string): boolean {
  return normalizePhoneKey(phone).length >= 7
}

export function buildCampaignSendJobs(input: {
  rows: CampaignRowLike[]
  templateText: string
  hotelName: string
  maxRecipients?: number
}): { jobs: CampaignSendJob[]; truncated: boolean; skippedNoPhone: number } {
  const max = Math.max(1, input.maxRecipients || CAMPAIGN_MAX_RECIPIENTS)
  const seen = new Set<string>()
  const jobs: CampaignSendJob[] = []
  let skippedNoPhone = 0
  let truncated = false

  for (const row of input.rows || []) {
    const phoneKey = normalizePhoneKey(row.phone)
    if (phoneKey.length < 7) {
      skippedNoPhone += 1
      continue
    }
    if (seen.has(phoneKey)) continue
    seen.add(phoneKey)

    if (jobs.length >= max) {
      truncated = true
      break
    }

    const first = firstNameOf(row.name)
    jobs.push({
      phoneKey,
      phone: String(row.phone || "").trim(),
      name: first,
      text: renderCampaignTemplate(input.templateText, { nombre: first, hotel: input.hotelName }),
      templateParams: [first || "huésped", String(input.hotelName || "").trim()],
    })
  }

  return { jobs, truncated, skippedNoPhone }
}

/** Hash estable corto de un texto (para diferenciar campañas manuales del día). */
export function shortHash(text: string): string {
  let h = 2166136261
  const s = String(text || "")
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

/**
 * Clave de periodo para una campaña MANUAL: mismo mensaje el mismo día = no se
 * reenvía (evita el doble-clic); un mensaje distinto el mismo día sí se permite.
 */
export function manualCampaignPeriodKey(todayISO: string, templateText: string): string {
  const day = String(todayISO || "").slice(0, 10)
  return `m:${day}:${shortHash(templateText)}`
}
