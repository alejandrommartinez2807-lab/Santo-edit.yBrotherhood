// E2E de Compra → Inventario (Fase 2b) contra dev server + Supabase real.
// Requisitos:
//   1) npm run dev
//   2) .env.local con NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y ORDERS_OWNER_PASSWORD
//   3) migración 0013 aplicada en Supabase
// Ejecutar:
//   npm run e2e:purchase-inventory

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const BASE = process.env.BASE || "http://localhost:3000"

function loadEnvFile() {
  const text = readFileSync(".env.local", "utf8")
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=")
        const key = line.slice(0, index).trim()
        const value = line
          .slice(index + 1)
          .trim()
          .replace(/^["']|["']$/g, "")
        return [key, value]
      }),
  )
}

const env = loadEnvFile()
const ownerPassword = env.ORDERS_OWNER_PASSWORD

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}

if (!ownerPassword) {
  console.error("Falta ORDERS_OWNER_PASSWORD en .env.local")
  process.exit(1)
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let pass = 0
let fail = 0

function check(name, condition) {
  console.log(`${condition ? "✓" : "✗ FALLA"} ${name}`)
  if (condition) pass += 1
  else fail += 1
}

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    "x-local-password": ownerPassword,
    ...extra,
  }
}

async function request(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(extraHeaders),
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  return { res, json }
}

async function get(path, extraHeaders = {}) {
  const { json } = await request("GET", path, undefined, extraHeaders)
  return json
}

async function post(path, body, extraHeaders = {}) {
  return request("POST", path, body, extraHeaders)
}

async function patch(path, body, extraHeaders = {}) {
  return request("PATCH", path, body, extraHeaders)
}

async function del(path, extraHeaders = {}) {
  return request("DELETE", path, undefined, extraHeaders)
}

async function inventoryQuantity(itemId) {
  const data = await get("/api/inventory")
  const item = (data?.inventory || []).find((entry) => entry.id === itemId)
  return item?.quantity
}

async function main() {
  const runId = `SMOKE-${Date.now()}`
  let supplierId = null
  let purchaseId = null
  let inventoryItemId = null
  let previousSuppliersEnabled
  let previousInventoryEnabled

  try {
    const currentConfig = (await get("/api/business-config"))?.businessConfig
    if (!currentConfig) throw new Error("No se pudo leer /api/business-config")

    previousSuppliersEnabled = currentConfig.suppliersModuleEnabled
    previousInventoryEnabled = currentConfig.inventoryModuleEnabled

    await post("/api/business-config", {
      businessConfig: {
        ...currentConfig,
        suppliersModuleEnabled: true,
        inventoryModuleEnabled: true,
      },
    })

    const supplierPayload = await post("/api/suppliers", {
      name: `${runId}-PROV`,
      contactName: "E2E",
      phone: "",
      email: "",
      note: "Proveedor temporal para E2E compra → inventario",
      isActive: true,
    })
    supplierId = supplierPayload.json?.supplier?.id
    check("setup: proveedor temporal creado", Boolean(supplierId))

    const itemPayload = await post("/api/inventory", {
      inventoryItem: {
        name: `${runId}-HARINA`,
        quantity: 10,
        unit: "kg",
        category: "General",
        minimumStock: 0,
        costUSD: 0,
        costVES: 0,
        note: "Insumo temporal para E2E compra → inventario",
        isActive: true,
      },
    })
    inventoryItemId = itemPayload.json?.inventoryItem?.id
    check("setup: insumo creado con stock 10", Boolean(inventoryItemId) && (await inventoryQuantity(inventoryItemId)) === 10)

    const created = await post("/api/supplier-purchases", {
      supplierId,
      purchaseDate: "2026-06-22",
      documentNumber: runId,
      totalUSD: 80,
      totalVES: 0,
      note: "Compra temporal E2E",
      inventoryItemId,
      inventoryQuantity: 5,
    })
    purchaseId = created.json?.purchase?.id

    check(
      "compra: guarda vínculo de inventario + movimiento",
      created.res.status === 201 &&
        created.json?.purchase?.inventoryItemName === `${runId}-HARINA` &&
        created.json?.purchase?.inventoryQuantity === 5 &&
        Boolean(created.json?.purchase?.inventoryMovementId),
    )

    check("stock: 10 + 5 = 15", (await inventoryQuantity(inventoryItemId)) === 15)

    const inventoryData = await get("/api/inventory")
    const movements = (inventoryData?.inventoryMovements || []).filter(
      (movement) => movement.itemId === inventoryItemId && movement.movementType === "Compra",
    )
    check(
      "movimiento: existe uno tipo 'Compra' con +5",
      movements.some((movement) => movement.quantityMoved === 5 && movement.finalQuantity === 15),
    )

    await patch(`/api/supplier-purchases/${purchaseId}`, { totalUSD: 999 })
    check("aditivo: editar la compra no toca el stock (sigue 15)", (await inventoryQuantity(inventoryItemId)) === 15)

    await del(`/api/supplier-purchases/${purchaseId}`)
    purchaseId = null
    check("aditivo: borrar la compra no revierte el stock (sigue 15)", (await inventoryQuantity(inventoryItemId)) === 15)

    const zeroQuantity = await post("/api/supplier-purchases", {
      supplierId,
      inventoryItemId,
      inventoryQuantity: 0,
    })
    check("validación: vínculo con cantidad 0 → 400", zeroQuantity.res.status === 400)

    const missingItem = await post("/api/supplier-purchases", {
      supplierId,
      inventoryItemId: `${runId}-NOEXISTE`,
      inventoryQuantity: 3,
    })
    check("validación: insumo inexistente → 400", missingItem.res.status === 400)
  } finally {
    if (purchaseId) await supabase.from("supplier_purchases").delete().eq("id", purchaseId)
    if (inventoryItemId) {
      await supabase.from("inventory_movements").delete().eq("item_id", inventoryItemId)
      await supabase.from("inventory_items").delete().eq("id", inventoryItemId)
    }
    if (supplierId) await supabase.from("suppliers").delete().eq("id", supplierId)

    if (previousSuppliersEnabled !== undefined || previousInventoryEnabled !== undefined) {
      const currentConfig = (await get("/api/business-config"))?.businessConfig
      if (currentConfig) {
        await post("/api/business-config", {
          businessConfig: {
            ...currentConfig,
            suppliersModuleEnabled: previousSuppliersEnabled,
            inventoryModuleEnabled: previousInventoryEnabled,
          },
        })
      }
    }
  }

  console.log(`\n==== ${pass} OK, ${fail} fallas ====`)
  process.exit(fail ? 1 : 0)
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error)
  process.exit(1)
})
