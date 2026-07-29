// DÍA 0 · FUNDACIÓN Y LÍNEA BASE — semana real blindada
// Crea la marca de entorno, la sede San Diego, el elenco completo (usuarios
// REALES vía /api/staff + Supabase Auth), inventario, proveedores, compras
// iniciales, menú con recetas por sede y gastos de fundación. Todo con
// verificación en base tras cada bloque. No cuenta como cierre comercial.
//
// Uso: node scripts/sim/dia-0.mjs --seed=brotherhood-week-v1
import { guardLive, createEnvironmentMarker, supabase, simEnv } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders, ownerBootstrapHeaders, publicHeaders } from "./lib/auth.mjs"
import { get, post, patch, sleep } from "./lib/api-client.mjs"
import { check, markBlocked, summary } from "./lib/assertions.mjs"
import {
  openDayLog,
  logLine,
  loadState,
  saveState,
  writeJson,
} from "./lib/evidence-writer.mjs"
import { flushPerformance } from "./lib/performance.mjs"
import {
  loadLedger,
  saveLedger,
  recordSupplierInvoice,
  recordSupplierPayment,
  recordExpense,
} from "./lib/expected-ledger.mjs"
import {
  loadInventoryBook,
  saveInventoryBook,
  initItem,
  applyMove,
} from "./lib/expected-inventory.mjs"
import { stockOf, auditRows, tableCount } from "./lib/db-verifier.mjs"
import { execSync } from "node:child_process"

const SEED = process.argv.find((a) => a.startsWith("--seed="))?.slice(7) || "brotherhood-week-v1"
const RATE = 40

openDayLog("dia-0", "Día 0 — Fundación y línea base")

// ── F0 · Guard (sin marca aún: este día la crea) ──────────────────────────
await guardLive({ requireMarker: false })
await createEnvironmentMarker()
const state = loadState()
state.seed = SEED
state.ids ||= {}

// ── F1 · SEDES ────────────────────────────────────────────────────────────
console.log("\n━━ F1 · Sedes")
const branchesBefore = (await get("/api/public/branches", publicHeaders("10.90.0.9"))).json
const listBefore = branchesBefore?.branches || branchesBefore || []
const freshBase = !state.ids.sanDiego
check(
  "D0-SEDE-1",
  freshBase ? "la base arranca con solo la sede Principal" : "reanudación: la sede Principal existe",
  freshBase
    ? Array.isArray(listBefore) && listBefore.length === 1 && listBefore[0]?.name === "Principal"
    : listBefore.some((b) => b.name === "Principal"),
  JSON.stringify(listBefore.map((b) => b.name)),
)
const PRINCIPAL = listBefore.find((b) => b.name === "Principal")?.id

let SAN_DIEGO = state.ids.sanDiego
if (!SAN_DIEGO) {
  const created = await post("/api/branches", { name: "San Diego" }, ownerBootstrapHeaders())
  SAN_DIEGO = created.json?.branch?.id
  check("D0-SEDE-2", "San Diego se crea con el módulo real de Sucursales", created.status === 200 || created.status === 201, `status=${created.status} id=${SAN_DIEGO}`)
}
const { data: branchRows } = await supabase.from("branches").select("id, name, is_active")
check("D0-SEDE-3", "la base tiene exactamente 2 sedes activas", (branchRows || []).filter((b) => b.is_active).length === 2, JSON.stringify(branchRows?.map((b) => b.name)))
state.ids.principal = PRINCIPAL
state.ids.sanDiego = SAN_DIEGO

// Configuración: la GLOBAL lleva los valores de la marca y de la sede
// Principal; San Diego se configura con su override real
// (PATCH /api/branches/:id/config — el mecanismo del módulo Sucursales).
const mkTables = (names) => names.map((name, index) => ({ id: `t-${name.toLowerCase().replace(/\s+/g, "-")}`, name, isActive: true, sortOrder: index + 1 }))
const cfgGlobal = await post(
  "/api/business-config",
  {
    businessConfig: {
      mainWhatsapp: "04125550101",
      deliveryWhatsapp: "04125550102",
      localTables: mkTables(["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6", "Barra", "Afuera"]),
      printFlowMode: "auto",
      kitchenFlowMode: "kitchen",
      inventoryAutoDeductEnabled: true,
      inventoryAutoDeductDryRun: false,
      // Módulos que la semana necesita y vienen apagados en una base fresca
      // (en producción los encendió el dueño): proveedores, compras, CxP y
      // reservas.
      suppliersModuleEnabled: true,
      supplierPurchasesModuleEnabled: true,
      accountsPayableModuleEnabled: true,
      reservationsModuleEnabled: true,
    },
  },
  ownerBootstrapHeaders(),
)
check("D0-SEDE-4", "config global lista (whatsapp/mesas de Principal, impresión auto, descuento de inventario ON)", cfgGlobal.status === 200, `status=${cfgGlobal.status}`)

const cfgSD = await patch(
  `/api/branches/${SAN_DIEGO}/config`,
  {
    branchConfig: {
      publicName: "Brotherhood San Diego",
      mainWhatsapp: "04245550201",
      deliveryWhatsapp: "04245550202",
      localTables: mkTables(["SD Mesa 1", "SD Mesa 2", "SD Mesa 3", "SD Mesa 4", "SD Terraza"]),
    },
  },
  ownerBootstrapHeaders(),
)
check("D0-SEDE-5", "San Diego guarda su override real de sede (mesas y whatsapp propios)", cfgSD.status === 200, `status=${cfgSD.status}`)

