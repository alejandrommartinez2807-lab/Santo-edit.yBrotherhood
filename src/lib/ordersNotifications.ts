import * as store from "./ordersStoreNotifications"
import type { NotificationEntry } from "./ordersStoreNotifications"

export type { NotificationEntry }

export async function getNotificationLog(branchId?: string | null): Promise<NotificationEntry[]> {
  return store.getNotificationLog(branchId)
}

export async function logNotification(
  input: { reservationId: string; kind?: string; channel?: string },
  branchId?: string | null,
): Promise<NotificationEntry> {
  return store.logNotification(input, branchId)
}
