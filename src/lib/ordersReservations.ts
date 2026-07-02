import type { Reservation } from "@/types/localOrders"

import * as reservationStore from "./ordersStoreReservations"
import type { GetReservationsFilters, SaveReservationInput } from "./ordersStoreReservations"

export type { GetReservationsFilters, SaveReservationInput }

export async function getReservations(
  filters: GetReservationsFilters = {},
  branchId?: string | null,
): Promise<Reservation[]> {
  return reservationStore.getReservations(filters, branchId)
}

export async function saveReservation(
  input: SaveReservationInput,
  branchId?: string | null,
): Promise<Reservation> {
  return reservationStore.saveReservation(input, branchId)
}

export async function updateReservationStatus(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<Reservation> {
  return reservationStore.updateReservationStatus(id, status, branchId)
}

export async function deleteReservation(id: string, branchId?: string | null) {
  return reservationStore.deleteReservation(id, branchId)
}