// Delivery por km: módulo real (tabla propia por sede) en Principal.
const deliveryKm = await post(
  "/api/delivery-distance",
  {
    settings: {
      enabled: true,
      originMapsUrl: "https://maps.google.com/?q=10.1976,-68.0040",
      originLat: 10.1976,
      originLng: -68.004,
      roadFactor: 1.3,
      tiers: [
        { upToKm: 3, costUSD: 2 },
        { upToKm: 6, costUSD: 4 },
        { upToKm: 10, costUSD: 6 },
      ],
    },
  },
  ownerBootstrapHeaders({ "x-branch-id": PRINCIPAL }),
)
check("D0-SEDE-5b", "Principal queda con envío por distancia activo (tarifas por km)", deliveryKm.status === 200, `status=${deliveryKm.status}`)

// Sin filtraciones: la config pública de cada sede muestra SU whatsapp.
const digitsOnly = (v) => String(v || "").replace(/\D/g, "")
const pubP = (await get("/api/public/business-config", publicHeaders("10.90.0.10", PRINCIPAL))).json
const pubSD = (await get("/api/public/business-config", publicHeaders("10.90.0.11", SAN_DIEGO))).json
const waPubP = digitsOnly(pubP?.businessConfig?.mainWhatsapp ?? pubP?.mainWhatsapp)
const waPubSD = digitsOnly(pubSD?.businessConfig?.mainWhatsapp ?? pubSD?.mainWhatsapp)
check(
  "D0-SEDE-6",
  "cada sede publica SU whatsapp y no se filtra el de la otra",
  waPubP.endsWith("4125550101") && waPubSD.endsWith("4245550201"),
  `P=${waPubP} SD=${waPubSD}`,
)

// ── F2 · ELENCO (usuarios reales) ─────────────────────────────────────────
console.log("\n━━ F2 · Usuarios")
const CAST = [
  { username: "alejandro", fullName: "Alejandro (Dueño)", role: "owner", branches: "all" },
  { username: "genesis", fullName: "Génesis", role: "manager", branches: [PRINCIPAL] },
  { username: "luis", fullName: "Luis", role: "manager", branches: [SAN_DIEGO] },
  { username: "mariafernanda", fullName: "María Fernanda", role: "cashier", branches: [PRINCIPAL] },
  { username: "kelvin", fullName: "Kelvin", role: "cashier", branches: [PRINCIPAL] },
  { username: "roxana", fullName: "Roxana", role: "cashier", branches: [SAN_DIEGO] },
  { username: "jesus", fullName: "Jesús", role: "kitchen", branches: [PRINCIPAL] },
  { username: "dubraska", fullName: "Dubraska", role: "kitchen", branches: [PRINCIPAL] },
  { username: "carlosalberto", fullName: "Carlos Alberto", role: "kitchen", branches: [SAN_DIEGO] },
  { username: "anthony", fullName: "Anthony", role: "waiter", branches: [PRINCIPAL] },
  { username: "yorgelis", fullName: "Yorgelis", role: "waiter", branches: [PRINCIPAL] },
  { username: "daniela", fullName: "Daniela", role: "waiter", branches: [SAN_DIEGO] },
  { username: "miguel", fullName: "Miguel", role: "delivery", branches: [PRINCIPAL] },
  { username: "vanessa", fullName: "Vanessa", role: "promoter", branches: [PRINCIPAL] },
  { username: "soporteqa", fullName: "Usuario QA Support", role: "support", branches: "all" },
  { username: "gustavo", fullName: "Gustavo", role: "waiter", branches: [SAN_DIEGO] }, // despedido el Día 5
]
export const passwordOf = (username) => `Sim-${username}-2026!`

state.ids.staff ||= {}
for (const person of CAST) {
  if (state.ids.staff[person.username]) continue
  const body = {
    username: person.username,
    fullName: person.fullName,
    role: person.role,
    password: passwordOf(person.username),
    ...(person.branches === "all"
      ? { allBranches: true }
      : { allBranches: false, allowedBranchIds: person.branches }),
  }
  const created = await post("/api/staff", body, ownerBootstrapHeaders())
  const okCreate = created.status === 201 && Boolean(created.json?.staff?.id)
  check(`D0-USER-${person.username}`, `${person.fullName} (${person.role}) creado por /api/staff`, okCreate, `status=${created.status} ${created.json?.error || ""}`)
  if (okCreate) state.ids.staff[person.username] = created.json.staff.id
}
saveState(state)

const staffCount = await tableCount("staff_users")
check("D0-USER-total", "los 16 usuarios del elenco existen en staff_users", staffCount === CAST.length, `staff_users=${staffCount}`)

