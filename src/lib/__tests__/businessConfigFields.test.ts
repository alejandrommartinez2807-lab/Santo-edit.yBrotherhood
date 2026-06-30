import { describe, it, expect } from "vitest"
import {
  SIMPLE_BUSINESS_CONFIG_FIELDS,
  coerceSimpleConfigValue,
} from "@/lib/businessConfigFields"
import { DEFAULT_BUSINESS_CONFIG } from "@/lib/orders"

// Garantiza que el registro único de campos de config NO se desincronice de los
// valores por defecto ni de los tipos. Si agregas un campo al registro sin su
// default (o con tipo distinto), este test falla — que fue justo el bug que
// hacía que el tema/fiscal no se guardaran.

const defaults = DEFAULT_BUSINESS_CONFIG as unknown as Record<string, unknown>

describe("Registro de configuración · sin desincronización", () => {
  it("cada campo del registro tiene un default del tipo correcto", () => {
    for (const field of SIMPLE_BUSINESS_CONFIG_FIELDS) {
      expect(defaults[field.key], `falta default para "${field.key}"`).not.toBeUndefined()
      expect(typeof defaults[field.key], `tipo incorrecto en "${field.key}"`).toBe(field.type)
    }
  })

  it("no hay claves duplicadas en el registro", () => {
    const keys = SIMPLE_BUSINESS_CONFIG_FIELDS.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("coerce respeta tipos y acota números", () => {
    const iva = SIMPLE_BUSINESS_CONFIG_FIELDS.find((f) => f.key === "ivaDefaultRate")!
    expect(coerceSimpleConfigValue("16", iva)).toBe(16)
    expect(coerceSimpleConfigValue(999, iva)).toBe(100) // acotado a max
    expect(coerceSimpleConfigValue(-5, iva)).toBe(0) // acotado a min
    expect(coerceSimpleConfigValue("abc", iva)).toBe(16) // inválido → default

    const fiscal = SIMPLE_BUSINESS_CONFIG_FIELDS.find((f) => f.key === "fiscalEnabled")!
    expect(coerceSimpleConfigValue(true, fiscal)).toBe(true)
    expect(coerceSimpleConfigValue(undefined, fiscal)).toBe(false) // default false → solo true activa

    const incluido = SIMPLE_BUSINESS_CONFIG_FIELDS.find((f) => f.key === "pricesIncludeIva")!
    expect(coerceSimpleConfigValue(false, incluido)).toBe(false)
    expect(coerceSimpleConfigValue(undefined, incluido)).toBe(true) // default true → solo false desactiva

    const rif = SIMPLE_BUSINESS_CONFIG_FIELDS.find((f) => f.key === "rifNumber")!
    expect(coerceSimpleConfigValue("  J-123  ", rif)).toBe("J-123") // trim
  })
})
