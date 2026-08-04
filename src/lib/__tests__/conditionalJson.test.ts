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
  evaluateFingerprintedJson,
  findEtagForFingerprint,
  getPollValidator,
  hashSerializedJson,
  ifNoneMatchSatisfied,
  parseIfNoneMatchValues,
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

// ---------------------------------------------------------------------------
// ETag compuesto "huella.contenido" (consumo de Supabase 2026-08-04): la
// mitad izquierda se calcula con agregados baratos y decide el 304 SIN leer
// filas; la derecha (hash del JSON) rescata el ahorro de bytes cuando la
// huella rotó (cubeta de tiempo) pero el contenido no.
// ---------------------------------------------------------------------------

describe("getPollValidator", () => {
  const requestWith = (headers: Record<string, string>) => ({
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  })

  it("prefiere x-poll-etag: es la copia que la capa de Vercel NO intercepta", () => {
    // Confirmado en producción 2026-08-04: el If-None-Match no llega a la
    // función. Sin esta cabecera propia, el camino rápido jamás corre.
    expect(
      getPollValidator(
        requestWith({ "x-poll-etag": '"F.C"', "if-none-match": '"otro"' }),
      ),
    ).toBe('"F.C"')
  })

  it("sin x-poll-etag cae a If-None-Match (curl, QA, clientes viejos en local)", () => {
    expect(getPollValidator(requestWith({ "if-none-match": '"F.C"' }))).toBe('"F.C"')
    expect(getPollValidator(requestWith({}))).toBeNull()
  })
})

describe("parseIfNoneMatchValues", () => {
  it("sin cabecera, sin candidatos", () => {
    expect(parseIfNoneMatchValues(null)).toEqual([])
    expect(parseIfNoneMatchValues("")).toEqual([])
  })

  it("desenvuelve comillas, listas y el prefijo débil W/", () => {
    expect(parseIfNoneMatchValues('"a.b"')).toEqual(["a.b"])
    expect(parseIfNoneMatchValues('"uno" , W/"dos.x"')).toEqual(["uno", "dos.x"])
  })

  it("descarta lo que no es un validador entrecomillado (incluido *)", () => {
    expect(parseIfNoneMatchValues("*")).toEqual([])
    expect(parseIfNoneMatchValues("basura")).toEqual([])
    expect(parseIfNoneMatchValues('""')).toEqual([])
  })
})

describe("findEtagForFingerprint — el camino que NO lee filas", () => {
  it("huella coincidente: devuelve el validador del cliente, entero", () => {
    expect(findEtagForFingerprint('"F1.C1"', "F1")).toBe('"F1.C1"')
    expect(findEtagForFingerprint('"otro", W/"F1.C9"', "F1")).toBe('"F1.C9"')
  })

  it("huella distinta o validador viejo sin punto: hay que leer", () => {
    expect(findEtagForFingerprint('"F2.C1"', "F1")).toBeNull()
    // ETag de un panel desplegado antes de la huella: solo hash de contenido.
    expect(findEtagForFingerprint('"C1"', "F1")).toBeNull()
    expect(findEtagForFingerprint(null, "F1")).toBeNull()
  })

  it("una huella vacía o un candidato que EMPIEZA por punto jamás coinciden", () => {
    expect(findEtagForFingerprint('".C1"', "")).toBeNull()
  })
})

describe("evaluateFingerprintedJson — el camino lento", () => {
  const payload = { orders: [{ id: "p-1" }], trainingModeActive: false }
  const contentHash = hashSerializedJson(JSON.stringify(payload))

  it("el validador es huella.contenido, entrecomillado", () => {
    const result = evaluateFingerprintedJson(null, payload, "F1")

    expect(result.etag).toBe(`"F1.${contentHash}"`)
    expect(result.notModified).toBe(false)
    expect(JSON.parse(result.serialized)).toEqual(payload)
  })

  it("rotó la huella pero el contenido no: 304 con el validador NUEVO", () => {
    // Es el caso del techo de seguridad: la cubeta de tiempo rotó, se leyeron
    // las filas, y el cuerpo resultó idéntico al que el panel ya tiene.
    const result = evaluateFingerprintedJson(`"F1.${contentHash}"`, payload, "F2")

    expect(result.notModified).toBe(true)
    expect(result.etag).toBe(`"F2.${contentHash}"`)
  })

  it("un validador viejo sin punto sigue valiendo como mitad de contenido", () => {
    const result = evaluateFingerprintedJson(`"${contentHash}"`, payload, "F1")

    expect(result.notModified).toBe(true)
  })

  it("contenido distinto: cuerpo completo con validador nuevo", () => {
    const result = evaluateFingerprintedJson(
      `"F1.${contentHash}"`,
      { ...payload, orders: [] },
      "F1",
    )

    expect(result.notModified).toBe(false)
  })
})
