import * as store from "./ordersStoreReservationPayments"
import type { CreateReservationPaymentInput, ReservationPayment } from "./ordersStoreReservationPayments"

export type { CreateReservationPaymentInput, ReservationPayment }

export async function getReservationPayments(
  filters: { reservationId?: string } = {},
  branchId?: string | null,
): Promise<ReservationPayment[]> {
  return store.getReservationPayments(filters, branchId)
}

export async function createReservationPayment(
  input: CreateReservationPaymentInput,
  branchId?: string | null,
): Promise<ReservationPayment> {
  return store.createReservationPayment(input, branchId)
}

export async function updateReservationPaymentStatus(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<ReservationPayment> {
  return store.updateReservationPaymentStatus(id, status, branchId)
}
