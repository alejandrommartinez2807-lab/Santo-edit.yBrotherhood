// QA ronda 2026-07-27 · F2/F8: sedes, QR de mesa, correlativos por sede y
// el lado LEÍBLE del cierre del día.
//
// Nota deliberada: NO se ejecuta un cierre del día real. POST /api/day-close
// BORRA todas las filas de payment_proofs de la sede (clearPaymentProofs) y
// además escribiría una fila en el historial que el dueño ve como real. En
// una BD de producción eso no es una prueba, es un daño. Se prueba el lado
// de lectura y el aislamiento, y el informe dice cómo probar el cierre
// completo cuando haya una sede desechable.
//
// Uso:  npm run qa:branches      (dev server en :3177)
import {
  BASE,
  BRANCH_SAN_DIEGO,
  BRANCH_VINEDO,
  assertBrotherhood,
  check,
  get,
  postOrderThrottled,
  summary,
  supabase,
} from "./qa-lib.mjs"

const RUN = `ZZTEST-${Date.now()}`
const A = BRANCH_SAN_DIEGO
const B = BRANCH_VINEDO

const publicGet = (path, branchId) =>
  fetch(`${BASE}${path}`, { headers: { "x-branch-id": branchId } }).then((r) => r.json())

await assertBrotherhood()
console.log(`F2/F8 · sedes, QR y correlativos · run=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// S1 · EL QR DE UNA MESA ABRE EL MENÚ DE SU SEDE
// ───────────────────────────────────────────────────────────────────────────
console.log("── S1 · el QR de la mesa abre el menú de su sede")
{
  const configA = await publicGet("/api/public/business-config", A)
  const configB = await publicGet("/api/public/business-config", B)
  const nameA = configA?.businessConfig?.branchName || configA?.branchName || configA?.businessConfig?.businessName
  const nameB = configB?.businessConfig?.branchName || configB?.branchName || configB?.businessConfig?.businessName
  check("S1 · cada sede sirve su propia configuración pública", Boolean(configA?.ok !== false && configB?.ok !== false), `A="${nameA}" B="${nameB}"`)

  // El cliente tiene un botón "Enviar por WhatsApp": tiene que haber número.
  const mainA = configA?.businessConfig?.mainWhatsapp || ""
  const mainB = configB?.businessConfig?.mainWhatsapp || ""
  const delivA = configA?.businessConfig?.deliveryWhatsapp || ""
  const delivB = configB?.businessConfig?.deliveryWhatsapp || ""
  check(
    "S1 · cada sede publica un WhatsApp de contacto para el cliente",
    Boolean(mainA && mainB),
    `A main="${mainA}" delivery="${delivA}" · B main="${mainB}" delivery="${delivB}" · el botón "${configA?.businessConfig?.publicCartWhatsappButtonText}" existe, el número no`,
  )

  // Mesa 3 existe en las dos sedes: el estado tiene que ser independiente.
  const mesaA = await publicGet("/api/public/table-account-status?mesa=Mesa%203", A)
  const mesaB = await publicGet("/api/public/table-account-status?mesa=Mesa%203", B)
  check("S1 · la Mesa 3 se resuelve en las dos sedes", mesaA?.ok === true && mesaB?.ok === true, `A=${mesaA?.tableName} B=${mesaB?.tableName}`)
  check(
    "S1 · la cuenta de la Mesa 3 de A no es la de la Mesa 3 de B",
    !mesaA?.openAccount || !mesaB?.openAccount || mesaA.openAccount.id !== mesaB.openAccount.id,
    `A=${mesaA?.openAccount?.id || "sin cuenta"} B=${mesaB?.openAccount?.id || "sin cuenta"}`,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// S2 · UN PEDIDO DESDE EL QR CAE EN LA SEDE Y LA MESA CORRECTAS
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── S2 · el pedido del QR cae donde debe")
{
  const mk = async (branchId, mesa, tag) => {
    const { json } = await postOrderThrottled(
      {
        customerName: `${RUN}-${tag}`,
        customerPhone: "04140000012",
        tableNumber: mesa,
        orderType: "Comer aquí",
        exchangeRate: 40,
        items: [{ id: 999008, name: `${RUN}-ITEM`, price: 7, quantity: 1 }],
      },
      { "x-branch-id": branchId },
    )
    return json?.order
  }

  const oA = await mk(A, "Mesa 4", "QR-A")
  const oB = await mk(B, "Mesa 4", "QR-B")

  const { data: rows } = await supabase
    .from("orders")
    .select("id, branch_id, table_number, branch_seq, branch_code, seq")
    .in("id", [oA?.id, oB?.id].filter(Boolean))

  const rowA = (rows || []).find((r) => r.id === oA?.id)
  const rowB = (rows || []).find((r) => r.id === oB?.id)

  check("S2 · el pedido de A quedó en A con su mesa", rowA?.branch_id === A && rowA?.table_number === "Mesa 4", JSON.stringify(rowA))
  check("S2 · el pedido de B quedó en B con su mesa", rowB?.branch_id === B && rowB?.table_number === "Mesa 4", JSON.stringify(rowB))

  // Correlativo por sede (0025, order_branch_counters).
  check(
    "S2 · cada sede lleva su propio correlativo (branch_seq + branch_code)",
    Boolean(rowA?.branch_seq && rowB?.branch_seq) && rowA?.branch_code !== rowB?.branch_code,
    `A=#${rowA?.branch_seq}-${rowA?.branch_code} B=#${rowB?.branch_seq}-${rowB?.branch_code}`,
  )

  const { data: counters } = await supabase.from("order_branch_counters").select("*")
  check(
    "S2 · hay un contador por sede en order_branch_counters",
    (counters?.length ?? 0) >= 2,
    JSON.stringify(counters),
  )
}