// Por cada usuario: login correcto, contraseña incorrecta, y navegación por rol.
let loginsOk = 0
let wrongRejected = 0
let navOk = 0
const navByRole = {}
for (const person of CAST) {
  const good = await loginStaff(person.username, passwordOf(person.username))
  if (good.ok) loginsOk += 1
  const bad = await loginStaff(`${person.username}`, "clave-equivocada-123")
  if (!bad.ok) wrongRejected += 1
  // la sesión buena quedó pisada por el intento malo: reponerla
  await loginStaff(person.username, passwordOf(person.username))
  const auth = await get(
    `/api/local-auth?moduleKey=mainPanel`,
    actorHeaders({ username: person.username, ip: "10.91.0.5" }),
  )
  const access = auth.json?.access
  if (access?.role === person.role) navOk += 1
  navByRole[person.username] = { role: access?.role, nav: access?.navModules?.length ?? 0, allBranches: access?.allBranches, branchIds: access?.allowedBranchIds }
}
check("D0-AUTH-1", "los 16 inician sesión real contra Supabase Auth", loginsOk === CAST.length, `ok=${loginsOk}/${CAST.length}`)
check("D0-AUTH-2", "la contraseña incorrecta se rechaza SIEMPRE", wrongRejected === CAST.length, `rechazadas=${wrongRejected}/${CAST.length}`)
check("D0-AUTH-3", "cada sesión reporta SU rol y su navegación por rol", navOk === CAST.length, JSON.stringify(navByRole.alejandro))
logLine(`\nNavegación por usuario: ${JSON.stringify(navByRole)}\n`)

// Restricción de sede en el token: Génesis (manager de Principal) NO es allBranches.
check(
  "D0-AUTH-4",
  "Génesis queda restringida a Principal y Luis a San Diego (en el token, no en la UI)",
  navByRole.genesis?.allBranches === false &&
    navByRole.genesis?.branchIds?.includes(PRINCIPAL) &&
    navByRole.luis?.allBranches === false &&
    navByRole.luis?.branchIds?.includes(SAN_DIEGO),
  `genesis=${JSON.stringify(navByRole.genesis)} luis=${JSON.stringify(navByRole.luis)}`,
)

// APIs permitidas vs prohibidas (positivo y negativo por rol clave).
const jesusHeaders = actorHeaders({ username: "jesus", ip: "10.91.0.7", branchId: PRINCIPAL })
const kitchenOrders = await get("/api/orders", jesusHeaders)
const kitchenReports = await get("/api/reports?period=today", jesusHeaders)
check("D0-PERM-1", "kitchen (Jesús) SÍ ve pedidos y NO ve reportes financieros", kitchenOrders.status === 200 && kitchenReports.status === 403, `orders=${kitchenOrders.status} reports=${kitchenReports.status}`)

const anthonyHeaders = actorHeaders({ username: "anthony", ip: "10.91.0.8", branchId: PRINCIPAL })
const waiterStaffApi = await post("/api/staff", { username: "pirata", password: "hackhack1", role: "owner" }, anthonyHeaders)
check("D0-PERM-2", "waiter (Anthony) NO puede crear usuarios (solo dueño/soporte)", waiterStaffApi.status === 403, `status=${waiterStaffApi.status}`)

const vanessaHeaders = actorHeaders({ username: "vanessa", ip: "10.91.0.9", branchId: PRINCIPAL })
const promoterClose = await post("/api/day-close", { dayClose: { dateLabel: "x", summaryText: "hack" } }, vanessaHeaders)
check("D0-PERM-3", "promoter (Vanessa) NO puede cerrar caja", promoterClose.status === 403 || promoterClose.status === 401, `status=${promoterClose.status}`)

// Sede cruzada: Luis (manager SD) pide la sede de Principal. El sistema NO
// devuelve 403: lo CLAMPA a su sede (resolveBranchId) — verificamos que la
// lista de sedes que él ve solo contiene la suya. (La prueba con datos reales
// de que el clamp devuelve datos de SD y no de Principal se repite el Día 1
// con pedidos distintos por sede.)
const luisBranches = await get("/api/branches", actorHeaders({ username: "luis", ip: "10.91.0.10", branchId: SAN_DIEGO }))
const luisVisible = (luisBranches.json?.branches || []).map((b) => b.name)
const luisOwn = await get("/api/reports?period=today", actorHeaders({ username: "luis", ip: "10.91.0.10", branchId: SAN_DIEGO }))
check("D0-PERM-4", "Luis (manager SD) solo ve SU sede en la lista y sus reportes responden", luisVisible.length === 1 && luisVisible[0] === "San Diego" && luisOwn.status === 200, `visibles=${JSON.stringify(luisVisible)} reports=${luisOwn.status}`)

// Anti-spoofing: un cliente que se inventa x-staff-role NO gana permisos.
const spoof = await get("/api/reports?period=today", publicHeaders("10.91.0.66", PRINCIPAL, { "x-staff-role": "owner" }))
check("D0-PERM-5", "x-staff-role inventado por el cliente se elimina en el proxy (401)", spoof.status === 401, `status=${spoof.status}`)

