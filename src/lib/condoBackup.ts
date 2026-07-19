import { getSupabaseAdmin } from "@/lib/supabaseServer"

// ============================================================
// Respaldo del condominio: vuelca TODAS las tablas de datos a un JSON y lo
// sube a un bucket privado de Storage ("backups"). Lo usan el cron diario y
// el botón manual del panel. Es de solo LECTURA sobre la BD (no borra nada).
// ============================================================

export const BACKUP_BUCKET = "backups"

// Orden pensado para restaurar: primero catálogos, luego dependientes.
export const CONDO_TABLES = [
  "branches",
  "business_config",
  "staff_users",
  "unit_types",
  "units",
  "residents",
  "unit_residents",
  "portal_access",
  "vehicles",
  "pets",
  "providers",
  "expense_categories",
  "budgets",
  "budget_lines",
  "expenses",
  "fee_periods",
  "charges",
  "receipts",
  "payments",
  "payment_allocations",
  "amenities",
  "amenity_blackouts",
  "amenity_reservations",
  "tickets",
  "ticket_updates",
  "maintenance_assets",
  "maintenance_tasks",
  "announcements",
  "announcement_reads",
  "notifications_log",
  "message_threads",
  "messages",
  "assemblies",
  "assembly_attendance",
  "polls",
  "poll_options",
  "votes",
  "visitors",
  "access_events",
  "deliveries",
  "documents",
  "document_reads",
  "audit_logs",
]

export type BackupResult = {
  generatedAt: string
  version: number
  tables: Record<string, unknown[]>
  counts: Record<string, number>
  totalRows: number
}

export async function buildBackup(): Promise<BackupResult> {
  const supabase = getSupabaseAdmin()
  const tables: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}
  let totalRows = 0

  for (const table of CONDO_TABLES) {
    const { data, error } = await supabase.from(table).select("*")
    // Una tabla que aún no exista no debe tumbar el respaldo completo.
    if (error) {
      tables[table] = []
      counts[table] = 0
      continue
    }
    const rows = data ?? []
    tables[table] = rows
    counts[table] = rows.length
    totalRows += rows.length
  }

  return { generatedAt: new Date().toISOString(), version: 1, tables, counts, totalRows }
}

async function ensureBucket() {
  const supabase = getSupabaseAdmin()
  // createBucket falla si ya existe: lo ignoramos.
  await supabase.storage.createBucket(BACKUP_BUCKET, { public: false }).catch(() => undefined)
}

// Sube el respaldo al bucket y poda los más viejos (deja los últimos `keep`).
export async function storeBackup(keep = 30): Promise<{ path: string; totalRows: number }> {
  const backup = await buildBackup()
  await ensureBucket()
  const supabase = getSupabaseAdmin()
  const stamp = backup.generatedAt.replace(/[:.]/g, "-")
  const path = `snapshot-${stamp}.json`

  const { error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .upload(path, JSON.stringify(backup), { contentType: "application/json", upsert: true })
  if (error) throw new Error(error.message)

  // Poda: conserva los últimos `keep`.
  const { data: list } = await supabase.storage.from(BACKUP_BUCKET).list("", {
    limit: 1000,
    sortBy: { column: "name", order: "desc" },
  })
  const snapshots = (list ?? []).filter((f) => f.name.startsWith("snapshot-")).map((f) => f.name)
  const toDelete = snapshots.slice(keep)
  if (toDelete.length) {
    await supabase.storage.from(BACKUP_BUCKET).remove(toDelete).catch(() => undefined)
  }

  return { path, totalRows: backup.totalRows }
}
