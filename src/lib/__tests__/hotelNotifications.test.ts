import { describe, it, expect } from "vitest"
import { buildMessage, whatsappUrl } from "../hotelNotifications"

const reservation = {
  guestName: "Ana",
  guestPhone: "0414-1234567",
  code: "WBZNT",
  checkInDate: "2026-08-01",
  checkOutDate: "2026-08-03",
  nights: 2,
  totalAmount: 90,
}

describe("hotelNotifications", () => {
  it("arma el mensaje de confirmación con los datos", () => {
    const msg = buildMessage("confirmacion", reservation, "Lidotel")
    expect(msg).toContain("Ana")
    expect(msg).toContain("Lidotel")
    expect(msg).toContain("WBZNT")
    expect(msg).toContain("$90")
  })

  it("cambia el texto por tipo de aviso", () => {
    expect(buildMessage("recordatorio", reservation)).toContain("recordamos")
    expect(buildMessage("post", reservation)).toContain("gracias")
  })

  it("arma el enlace wa.me con dígitos y mensaje codificado", () => {
    const url = whatsappUrl("0414-1234567", "Hola Ana")
    expect(url).toBe("https://wa.me/04141234567?text=Hola%20Ana")
    expect(whatsappUrl("123", "x")).toBe("")
  })
})
