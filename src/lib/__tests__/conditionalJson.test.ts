import { describe, expect, it } from "vitest"

// Optimización de consumo 2026-08-03: los paneles sondean /api/orders (264 KB)
// cada 2,5 s y el 99 % de las veces nada cambió. El servidor responde 304 sin
// cuerpo cuando el If-None-Match del panel coincide con el hash del JSON final.
// Estas pruebas fijan el contrato del validador: estable para el mismo
// contenido, distinto ante CUALQUIER cambio (pedidos, rol, sede, modo
// entrenamiento — todo viaja dentro del JSON hasheado).

import {
  buildJsonEtag,
  evaluateConditionalJson,
  ifNoneMatchSatisfied,
} from "@/lib/conditionalJson"

describe("buildJsonEtag", () => {
  it("el mismo contenido produce siempre el mismo validador", () => {
    const a = buildJsonEtag(JSON.stringify({ orders: [{ id: "p-1" }] }))
    const b = buildJsonEtag(JSON.stringify({ orders: [{ id: "p-1" }] }))

    expect(a).toBe(b)
  })

  it("cualquier cambio del contenido cambia el validador", () => {
    const base = buildJsonEtag(
      JSON.stringify({ orders: [{ id: "p-1", status: "Nuevo" }], role: "cashier" }),
    )
    const cambioDePedido = buildJsonEtag(
      JSON.stringify({ orders: [{ id: "p-1", status: "Listo" }], role: "cashier" }),
    )
    const cambioDeRol = buildJsonEtag(
      JSON.stringify({ orders: [{ id: "p-1", status: "Nuevo" }], role: "kitchen" }),
    )

    expect(cambioDePedido).not.toBe(base)
    expect(cambioDeRol).not.toBe(base)
  })

  it("viene entrecomillado, como exige la sintaxis de ETag", () => {
    const etag = buildJsonEtag("{}")

    expect(etag.startsWith('"')).toBe(true)
    expect(etag.endsWith('"')).toBe(true)
  })
})

describe("ifNoneMatchSatisfied", () => {
  const etag = buildJsonEtag(JSON.stringify({ ok: true }))

  it("sin cabecera no hay 304", () => {
    expect(ifNoneMatchSatisfied(null, etag)).toBe(false)
    expect(ifNoneMatchSatisfied("", etag)).toBe(false)
  })

  it("coincide con el validador exacto", () => {
    expect(ifNoneMatchSatisfied(etag, etag)).toBe(true)
  })

  it("acepta listas y el prefijo débil W/", () => {
    expect(ifNoneMatchSatisfied(`"otro", ${etag}`, etag)).toBe(true)
    expect(ifNoneMatchSatisfied(`W/${etag}`, etag)).toBe(true)
  })

  it("acepta el comodín *", () => {
    expect(ifNoneMatchSatisfied("*", etag)).toBe(true)
  })

  it("un validador viejo NO produce 304", () => {
    expect(ifNoneMatchSatisfied('"stale"', etag)).toBe(false)
  })
})

describe("evaluateConditionalJson — el flujo del sondeo", () => {
  it("primera visita: 200 con validador; segunda sin cambios: 304", () => {
    const payload = { orders: [{ id: "p-1" }], trainingModeActive: false }

    const primera = evaluateConditionalJson(null, payload)
    expect(primera.notModified).toBe(false)
    expect(JSON.parse(primera.serialized)).toEqual(payload)

    const segunda = evaluateConditionalJson(primera.etag, payload)
    expect(segunda.notModified).toBe(true)
  })

  it("si el contenido cambió entre sondeos, vuelve el cuerpo completo", () => {
    const primera = evaluateConditionalJson(null, { orders: [{ id: "p-1" }] })
    const trasCambio = evaluateConditionalJson(primera.etag, {
      orders: [{ id: "p-1" }, { id: "p-2" }],
    })

    expect(trasCambio.notModified).toBe(false)
    expect(trasCambio.etag).not.toBe(primera.etag)
  })

  it("cambiar de sede/rol/modo cambia el JSON y por tanto anula el 304", () => {
    const sedeA = evaluateConditionalJson(null, {
      orders: [],
      access: { role: "cashier" },
      trainingModeActive: false,
    })
    const sedeB = evaluateConditionalJson(sedeA.etag, {
      orders: [],
      access: { role: "cashier" },
      trainingModeActive: true,
    })

    expect(sedeB.notModified).toBe(false)
  })
})