// Dos pestañas: dos sesiones del mismo usuario conviven.
const tabA = await loginStaff("mariafernanda", passwordOf("mariafernanda"))
const sessionA = tabA.token
await loginStaff("mariafernanda", passwordOf("mariafernanda"))
const twoTabs = await get("/api/orders", {
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionA}`,
  "x-branch-id": PRINCIPAL,
  "x-forwarded-for": "10.91.0.12",
})
check("D0-AUTH-5", "dos pestañas del mismo usuario conviven (el primer token sigue vivo)", twoTabs.status === 200, `status=${twoTabs.status}`)

// Auditoría de la creación de usuarios.
const staffAudit = await auditRows({ action: "staff.created", limit: 30 })
check("D0-AUDIT-1", "staff.created queda en auditoría por cada usuario", staffAudit.length >= CAST.length, `filas=${staffAudit.length}`)

// ── F3 · INVENTARIO (18 insumos × 2 sedes) ────────────────────────────────
console.log("\n━━ F3 · Inventario")
const INSUMOS = [
  ["Pan de hamburguesa", "unidades", 400, 60, 0.35, "Panadería"],
  ["Carne 150g", "unidades", 300, 40, 1.1, "Carnes"],
  ["Pollo desmechado", "kg", 40, 6, 4.5, "Carnes"],
  ["Queso amarillo", "kg", 30, 5, 5.2, "Charcutería"],
  ["Tocineta", "kg", 20, 4, 6.8, "Charcutería"],
  ["Papas congeladas", "kg", 120, 20, 1.9, "Congelados"],
  ["Aceite", "litros", 60, 10, 2.4, "Cocina"],
  ["Refresco 1.5L", "unidades", 150, 24, 1.6, "Bebidas"],
  ["Agua mineral", "unidades", 120, 24, 0.7, "Bebidas"],
  ["Salsa de tomate", "kg", 25, 4, 1.8, "Salsas"],
  ["Mayonesa", "kg", 25, 4, 2.1, "Salsas"],
  ["Mostaza", "kg", 12, 2, 1.9, "Salsas"],
  ["Vegetales frescos", "kg", 50, 8, 1.2, "Verduras"],
  ["Cebolla", "kg", 40, 6, 0.9, "Verduras"],
  ["Empaques burger", "unidades", 500, 80, 0.12, "Empaques"],
  ["Bolsas kraft", "unidades", 400, 60, 0.08, "Empaques"],
  ["Servilletas", "unidades", 2000, 300, 0.01, "Empaques"],
  ["Hielo", "kg", 80, 15, 0.3, "Cocina"],
]
const genesisHeaders = actorHeaders({ username: "genesis", ip: "10.91.0.20", branchId: PRINCIPAL })
const luisHeaders = actorHeaders({ username: "luis", ip: "10.91.0.21", branchId: SAN_DIEGO })
// Crear insumos/proveedores/menú es del DUEÑO (owner/support): Alejandro monta
// la fundación; el intento del manager queda como prueba negativa.
const alejandroP = actorHeaders({ username: "alejandro", ip: "10.91.0.22", branchId: PRINCIPAL })
const alejandroSD = actorHeaders({ username: "alejandro", ip: "10.91.0.22", branchId: SAN_DIEGO })

const managerInvAttempt = await post(
  "/api/inventory",
  { name: "Insumo pirata", category: "X", quantity: 1, unit: "unidades", minimumStock: 0, costUSD: 1 },
  genesisHeaders,
)
check("D0-PERM-6", "manager NO puede crear insumos (crear inventario es del dueño)", managerInvAttempt.status === 403, `status=${managerInvAttempt.status}`)

const invBook = loadInventoryBook()
state.ids.inventory ||= { [PRINCIPAL]: {}, [SAN_DIEGO]: {} }

for (const [branchId, headers, factor] of [
  [PRINCIPAL, alejandroP, 1],
  [SAN_DIEGO, alejandroSD, 0.6],
]) {
  for (const [name, unit, qty, minStock, cost, category] of INSUMOS) {
    if (state.ids.inventory[branchId][name]) continue
    const quantity = Math.round(qty * factor * 100) / 100
    const item = (
      await post(
        "/api/inventory",
        { name, category, quantity, unit, minimumStock: Math.ceil(minStock * factor), costUSD: cost },
        headers,
      )
    ).json?.inventoryItem
    if (item?.id) {
      state.ids.inventory[branchId][name] = item.id
      initItem(invBook, { branchId, itemId: item.id, name, unit, quantity })
    }
  }
}
saveState(state)
saveInventoryBook(invBook)
const invCountP = Object.keys(state.ids.inventory[PRINCIPAL]).length
const invCountSD = Object.keys(state.ids.inventory[SAN_DIEGO]).length
check("D0-INV-1", "18 insumos creados en cada sede (36 filas con stock propio)", invCountP === 18 && invCountSD === 18, `P=${invCountP} SD=${invCountSD}`)

const panP = await stockOf(state.ids.inventory[PRINCIPAL]["Pan de hamburguesa"])
const panSD = await stockOf(state.ids.inventory[SAN_DIEGO]["Pan de hamburguesa"])
check("D0-INV-2", "el stock inicial quedó como se cargó (Pan: P=400, SD=240)", panP === 400 && panSD === 240, `P=${panP} SD=${panSD}`)

// Cada carga inicial deja su movimiento en la sede correcta. (La tabla de
// movimientos no guarda autor por columna: la autoría vive en audit_logs.)
const { data: cargaMoves } = await supabase
  .from("inventory_movements")
  .select("movement_type, branch_id")
  .eq("movement_type", "Carga inicial")
  .limit(80)
const cargasP = (cargaMoves || []).filter((m) => m.branch_id === PRINCIPAL).length
const cargasSD = (cargaMoves || []).filter((m) => m.branch_id === SAN_DIEGO).length
check("D0-INV-3", "cada insumo deja su movimiento 'Carga inicial' en SU sede (18+18)", cargasP === 18 && cargasSD === 18, `P=${cargasP} SD=${cargasSD}`)

// ── F4 · PROVEEDORES ──────────────────────────────────────────────────────
console.log("\n━━ F4 · Proveedores")
const SUPPLIERS = [
  ["Carnes El Toro", "J-30111222-3", "04141112233", "Av. Bolívar, Valencia", "Ramón Torrealba", "Crédito 15 días"],
  ["Panadería La Espiga", "J-30444555-6", "04142223344", "C.C. San Diego", "Marta Rojas", "Contado"],
  ["Bebidas Corocorote", "J-30777888-9", "04143334455", "Zona Ind. Carabobo", "Pedro Istúriz", "Crédito 30 días"],
  ["Empaques Carabobo", "J-30222333-1", "04144445566", "Flor Amarillo", "Nancy Bellorín", "Contado"],
  ["Verduras Doña Chela", "V-12345678-9", "04145556677", "Mercado Mayorista", "Chela Guaramato", "Crédito 7 días"],
]
state.ids.suppliers ||= {}
for (const [name, taxId, phone, address, contactName, credit] of SUPPLIERS) {
  if (state.ids.suppliers[name]) continue
  const created = await post(
    "/api/suppliers",
    { name, taxId, phone, address, contactName, notes: credit },
    alejandroP,
  )
  if (created.json?.supplier?.id) state.ids.suppliers[name] = created.json.supplier.id
}
saveState(state)
check("D0-PROV-1", "los 5 proveedores existen", Object.keys(state.ids.suppliers).length === 5, JSON.stringify(Object.keys(state.ids.suppliers)))

// ── F5 · COMPRAS INICIALES (2 pagadas, 2 a crédito, 1 abono parcial) ──────
console.log("\n━━ F5 · Compras iniciales")
const hoy = new Date().toISOString().slice(0, 10)
const enDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const ledger = loadLedger()
const buys = [
  // [proveedor, doc, totalUSD, insumo, cantidad, modo]
  ["Carnes El Toro", "FT-1001", 220, "Carne 150g", 200, "credito", 15],
  ["Panadería La Espiga", "PE-501", 70, "Pan de hamburguesa", 200, "pagada"],
  ["Bebidas Corocorote", "BC-88", 96, "Refresco 1.5L", 60, "credito", 30],
  ["Empaques Carabobo", "EC-77", 36, "Empaques burger", 300, "pagada"],
  ["Verduras Doña Chela", "VC-33", 60, "Vegetales frescos", 50, "parcial", 7],
]
state.ids.purchases ||= {}
for (const [supplierName, doc, totalUSD, itemName, qty, mode, days] of buys) {
  if (state.ids.purchases[doc]) continue
  const itemId = state.ids.inventory[PRINCIPAL][itemName]
  const stockBefore = await stockOf(itemId)
  const compra = await post(
    "/api/supplier-purchases",
    {
      supplierId: state.ids.suppliers[supplierName],
      purchaseDate: hoy,
      dueDate: mode === "pagada" ? hoy : enDias(days || 7),
      documentNumber: doc,
      totalUSD,
      inventoryItemId: itemId,
      inventoryQuantity: qty,
      note: `SIM fundación · ${mode}`,
    },
    alejandroP,
  )
  const purchaseId = compra.json?.purchase?.id
  check(`D0-COMPRA-${doc}`, `factura ${doc} de ${supplierName} ($${totalUSD}, ${mode})`, compra.status === 201 && Boolean(purchaseId), `status=${compra.status}`)
  if (!purchaseId) continue
  state.ids.purchases[doc] = purchaseId
  applyMove(invBook, { branchId: PRINCIPAL, itemId, type: "Compra", qty })
  const stockAfter = await stockOf(itemId)
  check(`D0-COMPRA-${doc}-stock`, `la compra suma stock (${itemName}: ${stockBefore}→${stockBefore + qty})`, stockAfter === stockBefore + qty, `real=${stockAfter}`)

  let paid = 0
  if (mode === "pagada") paid = totalUSD
  if (mode === "parcial") paid = Math.round(totalUSD * 0.4 * 100) / 100
  if (paid > 0) {
    await post(
      `/api/supplier-purchases/${purchaseId}/payments`,
      { amountUSD: paid, method: "Transferencia", paymentDate: hoy, note: "pago fundación" },
      alejandroP,
    )
  }
  recordSupplierInvoice(ledger, { invoiceKey: doc, totalUSD, paidUSD: paid })
  recordSupplierPayment(ledger, { invoiceKey: doc, amountUSD: 0 })
}
saveState(state)
saveInventoryBook(invBook)

// Verificación de saldos por factura contra el libro esperado.
const purchasesNow = (await get(`/api/supplier-purchases`, alejandroP)).json?.purchases || []
let payablesOk = true
const payablesDetail = []
for (const [doc] of buys.map((b) => [b[1]])) {
  const expected = ledger.suppliers[doc]
  if (!expected) { payablesOk = false; payablesDetail.push(doc + ": sin factura creada"); continue }
  const real = purchasesNow.find((p) => p.documentNumber === doc || p.document_number === doc)
  const realPending = Number(real?.pendingUSD ?? NaN)
  if (Math.abs(realPending - expected.pendingUSD) > 0.009) payablesOk = false
  payablesDetail.push(`${doc}: esperado=$${expected.pendingUSD} real=$${realPending}`)
}
check("D0-COMPRA-saldos", "los saldos por pagar cuadran al centavo (2 en $0, 2 completas, 1 abonada)", payablesOk, payablesDetail.join(" · "))
saveLedger(ledger)

// ── F6 · MENÚ (Principal propio + verificación de herencia + SD propio) ───
console.log("\n━━ F6 · Menú")

// ANTES de que San Diego tenga menú propio: hereda el de Principal.
// (Se comprueba con el primer producto ya creado en Principal.)
const menuInherit = async () => (await get("/api/public/products", publicHeaders("10.92.0.5", SAN_DIEGO))).json

const inv = state.ids.inventory
const mkRecipe = (branchId, pairs) =>
  pairs.map(([itemName, quantity, unit]) => ({
    itemId: inv[branchId][itemName],
    itemName,
    quantity,
    unit: unit || "unidades",
  }))

// Recetario base (mismas recetas, insumos de la sede que corresponda).
const RECIPES = {
  "Burger Clásica": [["Pan de hamburguesa", 1], ["Carne 150g", 1], ["Queso amarillo", 0.03, "kg"], ["Vegetales frescos", 0.05, "kg"], ["Empaques burger", 1]],
  "Burger Doble Brutal": [["Pan de hamburguesa", 1], ["Carne 150g", 2], ["Queso amarillo", 0.05, "kg"], ["Tocineta", 0.04, "kg"], ["Empaques burger", 1]],
  "Burger de Pollo": [["Pan de hamburguesa", 1], ["Pollo desmechado", 0.15, "kg"], ["Mayonesa", 0.02, "kg"], ["Empaques burger", 1]],
  "Papas Medianas": [["Papas congeladas", 0.25, "kg"], ["Aceite", 0.03, "litros"], ["Servilletas", 4]],
  "Papas Brutales": [["Papas congeladas", 0.4, "kg"], ["Queso amarillo", 0.04, "kg"], ["Tocineta", 0.03, "kg"], ["Aceite", 0.04, "litros"]],
  "Tequeños (6)": [["Queso amarillo", 0.12, "kg"], ["Aceite", 0.05, "litros"], ["Servilletas", 6]],
  "Refresco 1.5L": [["Refresco 1.5L", 1]],
  "Agua mineral": [["Agua mineral", 1]],
  "Ensalada de la casa": [["Vegetales frescos", 0.2, "kg"], ["Cebolla", 0.05, "kg"]],
  "Salchipapa": [["Papas congeladas", 0.3, "kg"], ["Aceite", 0.04, "litros"], ["Salsa de tomate", 0.03, "kg"]],
  "Burger Vegetariana": [["Pan de hamburguesa", 1], ["Vegetales frescos", 0.15, "kg"], ["Cebolla", 0.03, "kg"], ["Empaques burger", 1]],
  "Nuggets (8)": [["Pollo desmechado", 0.2, "kg"], ["Aceite", 0.05, "litros"]],
}

const PRODUCTS = [
  // [nombre, categoría, precio, tipo, extras]
  ["Burger Clásica", "Hamburguesas", 6.5, "normal", {}],
  ["Burger Doble Brutal", "Hamburguesas", 9.5, "variations", {
    variations: [
      { id: "v-sencilla", name: "Sencilla", priceDelta: -1.5 },
      { id: "v-doble", name: "Doble", priceDelta: 0 },
      { id: "v-triple", name: "Triple", priceDelta: 2 },
    ],
  }],
  ["Burger de Pollo", "Hamburguesas", 7, "addons", {
    addons: [
      { id: "a-tocineta", name: "Tocineta extra", price: 1.5 },
      { id: "a-queso", name: "Queso extra", price: 1 },
      { id: "a-huevo", name: "Huevo frito", price: 0.8 },
    ],
  }],
  ["Burger Vegetariana", "Hamburguesas", 6, "normal", {}],
  ["Papas Medianas", "Acompañantes", 3, "normal", {}],
  ["Papas Brutales", "Acompañantes", 5.5, "normal", {}],
  ["Tequeños (6)", "Acompañantes", 4, "normal", {}],
  ["Nuggets (8)", "Acompañantes", 4.5, "normal", {}],
  ["Salchipapa", "Acompañantes", 4, "normal", {}],
  ["Ensalada de la casa", "Acompañantes", 3.5, "normal", {}],
  ["Refresco 1.5L", "Bebidas", 2.5, "normal", {}],
  ["Agua mineral", "Bebidas", 1.5, "normal", {}],
]
const COMBOS = [
  ["Combo Brutal", "Combos", 13, ["Burger Doble Brutal", "Papas Medianas", "Refresco 1.5L"]],
  ["Combo Pareja", "Combos", 19, ["Burger Clásica", "Burger de Pollo", "Papas Brutales", "Refresco 1.5L"]],
]

state.ids.menu ||= { [PRINCIPAL]: {}, [SAN_DIEGO]: {} }
let nextProductId = 202608010001

async function createMenuFor(branchId, headers, { exclusiveSkip = null, extraProducts = [], priceOverrides = {} } = {}) {
  const created = {}
  for (const [name, category, price, productType, extras] of PRODUCTS) {
    if (name === exclusiveSkip) continue
    if (state.ids.menu[branchId][name]) { created[name] = state.ids.menu[branchId][name]; continue }
    const id = nextProductId++
    const res = await post(
      "/api/menu-products",
      {
        id,
        name,
        category,
        price: priceOverrides[name] ?? price,
        productType,
        isActive: true,
        inventoryDiscountEnabled: true,
        salesChannels: ["local", "takeaway", "delivery"],
        ...extras,
      },
      headers,
    )
    if (res.status === 200 || res.status === 201) {
      created[name] = id
      state.ids.menu[branchId][name] = id
      if (RECIPES[name]) {
        await post(
          "/api/inventory-recipes",
          { productId: id, productName: name, ingredients: mkRecipe(branchId, RECIPES[name]) },
          headers,
        )
      }
    }
  }
  for (const [name, category, price, parts] of COMBOS) {
    if (state.ids.menu[branchId][name]) { created[name] = state.ids.menu[branchId][name]; continue }
    const id = nextProductId++
    const res = await post(
      "/api/menu-products",
      {
        id,
        name,
        category,
        price,
        productType: "combo",
        isActive: true,
        inventoryDiscountEnabled: true,
        comboItems: parts.map((p) => ({ productId: created[p] || state.ids.menu[branchId][p], name: p, quantity: 1 })),
      },
      headers,
    )
    if (res.status === 200 || res.status === 201) {
      state.ids.menu[branchId][name] = id
      // receta del combo = suma de las recetas de sus partes
      const comboIngredients = parts.flatMap((p) => (RECIPES[p] ? mkRecipe(branchId, RECIPES[p]) : []))
      if (comboIngredients.length) {
        await post(
          "/api/inventory-recipes",
          { productId: id, productName: name, ingredients: comboIngredients },
          headers,
        )
      }
    }
  }
  for (const extra of extraProducts) {
    if (state.ids.menu[branchId][extra.name]) continue
    const id = nextProductId++
    const res = await post(
      "/api/menu-products",
      { id, isActive: true, inventoryDiscountEnabled: false, ...extra },
      headers,
    )
    if (res.status === 200 || res.status === 201) state.ids.menu[branchId][extra.name] = id
  }
}

// 1) Menú de Principal completo.
await createMenuFor(PRINCIPAL, alejandroP, {
  extraProducts: [
    { name: "Malta artesanal El Cacri", category: "Bebidas", price: 2.8 }, // exclusivo de Principal
  ],
})
const menuPCount = Object.keys(state.ids.menu[PRINCIPAL]).length
check("D0-MENU-1", "Principal tiene su menú completo (12 productos + 2 combos + 1 exclusivo)", menuPCount === 15, `productos=${menuPCount}`)

// 2) HERENCIA: San Diego aún sin menú propio → el público de SD ve el de
//    Principal. Solo verificable mientras SD no tenga menú (en reanudación ya
//    lo tiene y la evidencia PASS quedó en la bitácora de la primera pasada).
if (!Object.keys(state.ids.menu[SAN_DIEGO]).length) {
  const inherited = await menuInherit()
  const inheritedNames = (inherited?.menuProducts || inherited?.products || []).map((p) => p.name)
  check("D0-MENU-2", "San Diego SIN menú propio hereda el menú de Principal (público)", inheritedNames.includes("Burger Clásica") && inheritedNames.includes("Malta artesanal El Cacri"), `hereda ${inheritedNames.length} productos`)
} else {
  console.log("○ [D0-MENU-2] herencia ya verificada en la primera pasada (SD ya tiene menú propio)")
}

// 3) Menú propio de San Diego: precio distinto en la Doble, SIN la malta de
//    Principal, y con un exclusivo propio.
await createMenuFor(SAN_DIEGO, alejandroSD, {
  priceOverrides: { "Burger Doble Brutal": 10 },
  extraProducts: [
    { name: "Patacón San Diego", category: "Especiales", price: 8.5 }, // exclusivo SD
  ],
})
const menuSDCount = Object.keys(state.ids.menu[SAN_DIEGO]).length
check("D0-MENU-3", "San Diego crea su menú propio (14 + 1 exclusivo)", menuSDCount === 15, `productos=${menuSDCount}`)

const sdMenu = await menuInherit()
const sdNames = (sdMenu?.menuProducts || sdMenu?.products || []).map((p) => p.name)
const sdDoble = (sdMenu?.menuProducts || sdMenu?.products || []).find((p) => p.name === "Burger Doble Brutal")
check("D0-MENU-4", "con menú propio, SD deja de heredar: ve SU menú (con Patacón, sin Malta)", sdNames.includes("Patacón San Diego") && !sdNames.includes("Malta artesanal El Cacri"), `productos=${sdNames.length}`)
check("D0-MENU-5", "la Doble Brutal cuesta $10 en SD y $9.50 en Principal (precio por sede)", Number(sdDoble?.price) === 10, `SD=$${sdDoble?.price}`)

const pubMenuP = (await get("/api/public/products", publicHeaders("10.92.0.6", PRINCIPAL))).json
const pNames = (pubMenuP?.menuProducts || pubMenuP?.products || []).map((p) => p.name)
check("D0-MENU-6", "Principal NO ve el exclusivo de SD (aislamiento del menú)", pNames.includes("Malta artesanal El Cacri") && !pNames.includes("Patacón San Diego"), `productos=${pNames.length}`)
saveState(state)

// ── F7 · GASTOS DE FUNDACIÓN ──────────────────────────────────────────────
console.log("\n━━ F7 · Gastos")
const GASTOS = [
  [PRINCIPAL, genesisHeaders, "Alquiler local Principal (ficticio)", 350, "Alquiler"],
  [PRINCIPAL, genesisHeaders, "Limpieza profunda de apertura", 40, "Limpieza"],
  [PRINCIPAL, genesisHeaders, "Hielo de arranque", 12, "Otros"],
  [SAN_DIEGO, luisHeaders, "Mantenimiento menor plancha SD", 25, "Mantenimiento"],
]
state.ids.expenses ||= {}
for (const [branchId, headers, concept, amountUSD, category] of GASTOS) {
  if (state.ids.expenses[concept]) continue
  const gasto = await post("/api/day-expenses", { concept, amountUSD, category, method: "Efectivo" }, headers)
  const gastoId = gasto.json?.dayExpense?.id || gasto.json?.expense?.id
  check(`D0-GASTO-${concept.slice(0, 12)}`, `gasto "${concept}" ($${amountUSD})`, (gasto.status === 200 || gasto.status === 201) && Boolean(gastoId), `status=${gasto.status}`)
  if (gastoId) {
    state.ids.expenses[concept] = gastoId
    recordExpense(ledger, { day: "dia-0", branchId, amountUSD })
  }
}
saveState(state)
saveLedger(ledger)

// ── F8 · LÍNEA BASE Y CIERRE TÉCNICO ──────────────────────────────────────
console.log("\n━━ F8 · Línea base")
const counts = {}
for (const table of ["branches", "staff_users", "inventory_items", "inventory_movements", "suppliers", "supplier_purchases", "menu_products", "inventory_recipes", "day_expenses", "orders", "audit_logs"]) {
  counts[table] = await tableCount(table)
}
logLine(`\nLínea base (conteo por tabla): ${JSON.stringify(counts)}\n`)
check("D0-BASE-1", "la base de fundación está poblada y sin pedidos aún", counts.orders === 0 && counts.menu_products === 30 && counts.inventory_items === 36, JSON.stringify(counts))

// Cierre TÉCNICO de fundación (claramente separado del historial comercial).
const cierreTecnico = await post(
  "/api/day-close",
  {
    dayClose: {
      dateLabel: "FUNDACIÓN (Día 0 — técnico)",
      summaryText: "sim:brotherhood-week-001 · cierre técnico de fundación. NO es un día comercial.",
      ordersRegistered: 0,
      totalSoldUSD: 0,
      realCollectedUSD: 0,
      realCashUSD: 0,
      realVES: 0,
      realPendingUSD: 0,
      totalConfirmedUSD: 0,
      paymentByUSDMethod: [],
      paymentByVESMethod: [],
      expenses: GASTOS.filter((g) => g[0] === PRINCIPAL).map(([, , concept, amountUSD]) => ({ id: state.ids.expenses[concept], concept, amountUSD })),
    },
  },
  actorHeaders({ username: "alejandro", ip: "10.91.0.30", branchId: PRINCIPAL }),
)
check("D0-BASE-2", "cierre técnico de fundación registrado (Principal)", cierreTecnico.status === 200, `status=${cierreTecnico.status}`)
state.ids.cierreTecnico = cierreTecnico.json?.dayClose?.id

const cierreTecnicoSD = await post(
  "/api/day-close",
  {
    dayClose: {
      dateLabel: "FUNDACIÓN SD (Día 0 — técnico)",
      summaryText: "sim:brotherhood-week-001 · cierre técnico de fundación SD.",
      ordersRegistered: 0,
      totalSoldUSD: 0,
      realCollectedUSD: 0,
      realCashUSD: 0,
      realVES: 0,
      realPendingUSD: 0,
      totalConfirmedUSD: 0,
      paymentByUSDMethod: [],
      paymentByVESMethod: [],
      expenses: GASTOS.filter((g) => g[0] === SAN_DIEGO).map(([, , concept, amountUSD]) => ({ id: state.ids.expenses[concept], concept, amountUSD })),
    },
  },
  actorHeaders({ username: "alejandro", ip: "10.91.0.30", branchId: SAN_DIEGO }),
)
check("D0-BASE-3", "cierre técnico de fundación registrado (San Diego)", cierreTecnicoSD.status === 200, `status=${cierreTecnicoSD.status}`)
state.ids.cierreTecnicoSD = cierreTecnicoSD.json?.dayClose?.id

state.completedDays = Array.from(new Set([...(state.completedDays || []), "dia-0"]))
state.rate = RATE
saveState(state)
flushPerformance("dia-0")

// Versión del código para reproducibilidad.
const commit = execSync("git rev-parse HEAD").toString().trim()
writeJson("config.json", {
  run_id: simEnv.SIMULATION_RUN_ID,
  seed: SEED,
  project_ref: "gnyvdlxlrjwbsdctincy",
  base: "http://localhost:3181",
  exchange_rate: RATE,
  commit_inicial: commit,
  timezone: "America/Caracas",
  estrategia_dia_comercial:
    "created_at es real (todos los días simulados caen en la misma fecha real). " +
    "El 'día comercial' lo marcan los CIERRES de caja por sede: cada día simulado " +
    "termina con day-close por sede y las validaciones contables se hacen contra el " +
    "cierre y el libro esperado, no contra la fecha calendario. Los reportes " +
    "period=today se validan por DELTAS dentro del mismo día simulado. Prohibido " +
    "falsear timestamps en la base.",
  dias_simulados: {
    "dia-0": "2026-08-02 (fundación)",
    "dia-1": "2026-08-03 lunes",
    "dia-2": "2026-08-04 martes",
    "dia-3": "2026-08-05 miércoles",
    "dia-4": "2026-08-06 jueves",
    "dia-5": "2026-08-07 viernes",
    "dia-6": "2026-08-08 sábado",
    "dia-7": "2026-08-09 domingo",
  },
})

const result = summary("Día 0 — Fundación")
process.exit(result.fail > 0 ? 1 : 0)
