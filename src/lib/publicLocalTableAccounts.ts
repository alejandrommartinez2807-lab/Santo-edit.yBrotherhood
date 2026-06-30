import type { LocalTable, OpenAccount } from "@/lib/orders"

export function cleanPublicTableText(value: unknown) {
  return String(value || "").trim()
}

export function normalizePublicTableLookup(value: unknown) {
  return cleanPublicTableText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getActivePublicLocalTables(tables: LocalTable[]) {
  return tables.filter((table) => table.isActive !== false)
}

export function resolvePublicLocalTable(requestedTable: string, tables: LocalTable[]) {
  const requestedKey = normalizePublicTableLookup(requestedTable)

  if (!requestedKey) return null

  return (
    tables.find((table) => {
      const tableNameKey = normalizePublicTableLookup(table.name)
      const tableIdKey = normalizePublicTableLookup(table.id)

      return requestedKey === tableNameKey || requestedKey === tableIdKey
    }) || null
  )
}

export function findOpenAccountForPublicTable(
  openAccounts: OpenAccount[],
  tableName: string,
) {
  const tableKey = normalizePublicTableLookup(tableName)

  if (!tableKey) return null

  return (
    openAccounts.find(
      (account) => normalizePublicTableLookup(account.tableNumber) === tableKey,
    ) || null
  )
}

export function hasOpenAccountForPublicTable(
  openAccounts: OpenAccount[],
  tableName: string,
) {
  return Boolean(findOpenAccountForPublicTable(openAccounts, tableName))
}
