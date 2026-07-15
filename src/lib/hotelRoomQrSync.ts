// ============================================================
// QR POR HABITACIÓN · sincronización automática (server)
//
// Cada habitación tiene su "mesa" QR generada AUTOMÁTICAMENTE: al crear,
// renombrar o eliminar habitaciones, las mesas del área "Habitaciones" se
// regeneran desde la tabla de habitaciones (id estable `hab-<roomId>`, así el
// QR impreso sobrevive a un cambio de nombre). Las mesas del restaurante
// (cualquier otra área) no se tocan.
// ============================================================

import { getRawBusinessConfig, getRooms, saveBusinessConfig } from "@/lib/orders"
import { normalizeLocalTablesConfig } from "@/lib/ordersBusinessConfig"

export const ROOM_QR_AREA = "Habitaciones"

/** Nombre visible de la mesa-QR de una habitación ("101" → "Habitación 101"). */
export function roomQrTableName(roomName: string): string {
  const clean = String(roomName || "").trim()
  if (!clean) return ""
  return /^(habitaci|hab\.?\s|suite|room\s)/i.test(clean) ? clean : `Habitación ${clean}`
}

/** Id estable de la mesa-QR de una habitación (el QR impreso apunta aquí). */
export function roomQrTableId(roomId: string): string {
  return `hab-${String(roomId || "").trim()}`
}

/**
 * Regenera las mesas-QR del área Habitaciones a partir de las habitaciones
 * reales. Idempotente: si no hay cambios, no escribe nada.
 */
export async function syncRoomQrTables(
  branchId?: string | null,
): Promise<{ total: number; changed: boolean }> {
  const [rooms, raw] = await Promise.all([getRooms(branchId), getRawBusinessConfig()])
  const current = normalizeLocalTablesConfig(
    (raw as Record<string, unknown>).localTables,
  )

  // Mesas del restaurante: todo lo que NO sea del área Habitaciones (y
  // también las "Habitación X" creadas a mano antes de la sincronización,
  // que quedan reemplazadas por las automáticas).
  const restaurantTables = current.filter(
    (table) =>
      String(table.area || "").trim().toLowerCase() !== ROOM_QR_AREA.toLowerCase() &&
      !/^hab-/.test(String(table.id || "")),
  )

  const maxSort = Math.max(0, ...restaurantTables.map((t) => Number(t.sortOrder) || 0))
  const roomTables = [...rooms]
    .sort((a, b) =>
      String(a.name).localeCompare(String(b.name), "es", { numeric: true }),
    )
    .map((room, index) => ({
      id: roomQrTableId(room.id),
      name: roomQrTableName(room.name),
      area: ROOM_QR_AREA,
      sortOrder: maxSort + index + 1,
      // Fuera de servicio o inactiva ⇒ su QR deja de aceptar pedidos.
      isActive: room.active !== false && !room.outOfService,
    }))
    .filter((table) => table.name)

  const next = [...restaurantTables, ...roomTables]

  // ¿Cambió algo? Comparación barata por firma.
  const signature = (tables: typeof next) =>
    tables
      .map((t) => `${t.id}|${t.name}|${t.area}|${t.sortOrder}|${t.isActive ? 1 : 0}`)
      .join("\n")
  const changed = signature(normalizeLocalTablesConfig(next)) !== signature(current)

  if (changed) {
    await saveBusinessConfig({ localTables: normalizeLocalTablesConfig(next) })
  }

  return { total: roomTables.length, changed }
}
