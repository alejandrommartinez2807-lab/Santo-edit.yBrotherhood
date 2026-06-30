import { describe, expect, it } from "vitest"
import {
  DataUrlImageError,
  assertDataUrlImage,
  decodeDataUrlImage,
  parseDataUrlImage,
  sanitizeUploadedImageFileName,
} from "@/lib/dataUrlImages"

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="

describe("dataUrlImages", () => {
  it("parsea imágenes data URL permitidas", () => {
    const parsed = parseDataUrlImage(onePixelPng)

    expect(parsed?.mimeType).toBe("image/png")
    expect(parsed?.base64).toContain("iVBOR")
    expect(parsed?.estimatedBytes).toBeGreaterThan(0)
  })

  it("normaliza image/jpg como image/jpeg", () => {
    const parsed = parseDataUrlImage("data:image/jpg;base64,AAAA")

    expect(parsed?.mimeType).toBe("image/jpeg")
  })

  it("rechaza formatos peligrosos o no soportados", () => {
    expect(parseDataUrlImage("data:image/svg+xml;base64,AAAA")).toBeNull()
    expect(parseDataUrlImage("data:text/html;base64,AAAA")).toBeNull()
    expect(parseDataUrlImage("https://example.com/image.png")).toBeNull()
  })

  it("lanza error controlado cuando la imagen excede el tamaño permitido", () => {
    expect(() =>
      assertDataUrlImage(onePixelPng, {
        label: "El comprobante",
        maxBytes: 8,
      })
    ).toThrow(DataUrlImageError)
  })

  it("decodifica un buffer válido", () => {
    const decoded = decodeDataUrlImage(onePixelPng)

    expect(decoded.buffer.length).toBeGreaterThan(0)
    expect(decoded.mimeType).toBe("image/png")
  })

  it("sanea nombres y fuerza extensión real por mime type", () => {
    expect(
      sanitizeUploadedImageFileName(" Mi Foto rara $$$.gif ", "producto", "image/webp")
    ).toBe("mi-foto-rara.webp")
    expect(sanitizeUploadedImageFileName("", "Comprobante #15", "image/jpeg")).toBe(
      "comprobante-15.jpg"
    )
  })
})
