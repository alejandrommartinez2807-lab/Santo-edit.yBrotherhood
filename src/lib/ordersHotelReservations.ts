import * as store from "./ordersStoreHotelReservations"
import type {
  GetHotelReservationsFilters,
  HotelReservation,
  SaveHotelReservationInput,
} from "./ordersStoreHotelReservations"

export type { GetHotelReservationsFilters, HotelReservation, SaveHotelReservationInput }

export async function getHotelReservations(
  filters: GetHotelReservationsFilters = {},
  branchId?: string | null,
): Promise<HotelReservation[]> {
  return store.getHotelReservations(filters, branchId)
}

export async function saveHotelReservation(
  input: SaveHotelReservationInput,
  branchId?: string | null,
): Promise<HotelReservation> {
  return store.saveHotelReservation(input, branchId)
}

export async function updateHotelReservationStatus(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<HotelReservation> {
  return store.updateHotelReservationStatus(id, status, branchId)
}

export async function deleteHotelReservation(id: string, branchId?: string | null) {
  return store.deleteHotelReservation(id, branchId)
}

export async function getHotelReservationById(
  id: string,
  branchId?: string | null,
): Promise<HotelReservation | null> {
  return store.getHotelReservationById(id, branchId)
}

export async function updateHotelReservationGuest(
  id: string,
  guestId: string,
  branchId?: string | null,
): Promise<HotelReservation> {
  return store.updateHotelReservationGuest(id, guestId, branchId)
}
