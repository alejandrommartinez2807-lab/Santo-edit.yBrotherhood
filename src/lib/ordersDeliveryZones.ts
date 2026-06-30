import type { DeliveryZone } from "@/types/localOrders"

import * as deliveryZoneStore from "./ordersStoreDeliveryZones"

export async function getDeliveryZones(branchId?: string | null) {
  return deliveryZoneStore.getDeliveryZones(branchId)
}

export async function saveDeliveryZones(
  deliveryZones: DeliveryZone[],
  branchId?: string | null,
) {
  return deliveryZoneStore.saveDeliveryZones(deliveryZones, branchId)
}
