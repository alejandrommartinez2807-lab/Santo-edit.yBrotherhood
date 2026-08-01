// Carta en 3D / AR: el modelo del plato NO tiene columna propia, viaja dentro
// del JSONB `config` de menu_products. Ese patrón tiene una trampa conocida —
// si la clave no está en la whitelist de `saveMenuProduct`, o si algún
// normalizador del camino no la copia, el modelo se BORRA al editar cualquier
// otro campo del producto (le pasó antes a comboItems y a ivaRate).
// Estos tests fijan el camino completo de ida y de vuelta.
import { beforeEach, describe, expect, it, vi } from "vitest"

type Call = {
  table: string
  op: string
  payload?: Record<string, unknown>
  filters: Array<[string, string, unknown]>
}

const calls: Call[] = []
let responders: Array<(call: Call) => { data?: unknown; error?: unknown }> = []

function makeBuilder(table: string) {
  const call: Call = { table, op: "", payload: undefined, filters: [] }
  const finish = () => {
    calls.push(call)
    const responder = responders.shift()
    return Promise.resolve(responder ? responder(call) : { data: null, error: null })
  }
  const builder: Record<string, unknown> = {
    insert: (payload: Record<string, unknown>) => {
      call.op = "insert"
      call.payload = payload
      return builder
    },
    upsert: (payload: Record<string, unknown>) => {
      call.op = "upsert"
      call.payload = payload
      return builder
    },
    update: (payload: Record<string, unknown>) => {
      call.op = "update"
      call.payload = payload
      return builder
    },
    select: () => {
      if (!call.op) call.op = "select"
      return builder
    },
    eq: (column: string, value: unknown) => {
      call.filters.push(["eq", column, value])
      return builder
    },
    maybeSingle: finish,
    single: finish,
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      finish().then(resolve, reject),
  }
  return builder
}

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({ from: (table: string) => makeBuilder(table) }),
}))

import { saveMenuProduct } from "@/lib/ordersMenu"
import { normalizeMenuProductInput } from "@/lib/menuProductInput"
import { menuProductToPublicProduct } from "@/lib/publicProductsResponse"
import { normalizePublicProduct } from "@/lib/publicProductNormalization"
import type { MenuProduct } from "@/lib/ordersMenu"

const GLB = "https://storage.supabase.co/menu-images/models/1-hamburguesa.glb"
const USDZ = "https://storage.supabase.co/menu-images/models/1-hamburguesa.usdz"

/** Devuelve la fila que el upsert mandó a Supabase. */
function upsertedRow() {
  const call = calls.find((item) => item.op === "upsert")
  return (call?.payload || {}) as Record<string, unknown>
}

function upsertedConfig() {
  return (upsertedRow().config || {}) as Record<string, unknown>
}

/** Simula que la BD devuelve lo que se acaba de guardar. */
function echoUpsert(call: Call) {
  return { data: call.payload }
}

beforeEach(() => {
  calls.length = 0
  responders = []
})

