import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"

// Facturas sobre Supabase (Hotel · Fase 16). Todo por branch_id.

export type Invoice = {
  id: string
  reservationId: string
  folioId: string
  number: number
  serie: string
  customerName: string
  customerRif: string
  subtotal: number
  taxRate: number
  tax: number
  total: number
  createdAt: string
}

export type CreateInvoiceInput = {
  reservationId?: string
  folioId?: string
  customerName?: string
  customerRif?: string
  subtotal: number
  taxRate: number
  tax: number
  total: number
  serie?: string
}

function num(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapInvoice(raw: Row): Invoice {
  return {
    id: String(raw.id || ""),
    reservationId: cleanText(raw.reservation_id),
    folioId: cleanText(raw.folio_id),
    number: num(raw.number, 0),
    serie: cleanText(raw.serie) || "A",
    customerName: cleanText(raw.customer_name),
    customerRif: cleanText(raw.customer_rif),
    subtotal: num(raw.subtotal, 0),
    taxRate: num(raw.tax_rate, 0),
    tax: num(raw.tax, 0),
    total: num(raw.total, 0),
    createdAt: String(raw.created_at || ""),
  }
}

export async function getInvoices(branchId?: string | null): Promise<Invoice[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("invoices").select("*").order("number", { ascending: false }).limit(200)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapInvoice(raw as Row))
}

async function nextInvoiceNumber(branchId?: string | null): Promise<number> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("invoices").select("number").order("number", { ascending: false }).limit(1)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const last = data && data.length > 0 ? num((data[0] as Row).number, 0) : 0
  return last + 1
}

export async function createInvoice(input: CreateInvoiceInput, branchId?: string | null): Promise<Invoice> {
  const supabase = getSupabaseAdmin()
  const number = await nextInvoiceNumber(branchId)
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      branch_id: branchId ?? null,
      reservation_id: cleanText(input.reservationId) || null,
      folio_id: cleanText(input.folioId) || null,
      number,
      serie: cleanText(input.serie) || "A",
      customer_name: cleanText(input.customerName),
      customer_rif: cleanText(input.customerRif),
      subtotal: num(input.subtotal, 0),
      tax_rate: num(input.taxRate, 0),
      tax: num(input.tax, 0),
      total: num(input.total, 0),
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapInvoice(data as Row)
}
