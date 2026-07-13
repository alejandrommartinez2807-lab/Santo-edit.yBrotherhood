import * as store from "./ordersStoreHousekeeping"
import type {
  CreateHousekeepingTaskInput,
  HousekeepingTask,
  UpdateHousekeepingTaskInput,
} from "./ordersStoreHousekeeping"

export type { CreateHousekeepingTaskInput, HousekeepingTask, UpdateHousekeepingTaskInput }
export {
  HOUSEKEEPING_TASK_STATUSES,
  HOUSEKEEPING_TASK_TYPES,
  normalizeTaskStatus,
  normalizeTaskType,
  type HousekeepingTaskStatus,
  type HousekeepingTaskType,
} from "./ordersStoreHousekeeping"

export async function getHousekeepingTasks(branchId?: string | null): Promise<HousekeepingTask[]> {
  return store.getHousekeepingTasks(branchId)
}

export async function createHousekeepingTask(
  input: CreateHousekeepingTaskInput,
  branchId?: string | null,
): Promise<HousekeepingTask> {
  return store.createHousekeepingTask(input, branchId)
}

export async function updateHousekeepingTask(
  id: string,
  input: UpdateHousekeepingTaskInput,
  branchId?: string | null,
): Promise<HousekeepingTask> {
  return store.updateHousekeepingTask(id, input, branchId)
}

export async function deleteHousekeepingTask(id: string, branchId?: string | null) {
  return store.deleteHousekeepingTask(id, branchId)
}

export async function queueCheckoutCleaning(
  roomId: string,
  branchId?: string | null,
  note = "",
): Promise<HousekeepingTask | null> {
  return store.queueCheckoutCleaning(roomId, branchId, note)
}
