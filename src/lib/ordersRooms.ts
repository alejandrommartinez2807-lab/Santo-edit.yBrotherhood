import * as roomsStore from "./ordersStoreRooms"
import type {
  Room,
  RoomType,
  SaveRoomInput,
  SaveRoomTypeInput,
} from "./ordersStoreRooms"

export type { Room, RoomType, SaveRoomInput, SaveRoomTypeInput }
export {
  ROOM_HOUSEKEEPING_STATUSES,
  normalizeHousekeepingStatus,
  type RoomHousekeepingStatus,
} from "./ordersStoreRooms"

export async function getRoomTypes(branchId?: string | null): Promise<RoomType[]> {
  return roomsStore.getRoomTypes(branchId)
}

export async function saveRoomType(
  input: SaveRoomTypeInput,
  branchId?: string | null,
): Promise<RoomType> {
  return roomsStore.saveRoomType(input, branchId)
}

export async function deleteRoomType(id: string, branchId?: string | null) {
  return roomsStore.deleteRoomType(id, branchId)
}

export async function getRooms(branchId?: string | null): Promise<Room[]> {
  return roomsStore.getRooms(branchId)
}

export async function saveRoom(
  input: SaveRoomInput,
  branchId?: string | null,
): Promise<Room> {
  return roomsStore.saveRoom(input, branchId)
}

export async function updateRoomHousekeeping(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<Room> {
  return roomsStore.updateRoomHousekeeping(id, status, branchId)
}

export async function deleteRoom(id: string, branchId?: string | null) {
  return roomsStore.deleteRoom(id, branchId)
}

export async function uploadRoomTypePhoto(input: roomsStore.UploadRoomTypePhotoInput) {
  return roomsStore.uploadRoomTypePhoto(input)
}
