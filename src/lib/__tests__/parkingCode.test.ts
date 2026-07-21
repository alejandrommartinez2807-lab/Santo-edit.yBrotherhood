import { describe, expect, it } from "vitest"
import { extractTicketCode } from "../parkingCode"

describe("extractTicketCode", () => {
  it("normaliza el código pelado a mayúsculas", () => {
    expect(extractTicketCode(" p-ab12c ")).toBe("P-AB12C")
  })

  it("extrae el código del link completo del QR", () => {
    expect(extractTicketCode("https://concepto-la-granja.vercel.app/estacionamiento?code=P-AB12C")).toBe("P-AB12C")
  })

  it("encuentra el código dentro de texto escaneado", () => {
    expect(extractTicketCode("Ticket P-XY34Z · placa AB123CD")).toBe("P-XY34Z")
  })

  it("si no hay formato conocido devuelve el texto en mayúsculas", () => {
    expect(extractTicketCode("abc")).toBe("ABC")
    expect(extractTicketCode("")).toBe("")
  })
})
