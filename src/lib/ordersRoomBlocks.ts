import * as store from "./ordersStoreRoomBlocks"
import type {
  GetRoomBlocksFilters,
  RoomBlock,
  SaveRoomBlockInput,
} from "./ordersStoreRoomBlocks"

export type { GetRoomBlocksFilters, RoomBlock, SaveRoomBlockInput }

export async function getRoomBlocks(
  filters: GetRoomBlocksFilters = {},
  branchId?: string | null,
): Promise<RoomBlock[]> {
  return store.getRoomBlocks(filters, branchId)
}

export async function saveRoomBlock(
  input: SaveRoomBlockInput,
  branchId?: string | null,
): Promise<RoomBlock> {
  return store.saveRoomBlock(input, branchId)
}

export async function deleteRoomBlock(id: string, branchId?: string | null) {
  return store.deleteRoomBlock(id, branchId)
}
