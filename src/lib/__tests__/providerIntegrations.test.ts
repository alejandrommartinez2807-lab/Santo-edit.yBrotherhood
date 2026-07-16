import { describe, expect, it } from "vitest"
import {
  DEFAULT_PROVIDER_INTEGRATIONS,
  getProviderIntegrationDef,
  normalizeProviderIntegrations,
  PROVIDER_INTEGRATION_DEFS,
  PROVIDER_STATUS_LABELS,
  PROVIDER_STATUSES,
} from "@/lib/providerIntegrations"

describe("catálogo de proveedores (V8-E)", () => {
  it("trae los 4 proveedores con credenciales, pasos y guía", () => {
    expect(PROVIDER_INTEGRATION_DEFS.map((d) => d.id)).toEqual(["fiscal", "channel", "gateway", "email"])
    for (const def of PROVIDER_INTEGRATION_DEFS) {
      expect(def.title.length).toBeGreaterThan(3)
      expect(def.manualToday).toContain("Hoy")
      expect(def.missingCredentials.length).toBeGreaterThan(0)
      expect(def.steps.length).toBeGreaterThan(0)
      expect(def.guideSection).toMatch(/^Sección \d/)
    }
  })

  it("cada estado tiene etiqueta legible", () => {
    for (const status of PROVIDER_STATUSES) {
      expect(PROVIDER_STATUS_LABELS[status].length).toBeGreaterThan(3)
    }
  })

  it("getProviderIntegrationDef encuentra por id y devuelve null para basura", () => {
    expect(getProviderIntegrationDef("fiscal")?.id).toBe("fiscal")
    expect(getProviderIntegrationDef("no-existe")).toBeNull()
    expect(getProviderIntegrationDef("")).toBeNull()
  })
})

describe("normalizeProviderIntegrations", () => {
  it("sin datos devuelve los 4 en modo manual", () => {
    expect(normalizeProviderIntegrations(undefined)).toEqual(DEFAULT_PROVIDER_INTEGRATIONS)
    expect(normalizeProviderIntegrations(null)).toEqual(DEFAULT_PROVIDER_INTEGRATIONS)
    expect(normalizeProviderIntegrations("basura")).toEqual(DEFAULT_PROVIDER_INTEGRATIONS)
  })

  it("acepta estados válidos y descarta los inventados", () => {
    const out = normalizeProviderIntegrations({
      fiscal: { status: "tramite", notes: "  con HKA  " },
      gateway: { status: "hackeado", notes: 42 },
      extra: { status: "tramite" },
    })
    expect(out.fiscal).toEqual({ status: "tramite", notes: "con HKA" })
    expect(out.gateway.status).toBe("manual")
    expect(out.channel.status).toBe("manual")
    expect("extra" in out).toBe(false)
  })

  it("recorta notas larguísimas a 600 caracteres", () => {
    const out = normalizeProviderIntegrations({ email: { status: "credenciales", notes: "x".repeat(2000) } })
    expect(out.email.notes).toHaveLength(600)
    expect(out.email.status).toBe("credenciales")
  })
})
