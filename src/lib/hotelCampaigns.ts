// ============================================================
// Hotel · P2-D · Campañas / listas segmentadas desde el CRM — lógica PURA.
//
// Une las tres fuentes de huéspedes (fichas CRM, fichas legales de check-in y
// reservas) en una sola lista deduplicada, la filtra por criterios de campaña
// (estadía entre fechas, gasto mínimo, cumpleaños del mes, membresía) y
// renderiza plantillas de mensaje con variables {nombre} y {hotel}.
// Sin base de datos: todo entra por parámetro y es fácil de testear.
// ============================================================

import { isGuestMembershipActive } from "@/lib/hotelMemberships"

export type CampaignSourceProfile = {
  id?: string
  fullName: string
  phone: string
  email?: string
  tags?: string
  vip?: boolean
}

export type CampaignSourceGuest = {
  fullName: string
  phone: string
  email?: string
  birthDate?: string // ISO yyyy-mm-dd (vacío si no se conoce)
}

export type CampaignSourceReservation = {
  guestName: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
  status: string
  totalAmount: number
}

export type CampaignSourceMembership = {
  guestProfileId?: string
  guestName: string
  active?: boolean
  expiresAt?: string | null
}

export type CampaignGuestRow = {
  name: string
  phone: string
  email: string
  tags: string
  vip: boolean
  stays: number
  totalSpent: number
  lastCheckIn: string
  birthMonth: number | null // 1-12
  isMember: boolean
  stayRanges: { checkIn: string; checkOut: string }[]
}

export type CampaignFilters = {
  stayedFrom?: string
  stayedTo?: string
  minSpent?: number
  birthdayMonth?: number | null
  membership?: "member" | "nonmember" | ""
  vipOnly?: boolean
}

// Estados de reserva que NO cuentan como estadía real.
const NON_STAY_STATUSES = new Set(["cancelada", "no_show"])

export function normalizePhoneKey(phone: unknown): string {
  return String(phone || "").replace(/\D/g, "")
}

function nameKey(name: unknown): string {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ")
}

function birthMonthOf(birthDate?: string): number | null {
  const iso = String(birthDate || "").slice(0, 10)
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(iso)
  if (!m) return null
  const month = Number(m[1])
  return month >= 1 && month <= 12 ? month : null
}

/**
 * Une fichas CRM + fichas legales + reservas en filas únicas de campaña.
 * Deduplica por teléfono (solo dígitos) y, si no hay teléfono, por nombre.
 */
export function buildCampaignRows(input: {
  profiles: CampaignSourceProfile[]
  guests?: CampaignSourceGuest[]
  reservations?: CampaignSourceReservation[]
  memberships?: CampaignSourceMembership[]
  todayISO?: string
}): CampaignGuestRow[] {
  const rows = new Map<string, CampaignGuestRow>()
  const keyFor = (phone: unknown, name: unknown) => {
    const p = normalizePhoneKey(phone)
    return p ? `p:${p}` : `n:${nameKey(name)}`
  }

  const ensureRow = (name: string, phone: string): CampaignGuestRow => {
    const key = keyFor(phone, name)
    let row = rows.get(key)
    if (!row) {
      row = {
        name: String(name || "").trim(),
        phone: String(phone || "").trim(),
        email: "",
        tags: "",
        vip: false,
        stays: 0,
        totalSpent: 0,
        lastCheckIn: "",
        birthMonth: null,
        isMember: false,
        stayRanges: [],
      }
      rows.set(key, row)
    }
    return row
  }

  for (const p of input.profiles || []) {
    if (!String(p.fullName || "").trim()) continue
    const row = ensureRow(p.fullName, p.phone)
    row.email = row.email || String(p.email || "").trim()
    row.tags = row.tags || String(p.tags || "").trim()
    row.vip = row.vip || p.vip === true
  }

  for (const g of input.guests || []) {
    if (!String(g.fullName || "").trim()) continue
    const row = ensureRow(g.fullName, g.phone)
    row.email = row.email || String(g.email || "").trim()
    const month = birthMonthOf(g.birthDate)
    if (month && !row.birthMonth) row.birthMonth = month
  }

  for (const r of input.reservations || []) {
    if (!String(r.guestName || "").trim()) continue
    if (NON_STAY_STATUSES.has(String(r.status || "").trim())) continue
    const row = ensureRow(r.guestName, r.guestPhone)
    row.stays += 1
    row.totalSpent = Math.round((row.totalSpent + Math.max(0, Number(r.totalAmount) || 0)) * 100) / 100
    row.stayRanges.push({ checkIn: r.checkInDate, checkOut: r.checkOutDate })
    if (r.checkInDate > row.lastCheckIn) row.lastCheckIn = r.checkInDate
  }

  const todayISO = String(input.todayISO || "").slice(0, 10) || new Date().toISOString().slice(0, 10)
  // Marca miembros: por id de ficha CRM cuando existe, si no por nombre.
  const memberProfileIds = new Set<string>()
  const memberNames = new Set<string>()
  for (const m of input.memberships || []) {
    if (!isGuestMembershipActive({ active: m.active, expiresAt: m.expiresAt }, todayISO)) continue
    if (String(m.guestProfileId || "").trim()) memberProfileIds.add(String(m.guestProfileId).trim())
    if (String(m.guestName || "").trim()) memberNames.add(nameKey(m.guestName))
  }
  const profileById = new Map((input.profiles || []).map((p) => [String(p.id || ""), p]))
  for (const id of memberProfileIds) {
    const p = profileById.get(id)
    if (p) ensureRow(p.fullName, p.phone).isMember = true
  }
  for (const row of rows.values()) {
    if (memberNames.has(nameKey(row.name))) row.isMember = true
  }

  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
}

