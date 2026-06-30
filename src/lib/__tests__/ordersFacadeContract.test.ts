import { describe, expect, expectTypeOf, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import * as orders from "@/lib/orders"
import type {
  ConfirmStaffItemsInput as FacadeConfirmStaffItemsInput,
  CreateOrderInput as FacadeCreateOrderInput,
  ResetStaffItemsInput as FacadeResetStaffItemsInput,
  UpdateOrderPaymentInput as FacadeUpdateOrderPaymentInput,
} from "@/lib/orders"
import type {
  ConfirmStaffItemsInput as CoreConfirmStaffItemsInput,
  CreateOrderInput as CoreCreateOrderInput,
  ResetStaffItemsInput as CoreResetStaffItemsInput,
  UpdateOrderPaymentInput as CoreUpdateOrderPaymentInput,
} from "@/lib/ordersCoreTypes"

type ExportKind = "type" | "value"

const SRC = resolve(__dirname, "..", "..")
const ORDERS_FACADE = resolve(SRC, "lib", "orders.ts")
const ORDERS_LIB_DIR = resolve(SRC, "lib")

const FUNCTION_EXPORTS = [
  "getActiveLocalTableNames",
  "getBusinessConfig",
  "getRawBusinessConfig",
  "normalizeBusinessConfig",
  "normalizeLocalTablesConfig",
  "saveBusinessConfig",
  "deleteMenuProduct",
  "getMenuProducts",
  "saveMenuProduct",
  "uploadMenuProductImage",
  "clearOrders",
  "confirmOrderStaffItems",
  "createOrder",
  "deleteOrder",
  "getOrders",
  "resetOrderStaffItems",
  "updateOrderDeliveryReport",
  "updateOrderPayment",
  "updateOrderStatus",
  "getDeliveryZones",
  "saveDeliveryZones",
  "attachOrderToOpenAccount",
  "closeOpenAccount",
  "createOpenAccount",
  "getOpenAccounts",
  "clearDayCloses",
  "deleteDayExpense",
  "getDayCloses",
  "getDayExpenses",
  "saveDayClose",
  "saveDayExpense",
  "deleteInventoryItem",
  "deleteInventoryRecipe",
  "getInventory",
  "getInventoryMovements",
  "getInventoryRecipes",
  "saveInventoryItem",
  "saveInventoryRecipe",
  "createPaymentProof",
  "getPaymentProofs",
  "reviewPaymentProof",
] as const

const CONSTANT_EXPORTS = [
  "DEFAULT_BUSINESS_CONFIG",
  "DEFAULT_LOCAL_TABLES",
] as const

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
}

function exportedNamesByKind(source: string) {
  const cleanSource = stripComments(source)
  const exportBlocks = cleanSource.matchAll(/export\s+(type\s+)?\{([\s\S]*?)\}\s+from/g)
  const namesByKind: Record<ExportKind, string[]> = {
    type: [],
    value: [],
  }

  for (const block of exportBlocks) {
    const kind: ExportKind = block[1] ? "type" : "value"
    const names = block[2]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => {
        const aliasMatch = name.match(/\s+as\s+(.+)$/)
        return (aliasMatch?.[1] ?? name).trim()
      })

    namesByKind[kind].push(...names)
  }

  return namesByKind
}

function duplicatedNames(names: readonly string[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const name of names) {
    if (seen.has(name)) duplicates.add(name)
    seen.add(name)
  }

  return [...duplicates].sort()
}

describe("orders.ts · contrato de fachada", () => {
  it("mantiene disponibles las funciones públicas esperadas", () => {
    for (const name of FUNCTION_EXPORTS) {
      expect(typeof orders[name]).toBe("function")
    }
  })

  it("mantiene disponibles las constantes públicas esperadas", () => {
    for (const name of CONSTANT_EXPORTS) {
      expect(orders[name]).toBeDefined()
    }
  })

  it("no tiene exports duplicados en bloques de valores ni de tipos", () => {
    const source = readFileSync(ORDERS_FACADE, "utf8")
    const namesByKind = exportedNamesByKind(source)

    expect(duplicatedNames(namesByKind.value)).toEqual([])
    expect(duplicatedNames(namesByKind.type)).toEqual([])
  })

  it("mantiene los tipos operativos de pedidos re-exportados desde la fachada", () => {
    expectTypeOf<FacadeCreateOrderInput>().toEqualTypeOf<CoreCreateOrderInput>()
    expectTypeOf<FacadeUpdateOrderPaymentInput>().toEqualTypeOf<CoreUpdateOrderPaymentInput>()
    expectTypeOf<FacadeConfirmStaffItemsInput>().toEqualTypeOf<CoreConfirmStaffItemsInput>()
    expectTypeOf<FacadeResetStaffItemsInput>().toEqualTypeOf<CoreResetStaffItemsInput>()
  })
})

describe("ordersStore* · aislamiento de la fachada pública", () => {
  it("los módulos internos de pedidos no importan desde @/lib/orders ni ./orders", () => {
    const violations = readdirSync(ORDERS_LIB_DIR)
      .filter((file) => /^orders(Store|Core).*\.ts$/.test(file))
      .flatMap((file) => {
        const source = readFileSync(resolve(ORDERS_LIB_DIR, file), "utf8")
        const matches = source.matchAll(/from\s+["'](@\/lib\/orders|\.\/orders)["']/g)
        return [...matches].map((match) => `${file} importa ${match[1]}`)
      })

    expect(violations).toEqual([])
  })
})
