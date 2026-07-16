import { describe, expect, it } from "vitest"
import {
  buildCampaignRows,
  campaignPhoneList,
  filterCampaignRows,
  normalizeCampaignTemplates,
  renderCampaignTemplate,
  DEFAULT_CAMPAIGN_TEMPLATES,
} from "@/lib/hotelCampaigns"

const TODAY = "2026-07-16"

function baseRows() {
  return buildCampaignRows({
    profiles: [
      { id: "p1", fullName: "Ana Pérez", phone: "0414-111.1111", email: "ana@x.com", tags: "habitual", vip: true },
      { id: "p2", fullName: "Beto Díaz", phone: "0424 222 2222" },
    ],
    guests: [
      // Mismo teléfono de Ana con otro formato: debe fusionarse, no duplicarse.
      { fullName: "Ana Perez", phone: "(0414) 1111111", birthDate: "1990-07-20" },
      { fullName: "Caro Solo Ficha", phone: "0412-333-3333", birthDate: "1985-02-10" },
    ],
    reservations: [
      { guestName: "Ana Pérez", guestPhone: "04141111111", checkInDate: "2026-06-10", checkOutDate: "2026-06-12", status: "checkout", totalAmount: 200 },
      { guestName: "Ana Pérez", guestPhone: "04141111111", checkInDate: "2026-01-05", checkOutDate: "2026-01-08", status: "checkout", totalAmount: 300 },
      { guestName: "Ana Pérez", guestPhone: "04141111111", checkInDate: "2026-03-01", checkOutDate: "2026-03-02", status: "cancelada", totalAmount: 999 },
      // Huésped que solo existe por su reserva (sin ficha).
      { guestName: "Dani Reserva", guestPhone: "0416-444-4444", checkInDate: "2026-07-01", checkOutDate: "2026-07-03", status: "confirmada", totalAmount: 150 },
    ],
    memberships: [
      { guestProfileId: "p2", guestName: "Beto Díaz", active: true, expiresAt: "" },
      { guestName: "Vencida García", active: true, expiresAt: "2026-01-01" },
    ],
    todayISO: TODAY,
  })
}

describe("buildCampaignRows", () => {
  it("une fichas, legales y reservas deduplicando por teléfono", () => {
    const rows = baseRows()
    const names = rows.map((r) => r.name)
    expect(names).toEqual(["Ana Pérez", "Beto Díaz", "Caro Solo Ficha", "Dani Reserva"])
    const ana = rows.find((r) => r.name === "Ana Pérez")!
    expect(ana.stays).toBe(2) // la cancelada no cuenta
    expect(ana.totalSpent).toBe(500)
    expect(ana.lastCheckIn).toBe("2026-06-10")
    expect(ana.birthMonth).toBe(7) // llegó por la ficha legal fusionada
    expect(ana.vip).toBe(true)
  })

  it("marca miembros por ficha CRM y por nombre, respetando vencimiento", () => {
    const rows = baseRows()
    expect(rows.find((r) => r.name === "Beto Díaz")!.isMember).toBe(true)
    expect(rows.find((r) => r.name === "Ana Pérez")!.isMember).toBe(false)
    // La membresía vencida no crea fila ni marca a nadie.
    expect(rows.some((r) => r.name === "Vencida García")).toBe(false)
  })
})

describe("filterCampaignRows", () => {
  it("filtra por estadía entre fechas (rango inclusive)", () => {
    const rows = baseRows()
    const junio = filterCampaignRows(rows, { stayedFrom: "2026-06-01", stayedTo: "2026-06-30" })
    expect(junio.map((r) => r.name)).toEqual(["Ana Pérez"])
    const julio = filterCampaignRows(rows, { stayedFrom: "2026-07-01", stayedTo: "2026-07-31" })
    expect(julio.map((r) => r.name)).toEqual(["Dani Reserva"])
  })

  it("filtra por gasto mínimo, cumpleaños del mes y membresía", () => {
    const rows = baseRows()
    expect(filterCampaignRows(rows, { minSpent: 400 }).map((r) => r.name)).toEqual(["Ana Pérez"])
    expect(filterCampaignRows(rows, { birthdayMonth: 7 }).map((r) => r.name)).toEqual(["Ana Pérez"])
    expect(filterCampaignRows(rows, { membership: "member" }).map((r) => r.name)).toEqual(["Beto Díaz"])
    expect(filterCampaignRows(rows, { membership: "nonmember" }).map((r) => r.name)).toEqual([
      "Ana Pérez",
      "Caro Solo Ficha",
      "Dani Reserva",
    ])
    expect(filterCampaignRows(rows, { vipOnly: true }).map((r) => r.name)).toEqual(["Ana Pérez"])
  })
})

describe("campaignPhoneList + plantillas", () => {
  it("lista teléfonos únicos y renderiza variables", () => {
    const rows = baseRows()
    const list = campaignPhoneList(rows)
    expect(list.split(", ")).toHaveLength(4)
    expect(list).toContain("0414-111.1111")

    const msg = renderCampaignTemplate("Hola {nombre}, te espera {hotel}. {nombre}!", {
      nombre: "Ana",
      hotel: "Lidotel",
    })
    expect(msg).toBe("Hola Ana, te espera Lidotel. Ana!")
  })

  it("normaliza plantillas y cae al default si no hay válidas", () => {
    expect(normalizeCampaignTemplates(undefined)).toEqual(DEFAULT_CAMPAIGN_TEMPLATES)
    expect(normalizeCampaignTemplates([{ text: "" }])).toEqual(DEFAULT_CAMPAIGN_TEMPLATES)
    const custom = normalizeCampaignTemplates([{ id: "x", name: "Mi plantilla", text: "Hola {nombre}" }])
    expect(custom).toEqual([{ id: "x", name: "Mi plantilla", text: "Hola {nombre}" }])
  })
})
