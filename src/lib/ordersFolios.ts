import * as store from "./ordersStoreFolios"
import type {
  AddFolioItemInput,
  Folio,
  FolioItem,
  Guest,
  SaveGuestInput,
} from "./ordersStoreFolios"

export type { AddFolioItemInput, Folio, FolioItem, Guest, SaveGuestInput }
export { folioBalance } from "./ordersStoreFolios"

export async function saveGuest(input: SaveGuestInput, branchId?: string | null): Promise<Guest> {
  return store.saveGuest(input, branchId)
}

export async function getGuest(id: string, branchId?: string | null): Promise<Guest | null> {
  return store.getGuest(id, branchId)
}

export async function getGuests(branchId?: string | null): Promise<Guest[]> {
  return store.getGuests(branchId)
}

export async function getFolioByReservation(reservationId: string, branchId?: string | null): Promise<Folio | null> {
  return store.getFolioByReservation(reservationId, branchId)
}

export async function openFolio(
  input: { reservationId: string; guestId?: string },
  branchId?: string | null,
): Promise<Folio> {
  return store.openFolio(input, branchId)
}

export async function closeFolio(folioId: string, branchId?: string | null): Promise<Folio> {
  return store.closeFolio(folioId, branchId)
}

export async function getFolioItems(folioId: string, branchId?: string | null): Promise<FolioItem[]> {
  return store.getFolioItems(folioId, branchId)
}

export async function getFolioItemsInRange(
  filters: { from: string; to: string },
  branchId?: string | null,
): Promise<FolioItem[]> {
  return store.getFolioItemsInRange(filters, branchId)
}

export async function getFoliosByIds(
  folioIds: string[],
  branchId?: string | null,
): Promise<Folio[]> {
  return store.getFoliosByIds(folioIds, branchId)
}

export async function addFolioItem(input: AddFolioItemInput, branchId?: string | null): Promise<FolioItem> {
  return store.addFolioItem(input, branchId)
}

export async function deleteFolioItem(id: string, branchId?: string | null) {
  return store.deleteFolioItem(id, branchId)
}

export async function hasRoomCharge(folioId: string, branchId?: string | null): Promise<boolean> {
  return store.hasRoomCharge(folioId, branchId)
}

export async function getChargedOrderIds(branchId?: string | null): Promise<string[]> {
  return store.getChargedOrderIds(branchId)
}
