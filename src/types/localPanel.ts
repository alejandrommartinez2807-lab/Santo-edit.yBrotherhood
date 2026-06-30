import type { OrderType } from "@/types/localOrders"

export type ProductSold = {
  name: string
  quantity: number
  totalUSD: number
  totalVES: number
  onlyCurrency: boolean
}

export type NewOrderToast = {
  id: string
  number: string
  customerName: string
  tableNumber: string
  totalUSD: number
  orderType: OrderType
}

export type DaySummaryTotals = {
  count: number
  totalUSD: number
  totalCombosUSD: number
  totalRegularUSD: number
  totalRegularVES: number
  deliveryCostUSD: number
}

export type DaySummaryItem = DaySummaryTotals & {
  label: string
}

export type PaymentSummaryItem = {
  label: string
  count: number
  totalUSD: number
  totalVES?: number
  deliveryCostUSD?: number
}

export type PaymentSummaryTotals = {
  count: number
  totalUSD: number
  totalVES: number
  deliveryCostUSD: number
}

export type ExpenseSummaryItem = {
  label: string
  count: number
  totalUSD: number
  amountUSD: number
  amountVES: number
}

export type CloseReviewTone = "danger" | "warning" | "success" | "info"

export type CloseReviewItem = {
  title: string
  description: string
  value: string
  tone: CloseReviewTone
}