// ───────────────────────────────────────────────────────────────────────────
// S3 · CUENTAS ABIERTAS CON EL MISMO NÚMERO DE MESA EN LAS DOS SEDES
// (índice único 0033/0035, normalizado)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── S3 · el índice único de cuenta abierta por sede")
{
  const { data: abiertas } = await supabase
    .from("open_accounts")
    .select("id, table_number, branch_id")
    .eq("status", "Abierta")

  const porMesa = new Map()
  for (const cuenta of abiertas || []) {
    const key = `${cuenta.branch_id}::${String(cuenta.table_number || "").trim().toLowerCase()}`
    porMesa.set(key, (porMesa.get(key) || 0) + 1)
  }
  const duplicadas = [...porMesa.entries()].filter(([, n]) => n > 1)
  check(
    "S3 · ninguna sede tiene dos cuentas Abiertas de la misma mesa (índice normalizado vivo)",
    duplicadas.length === 0,
    `cuentas abiertas=${abiertas?.length ?? 0} · duplicadas=${JSON.stringify(duplicadas)}`,
  )

  const mesasCompartidas = new Set()
  for (const cuenta of abiertas || []) {
    const mesa = String(cuenta.table_number || "").trim().toLowerCase()
    const otras = (abiertas || []).filter((c) => String(c.table_number || "").trim().toLowerCase() === mesa && c.branch_id !== cuenta.branch_id)
    if (otras.length) mesasCompartidas.add(mesa)
  }
  check(
    "S3 · la MISMA mesa puede estar abierta en dos sedes a la vez",
    mesasCompartidas.size > 0,
    mesasCompartidas.size > 0 ? `mesas con cuenta simultánea en ambas sedes: ${[...mesasCompartidas].join(", ")}` : "no hay ninguna hoy: no se pudo comprobar con datos vivos",
  )

  // Intento directo de duplicar (el índice debe rechazarlo en la BD).
  const { data: unaAbierta } = await supabase
    .from("open_accounts")
    .select("id, table_number, branch_id, customer_name")
    .eq("status", "Abierta")
    .limit(1)
    .maybeSingle()

  if (unaAbierta) {
    const { error } = await supabase.from("open_accounts").insert({
      id: crypto.randomUUID(),
      branch_id: unaAbierta.branch_id,
      // Mismo nombre pero con mayúsculas y espacios: la 0035 lo normaliza.
      table_number: `  ${String(unaAbierta.table_number).toUpperCase()}  `,
      customer_name: `${RUN}-DUPLICADA`,
      status: "Abierta",
      total_estimated_usd: 0,
      total_collected_usd: 0,
      pending_usd: 0,
    })
    check(
      "S3 · la BD rechaza una segunda cuenta Abierta de la misma mesa aunque cambie mayúsculas/espacios",
      Boolean(error),
      error ? `rechazada: ${error.code}` : "¡ACEPTADA! el índice 0035 no está aplicado",
    )
    if (!error) await supabase.from("open_accounts").delete().ilike("customer_name", `${RUN}%`)
  } else {
    check("S3 · prueba del índice", true, "NO PROBADO: no hay ninguna cuenta abierta viva para intentar duplicar")
  }
}

