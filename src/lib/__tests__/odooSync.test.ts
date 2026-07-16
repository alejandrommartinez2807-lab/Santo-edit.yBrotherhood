import { describe, expect, it } from "vitest"
import {
  buildAuthCall,
  buildExecuteCall,
  mapGuestToPartner,
  mapProductToOdoo,
  normalizeOdooBaseUrl,
  parseJsonRpcResult,
  planSync,
  readAuthUid,
  recordHash,
  summarizeSyncPlan,
  toPlannedRecords,
  type SyncMapEntry,
} from "@/lib/odooSync"

describe("normalizeOdooBaseUrl", () => {
  it("agrega https, quita barra final y respeta http", () => {
    expect(normalizeOdooBaseUrl("cliente.odoo.com")).toBe("https://cliente.odoo.com")
    expect(normalizeOdooBaseUrl("https://cliente.odoo.com/")).toBe("https://cliente.odoo.com")
    expect(normalizeOdooBaseUrl("http://localhost:8069//")).toBe("http://localhost:8069")
    expect(normalizeOdooBaseUrl("  ")).toBe("")
  })
})

describe("buildAuthCall / buildExecuteCall", () => {
  it("arma el JSON-RPC de authenticate", () => {
    const body = buildAuthCall("cliente-prod", "user@x.com", "KEY")
    expect(body.jsonrpc).toBe("2.0")
    expect(body.method).toBe("call")
    expect(body.params.service).toBe("common")
    expect(body.params.method).toBe("authenticate")
    expect(body.params.args).toEqual(["cliente-prod", "user@x.com", "KEY", {}])
    expect(typeof body.id).toBe("number")
  })

  it("arma el JSON-RPC de execute_kw con args y kwargs", () => {
    const body = buildExecuteCall("db", 7, "KEY", "res.partner", "create", [{ name: "X" }], { context: {} })
    expect(body.params.service).toBe("object")
    expect(body.params.method).toBe("execute_kw")
    expect(body.params.args).toEqual(["db", 7, "KEY", "res.partner", "create", [{ name: "X" }], { context: {} }])
  })

  it("cada llamada usa un id distinto", () => {
    const a = buildAuthCall("db", "u", "k")
    const b = buildAuthCall("db", "u", "k")
    expect(a.id).not.toBe(b.id)
  })
})

describe("parseJsonRpcResult / readAuthUid", () => {
  it("lee el result en éxito", () => {
    expect(parseJsonRpcResult({ result: 42 })).toEqual({ ok: true, result: 42 })
  })
  it("extrae el mensaje de Odoo en error.data.message", () => {
    const r = parseJsonRpcResult({ error: { data: { message: "Access Denied" }, message: "Odoo Server Error" } })
    expect(r).toEqual({ ok: false, error: "Access Denied" })
  })
  it("cae a error.message si no hay data.message", () => {
    const r = parseJsonRpcResult({ error: { message: "Boom" } })
    expect(r).toEqual({ ok: false, error: "Boom" })
  })
  it("respuesta basura → error", () => {
    expect(parseJsonRpcResult(null).ok).toBe(false)
    expect(parseJsonRpcResult("nope").ok).toBe(false)
  })
  it("readAuthUid devuelve el uid válido o null", () => {
    expect(readAuthUid(parseJsonRpcResult({ result: 5 }))).toBe(5)
    expect(readAuthUid(parseJsonRpcResult({ result: false }))).toBeNull()
    expect(readAuthUid(parseJsonRpcResult({ error: { message: "x" } }))).toBeNull()
  })
})

describe("recordHash", () => {
  it("es estable e independiente del orden de las claves", () => {
    expect(recordHash({ a: 1, b: 2 })).toBe(recordHash({ b: 2, a: 1 }))
  })
  it("cambia si cambia el contenido", () => {
    expect(recordHash({ a: 1 })).not.toBe(recordHash({ a: 2 }))
  })
  it("devuelve 8 hex", () => {
    expect(recordHash({ x: "hola" })).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe("mapGuestToPartner", () => {
  it("mapea nombre, teléfono, email, documento (vat) y dirección", () => {
    expect(
      mapGuestToPartner({
        fullName: "Ana Pérez",
        phone: "0414",
        email: "a@x.com",
        documentNumber: "V-123",
        address: "Calle 1",
      }),
    ).toEqual({ name: "Ana Pérez", customer_rank: 1, phone: "0414", email: "a@x.com", vat: "V-123", street: "Calle 1" })
  })
  it("omite los campos vacíos y pone nombre por defecto", () => {
    expect(mapGuestToPartner({})).toEqual({ name: "Huésped sin nombre", customer_rank: 1 })
  })
})

describe("mapProductToOdoo", () => {
  it("mapea precio y tipo consu por defecto", () => {
    expect(mapProductToOdoo({ name: "Hamburguesa", price: 12.5, sku: "H1" })).toEqual({
      name: "Hamburguesa",
      list_price: 12.5,
      type: "consu",
      default_code: "H1",
    })
  })
  it("servicio → type service; precio inválido → 0", () => {
    const r = mapProductToOdoo({ name: "Masaje", price: -3, isService: true })
    expect(r.type).toBe("service")
    expect(r.list_price).toBe(0)
  })
})

describe("planSync (idempotencia)", () => {
  const existing: SyncMapEntry[] = [
    { localId: "g1", odooId: 100, recordHash: "aaaa" },
    { localId: "g2", odooId: 200, recordHash: "bbbb" },
  ]

  it("clasifica crear / actualizar / sin cambios", () => {
    const plan = planSync(
      [
        { localId: "g1", hash: "aaaa" }, // igual → sin cambios
        { localId: "g2", hash: "cccc" }, // cambió → actualizar
        { localId: "g3", hash: "dddd" }, // nuevo → crear
      ],
      existing,
    )
    expect(plan.unchanged).toEqual([{ localId: "g1", hash: "aaaa", odooId: 100 }])
    expect(plan.toUpdate).toEqual([{ localId: "g2", hash: "cccc", odooId: 200 }])
    expect(plan.toCreate).toEqual([{ localId: "g3", hash: "dddd" }])
  })

  it("correr dos veces seguidas la segunda no crea nada", () => {
    const records = [{ localId: "g3", hash: "dddd" }]
    const first = planSync(records, existing)
    expect(first.toCreate).toHaveLength(1)
    // tras crear g3 (odooId 300), el mapa ya lo tiene:
    const afterFirst: SyncMapEntry[] = [...existing, { localId: "g3", odooId: 300, recordHash: "dddd" }]
    const second = planSync(records, afterFirst)
    expect(second.toCreate).toHaveLength(0)
    expect(second.unchanged).toHaveLength(1)
  })

  it("resume el plan de forma legible", () => {
    const plan = planSync([{ localId: "g3", hash: "z" }], existing)
    expect(summarizeSyncPlan(plan)).toBe("1 nuevos · 0 actualizados · 0 sin cambios")
  })
})

describe("toPlannedRecords", () => {
  it("deriva localId + hash de los valores", () => {
    const planned = toPlannedRecords([
      { localId: "g1", values: { name: "Ana" } },
      { localId: "g2", values: { name: "Beto" } },
    ])
    expect(planned.map((p) => p.localId)).toEqual(["g1", "g2"])
    expect(planned[0].hash).toMatch(/^[0-9a-f]{8}$/)
    // mismo valor ⇒ mismo hash (idempotencia estable entre corridas)
    expect(toPlannedRecords([{ localId: "g1", values: { name: "Ana" } }])[0].hash).toBe(planned[0].hash)
  })
})
