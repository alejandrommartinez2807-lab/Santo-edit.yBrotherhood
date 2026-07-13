import * as store from "./ordersStoreResortServices"
import type {
  CreateServiceBookingInput,
  ResortService,
  SaveResortServiceInput,
  ServiceBooking,
} from "./ordersStoreResortServices"

export type { CreateServiceBookingInput, ResortService, SaveResortServiceInput, ServiceBooking }

export async function getResortServices(branchId?: string | null): Promise<ResortService[]> {
  return store.getResortServices(branchId)
}

export async function saveResortService(
  input: SaveResortServiceInput,
  branchId?: string | null,
): Promise<ResortService> {
  return store.saveResortService(input, branchId)
}

export async function deleteResortService(id: string, branchId?: string | null) {
  return store.deleteResortService(id, branchId)
}

export async function getServiceBookings(
  filters: { from?: string; to?: string; serviceId?: string } = {},
  branchId?: string | null,
): Promise<ServiceBooking[]> {
  return store.getServiceBookings(filters, branchId)
}

export async function createServiceBooking(
  input: CreateServiceBookingInput,
  branchId?: string | null,
): Promise<ServiceBooking> {
  return store.createServiceBooking(input, branchId)
}

export async function updateServiceBookingStatus(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<ServiceBooking> {
  return store.updateServiceBookingStatus(id, status, branchId)
}

export async function deleteServiceBooking(id: string, branchId?: string | null) {
  return store.deleteServiceBooking(id, branchId)
}