describe("saveMenuProduct — el modelo 3D sobrevive el guardado", () => {
  it("guarda model3dUrl y model3dIosUrl dentro de config (están en la whitelist)", async () => {
    responders = [echoUpsert]

    const { menuProduct } = await saveMenuProduct({
      name: "Hamburguesa doble",
      category: "Burgers",
      price: 12,
      model3dUrl: GLB,
      model3dIosUrl: USDZ,
    })

    expect(upsertedConfig().model3dUrl).toBe(GLB)
    expect(upsertedConfig().model3dIosUrl).toBe(USDZ)
    // Y vuelve al producto por el `...config` de menuRowToProduct.
    expect(menuProduct.model3dUrl).toBe(GLB)
    expect(menuProduct.model3dIosUrl).toBe(USDZ)
  })

  it("editar SOLO el precio no borra el modelo guardado", async () => {
    responders = [
      // 1. lectura del producto existente (guardia de sede + config previa)
      () => ({ data: { id: 77, branch_id: null, config: { model3dUrl: GLB, model3dIosUrl: USDZ } } }),
      // 2. upsert
      echoUpsert,
    ]

    // Payload de "cambié el precio": ni menciona el modelo.
    const { menuProduct } = await saveMenuProduct({
      id: 77,
      name: "Hamburguesa doble",
      category: "Burgers",
      price: 15,
    })

    expect(upsertedRow().price).toBe(15)
    expect(upsertedConfig().model3dUrl).toBe(GLB)
    expect(upsertedConfig().model3dIosUrl).toBe(USDZ)
    expect(menuProduct.model3dUrl).toBe(GLB)
  })

  it("mandar el campo vacío SÍ quita el modelo (botón «Quitar»)", async () => {
    responders = [
      () => ({ data: { id: 77, branch_id: null, config: { model3dUrl: GLB, model3dIosUrl: USDZ } } }),
      echoUpsert,
    ]

    const { menuProduct } = await saveMenuProduct({
      id: 77,
      name: "Hamburguesa doble",
      category: "Burgers",
      price: 15,
      model3dUrl: "",
      model3dIosUrl: "",
    })

    expect(upsertedConfig().model3dUrl).toBe("")
    expect(menuProduct.model3dUrl).toBe("")
  })

  it("un producto sin modelo devuelve \"\" y nunca undefined", async () => {
    responders = [echoUpsert]

    const { menuProduct } = await saveMenuProduct({
      name: "Papas fritas",
      category: "Papas",
      price: 4,
    })

    expect(menuProduct.model3dUrl).toBe("")
    expect(menuProduct.model3dIosUrl).toBe("")
    expect(menuProduct.model3dUrl).not.toBeUndefined()
  })

  it("descarta URLs que no son del sitio ni http(s)", async () => {
    responders = [echoUpsert]

    const { menuProduct } = await saveMenuProduct({
      name: "Hamburguesa doble",
      category: "Burgers",
      price: 12,
      // El valor termina en el atributo src de <model-viewer>.
      model3dUrl: "javascript:alert(1)",
      model3dIosUrl: "/modelos/plato.usdz",
    })

    expect(menuProduct.model3dUrl).toBe("")
    expect(menuProduct.model3dIosUrl).toBe("/modelos/plato.usdz")
  })
})

describe("normalizeMenuProductInput — clave ausente ≠ clave vacía", () => {
  it("deja el modelo en undefined cuando el cliente no lo mandó", () => {
    // Es lo que hace que `configValue` conserve lo guardado: si esto devolviera
    // "", cualquier guardado parcial (activar/desactivar, reordenar) borraría
    // el modelo del producto.
    const input = normalizeMenuProductInput({ name: "Papas", price: 4 })

    expect(input.model3dUrl).toBeUndefined()
    expect(input.model3dIosUrl).toBeUndefined()
  })

  it("respeta el valor cuando sí lo mandaron", () => {
    const input = normalizeMenuProductInput({
      name: "Hamburguesa",
      price: 12,
      model3dUrl: `  ${GLB}  `,
      model3dIosUrl: "",
    })

    expect(input.model3dUrl).toBe(GLB)
    expect(input.model3dIosUrl).toBe("")
  })

  it("descarta esquemas peligrosos", () => {
    const input = normalizeMenuProductInput({
      name: "Hamburguesa",
      price: 12,
      model3dUrl: "javascript:alert(1)",
    })

    expect(input.model3dUrl).toBe("")
  })
})

describe("el modelo llega hasta la carta pública", () => {
  const menuProduct = {
    id: 1,
    name: "Hamburguesa doble",
    category: "Burgers",
    description: "",
    price: 12,
    image: "/burger.jpg",
    paymentMode: "mixto",
    isActive: true,
    isFeatured: false,
    sortOrder: 1,
    createdAt: "",
    updatedAt: "",
    model3dUrl: GLB,
    model3dIosUrl: USDZ,
  } as MenuProduct

  it("menuProductToPublicProduct lo copia", () => {
    const publicProduct = menuProductToPublicProduct(menuProduct)

    expect(publicProduct.model3dUrl).toBe(GLB)
    expect(publicProduct.model3dIosUrl).toBe(USDZ)
  })

  it("normalizePublicProduct lo conserva y limpia lo peligroso", () => {
    expect(normalizePublicProduct(menuProduct)?.model3dUrl).toBe(GLB)
    expect(
      normalizePublicProduct({ ...menuProduct, model3dUrl: "javascript:alert(1)" })?.model3dUrl,
    ).toBe("")
    expect(normalizePublicProduct({ ...menuProduct, model3dUrl: undefined })?.model3dUrl).toBe("")
  })
})