export function filterCampaignRows(rows: CampaignGuestRow[], filters: CampaignFilters): CampaignGuestRow[] {
  const from = String(filters.stayedFrom || "").slice(0, 10)
  const to = String(filters.stayedTo || "").slice(0, 10)
  const minSpent = Math.max(0, Number(filters.minSpent) || 0)
  const month = filters.birthdayMonth && filters.birthdayMonth >= 1 && filters.birthdayMonth <= 12
    ? filters.birthdayMonth
    : null

  return rows.filter((row) => {
    if (from || to) {
      // Una estadía cuenta si toca el rango [from, to] (fechas ISO, inclusive).
      const hit = row.stayRanges.some((s) => {
        if (from && s.checkOut < from) return false
        if (to && s.checkIn > to) return false
        return true
      })
      if (!hit) return false
    }
    if (minSpent > 0 && row.totalSpent < minSpent) return false
    if (month && row.birthMonth !== month) return false
    if (filters.membership === "member" && !row.isMember) return false
    if (filters.membership === "nonmember" && row.isMember) return false
    if (filters.vipOnly && !row.vip) return false
    return true
  })
}

/** Teléfonos únicos (tal como se escribieron) separados por coma, listos para pegar. */
export function campaignPhoneList(rows: CampaignGuestRow[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of rows) {
    const key = normalizePhoneKey(row.phone)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(row.phone.trim())
  }
  return out.join(", ")
}

/** Reemplaza {nombre} y {hotel} en la plantilla (llaves literales, sin regex del usuario). */
export function renderCampaignTemplate(
  template: string,
  vars: { nombre?: string; hotel?: string },
): string {
  return String(template || "")
    .split("{nombre}").join(String(vars.nombre || "").trim())
    .split("{hotel}").join(String(vars.hotel || "").trim())
}

export type CampaignTemplate = { id: string; name: string; text: string }

export const DEFAULT_CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "regreso",
    name: "Invitación a volver",
    text: "Hola {nombre}, te extrañamos en {hotel}. Tenemos una tarifa especial para tu próxima visita. ¿Te reservamos?",
  },
  {
    id: "cumple",
    name: "Cumpleaños",
    text: "¡Feliz cumpleaños, {nombre}! En {hotel} queremos celebrarte: este mes tienes una atención especial esperándote.",
  },
  {
    id: "temporada",
    name: "Oferta de temporada",
    text: "Hola {nombre}, en {hotel} abrimos la temporada con precios especiales por pocos días. Responde este mensaje y te apartamos tu habitación.",
  },
]

export function normalizeCampaignTemplates(value: unknown): CampaignTemplate[] {
  if (!Array.isArray(value)) return DEFAULT_CAMPAIGN_TEMPLATES.map((t) => ({ ...t }))
  const out: CampaignTemplate[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const raw = item as Record<string, unknown>
    const text = String(raw.text || "").trim()
    if (!text) continue
    out.push({
      id: String(raw.id || "").trim() || `tpl-${out.length + 1}`,
      name: String(raw.name || "").trim() || `Plantilla ${out.length + 1}`,
      text: text.slice(0, 1000),
    })
  }
  return out.length > 0 ? out : DEFAULT_CAMPAIGN_TEMPLATES.map((t) => ({ ...t }))
}
