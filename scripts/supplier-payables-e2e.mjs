// E2E de Cuentas por pagar de proveedores (Fase 2d) contra dev server + Supabase real.
// Requisitos:
//   1) npm run dev
//   2) .env.local con NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y ORDERS_OWNER_PASSWORD
//   3) migración 0014_supplier_payables.sql aplicada en Supabase
// Ejecutar:
//   npm run e2e:supplier-payables

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
  return request("GET", path, undefined, extraHeaders)
}

async function post(path, body, extraHeaders = {}) {
  return request("POST", path, body, extraHeaders)
}

async function patch(path, body, extraHeaders = {}) {
  return request("PATCH", path, body, extraHeaders)
}

async function purchaseById(id) {
  const payload = await get("/api/supplier-purchases")
  return (payload.json?.purchases || []).find((purchase) => purchase.id === id)
}

async function main() {
  const runId = `PAYABLE-${Date.now()}`
  let supplierId = null
  let purchaseId = null
  let previousSuppliersEnabled

  try {
    const currentConfig = (await get("/api/business-config"))?.json?.businessConfig
    if (!currentConfig) throw new Error("No se pudo leer /api/business-config")

    previousSuppliersEnabled = currentConfig.suppliersModuleEnabled

    await post("/api/business-config", {
      businessConfig: {
        ...currentConfig,
        suppliersModuleEnabled: true,
      },
    })

    const supplierPayload = await post("/api/suppliers", {
      name: `${runId}-PROV`,
      contactName: "E2E",
      phone: "",
      email: "",
      note: "Proveedor temporal para E2E cuentas por pagar",
      isActive: true,
    })
    supplierId = supplierPayload.json?.supplier?.id
    check("setup: proveedor temporal creado", Boolean(supplierId))

    const created = await post("/api/supplier-purchases", {
      supplierId,
      purchaseDate: "2026-06-22",
      dueDate: "2026-06-25",
      documentNumber: runId,
      totalUSD: 100,
      note: "Compra temporal E2E cuentas por pagar",
    })
    purchaseId = created.json?.purchase?.id
    check("compra: nace pendiente con vencimiento", created.res.status === 201 && created.json?.purchase?.paymentStatus === "Pendiente" && created.json?.purchase?.pendingUSD === 100)

    const partial = await post(`/api/supplier-purchases/${purchaseId}/payments`, {
      paymentDate: "2026-06-23",
      amountUSD: 40,
      method: "Transferencia",
      reference: `${runId}-P1`,
      note: "Primer abono",
    })
    check("abono parcial: 40/100 deja pendiente 60", partial.res.status === 201 && partial.json?.purchase?.paymentStatus === "Parcial" && partial.json?.purchase?.paidUSD === 40 && partial.json?.purchase?.pendingUSD === 60)

    const paymentsAfterPartial = await get(`/api/supplier-purchases/${purchaseId}/payments`)
    check("historial: lista el primer abono", paymentsAfterPartial.res.status === 200 && paymentsAfterPartial.json?.payments?.length === 1)

    const overpay = await post(`/api/supplier-purchases/${purchaseId}/payments`, {
      paymentDate: "2026-06-24",
      amountUSD: 61,
    })
    check("validación: no permite pagar más del pendiente", overpay.res.status === 400)

    const finalPayment = await post(`/api/supplier-purchases/${purchaseId}/payments`, {
      paymentDate: "2026-06-24",
      amountUSD: 60,
      method: "Efectivo",
      reference: `${runId}-P2`,
    })
    check("abono final: marca pagado y pendiente 0", finalPayment.res.status === 201 && finalPayment.json?.purchase?.paymentStatus === "Pagado" && finalPayment.json?.purchase?.pendingUSD === 0)

    const paidPurchase = await purchaseById(purchaseId)
    check("listado: la compra queda pagada", paidPurchase?.paymentStatus === "Pagado" && paidPurchase?.paidUSD === 100)

    const reopen = await patch(`/api/supplier-purchases/${purchaseId}`, { totalUSD: 150 })
    check("editar total: recalcula a parcial si sube el total", reopen.res.status === 200 && reopen.json?.purchase?.paymentStatus === "Parcial" && reopen.json?.purchase?.pendingUSD === 50)
  } finally {
    if (purchaseId) {
      await supabase.from("supplier_purchase_payments").delete().eq("purchase_id", purchaseId)
      await supabase.from("supplier_purchases").delete().eq("id", purchaseId)
    }
    if (supplierId) await supabase.from("suppliers").delete().eq("id", supplierId)

    if (previousSuppliersEnabled !== undefined) {
      const currentConfig = (await get("/api/business-config"))?.json?.businessConfig
      if (currentConfig) {
        await post("/api/business-config", {
          businessConfig: {
            ...currentConfig,
            suppliersModuleEnabled: previousSuppliersEnabled,
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
