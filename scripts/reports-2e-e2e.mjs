// E2E ligero de Reportes 2e contra dev server + Supabase real.
// Autosuficiente: prende los módulos que alimentan las secciones nuevas
// (proveedores/compras/cuentas por pagar/inventario) y los restaura al final,
// igual que smoke hace con lo fiscal. No borra datos del negocio.
import { readFileSync } from "node:fs"

const BASE = process.env.BASE || "http://localhost:3000"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const pwd = env.ORDERS_OWNER_PASSWORD

let pass = 0
let fail = 0
const check = (n, c) => { console.log((c ? "✓" : "✗ FALLA") + " " + n); if (c) pass++; else fail++ }

const auth = { "x-admin-password": pwd, "Content-Type": "application/json" }
const getConfig = () =>
  fetch(`${BASE}/api/business-config`, { headers: auth, cache: "no-store" })
    .then((r) => r.json())
    .then((j) => j.businessConfig || {})
const saveConfig = (businessConfig) =>
  fetch(`${BASE}/api/business-config`, { method: "POST", headers: auth, body: JSON.stringify({ businessConfig }) })

// Flags que alimentan las secciones 2e del endpoint de reportes.
const MODULE_FLAGS = [
  "suppliersModuleEnabled",
  "supplierPurchasesModuleEnabled",
  "accountsPayableModuleEnabled",
  "inventoryModuleEnabled",
  "inventoryAlertsModuleEnabled",
]

async function main() {
  // Snapshot de los flags para restaurarlos exactamente como estaban.
  const cur = await getConfig()
  const original = Object.fromEntries(MODULE_FLAGS.map((k) => [k, cur[k]]))

  try {
    await saveConfig(Object.fromEntries(MODULE_FLAGS.map((k) => [k, true])))

    const res = await fetch(`${BASE}/api/reports?period=month`, {
      headers: { "x-admin-password": pwd },
      cache: "no-store",
    })
    const body = await res.json().catch(() => ({}))

    check("endpoint /api/reports responde 200", res.status === 200)
    check("trae resumen de ventas", typeof body.summary?.totalUSD === "number")
    check("trae cuentas por pagar", typeof body.supplierPayables?.summary?.pendingUSD === "number")
    check("trae compras por proveedor", Array.isArray(body.supplierPurchases?.bySupplier))
    check("trae margen por recetas", typeof body.productMargins?.summary?.recipeCoveragePct === "number")
    check("trae salud de inventario", typeof body.inventoryHealth?.lowStockCount === "number")
    check("trae alertas del dueño", Array.isArray(body.managerAlerts))
  } finally {
    await saveConfig(original)
  }

  console.log(`\n==== ${pass} OK, ${fail} fallas ====`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1) })