// ───────────────────────────────────────────────────────────────────────────
// S4 · CIERRE DEL DÍA: historial por sede (solo lectura)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── S4 · historial de cierres por sede")
{
  const histA = await get("/api/day-closes", { "x-branch-id": A })
  const histB = await get("/api/day-closes", { "x-branch-id": B })
  const arrA = histA.json?.dayCloses || []
  const arrB = histB.json?.dayCloses || []
  const idsA = new Set(arrA.map((c) => c.id))
  const compartidos = arrB.filter((c) => idsA.has(c.id)).length

  check("S4 · el historial de cierres responde en las dos sedes", histA.status === 200 && histB.status === 200, `A=${arrA.length} cierres · B=${arrB.length}`)
  check("S4 · A y B no comparten ni un cierre", compartidos === 0, `compartidos=${compartidos}`)

  const todos = await get("/api/day-closes?scope=all", { "x-branch-id": A })
  const arrTodos = todos.json?.dayCloses || []
  check(
    "S4 · el consolidado del dueño trae los de las dos sedes",
    arrTodos.length >= arrA.length + arrB.length,
    `A=${arrA.length} B=${arrB.length} consolidado=${arrTodos.length}`,
  )

  const { data: filas } = await supabase.from("day_closes").select("id, branch_id").limit(200)
  const sinSede = (filas || []).filter((f) => !f.branch_id).length
  check(
    "S4 · cada cierre guardado conserva su etiqueta de sede",
    sinSede === 0,
    `cierres sin branch_id=${sinSede} de ${filas?.length ?? 0}`,
  )

  console.log("   · NO PROBADO a propósito: ejecutar un cierre real (POST /api/day-close) BORRA")
  console.log("     todos los payment_proofs de la sede y escribe una fila en el historial del dueño.")
}

// ───────────────────────────────────────────────────────────────────────────
// LIMPIEZA
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── limpieza")
{
  const { data: orders } = await supabase.from("orders").select("id").ilike("customer_name", `${RUN}%`)
  const ids = (orders || []).map((o) => o.id)
  if (ids.length) {
    await supabase.from("order_items").delete().in("order_id", ids)
    await supabase.from("orders").delete().in("id", ids)
  }
  await supabase.from("open_accounts").delete().ilike("customer_name", `${RUN}%`)
  const { data: leftovers } = await supabase.from("orders").select("id").ilike("customer_name", "ZZTEST%")
  check("limpieza · 0 pedidos ZZTEST sueltos", (leftovers?.length ?? 0) === 0, `borrados=${ids.length}`)
}

process.exit(summary("F2/F8 sedes y QR") > 0 ? 1 : 0)
