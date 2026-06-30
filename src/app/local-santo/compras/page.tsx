"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  AlertTriangle,
  Check,
  Clock,
  CreditCard,
  DollarSign,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type PaymentStatus = "Pendiente" | "Parcial" | "Pagado"
type Supplier = { id: string; name: string; isActive: boolean }
type InventoryItem = { id: string; name: string; unit: string; isActive: boolean }
type Purchase = {
  id: string
  supplierId: string | null
  supplierName: string
  purchaseDate: string
  dueDate: string
  documentNumber: string
  totalUSD: number
  totalVES: number
  paidUSD: number
  paidVES: number
  pendingUSD: number
  pendingVES: number
  paymentStatus: PaymentStatus
  paymentMethod: string
  paymentReference: string
  paymentNote: string
  lastPaymentAt: string
  note: string
  createdAt: string
  inventoryItemId: string | null
  inventoryItemName: string
  inventoryQuantity: number
  inventoryUnit: string
  inventoryMovementId: string
}
type SupplierPayment = {
  id: string
  purchaseId: string
  paymentDate: string
  amountUSD: number
  amountVES: number
  method: string
  reference: string
  note: string
  createdAt: string
}
type PaymentDraft = {
  amountUSD: string
  amountVES: string
  method: string
  reference: string
  note: string
  paymentDate: string
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function usd(n: number) {
  return `$${(n || 0).toFixed(2)}`
}

function ves(n: number) {
  return `Bs ${(n || 0).toFixed(2)}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function paymentDraft(): PaymentDraft {
  return { amountUSD: "", amountVES: "", method: "", reference: "", note: "", paymentDate: todayISO() }
}

function isOverdue(p: Purchase) {
  return Boolean(p.dueDate && p.dueDate < todayISO() && p.paymentStatus !== "Pagado")
}

function isDueSoon(p: Purchase) {
  if (!p.dueDate || p.paymentStatus === "Pagado" || isOverdue(p)) return false
  const due = new Date(`${p.dueDate}T00:00:00`)
  const today = new Date(`${todayISO()}T00:00:00`)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
  return diffDays <= 7
}

function statusClass(status: PaymentStatus) {
  if (status === "Pagado") return "bg-green-50 text-green-700 border-green-200"
  if (status === "Parcial") return "bg-yellow-50 text-yellow-800 border-yellow-200"
  return "bg-red-50 text-red-700 border-red-200"
}

export default function ComprasPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [paymentHistory, setPaymentHistory] = useState<Record<string, SupplierPayment[]>>({})
  const [paymentForms, setPaymentForms] = useState<Record<string, PaymentDraft>>({})
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Filtros del listado.
  const [filterSupplier, setFilterSupplier] = useState("")
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("")
  const [onlyOverdue, setOnlyOverdue] = useState(false)

  // Formulario de nueva compra.
  const [supplierId, setSupplierId] = useState("")
  const [date, setDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState("")
  const [documentNumber, setDocumentNumber] = useState("")
  const [totalUSD, setTotalUSD] = useState("")
  const [totalVES, setTotalVES] = useState("")
  const [note, setNote] = useState("")
  const [initialPaidUSD, setInitialPaidUSD] = useState("")
  const [initialPaidVES, setInitialPaidVES] = useState("")
  const [initialPaymentMethod, setInitialPaymentMethod] = useState("")
  const [initialPaymentReference, setInitialPaymentReference] = useState("")
  const [initialPaymentNote, setInitialPaymentNote] = useState("")

  // Relación opcional con inventario (Fase 2b): sumar la compra al stock.
  const [linkInventory, setLinkInventory] = useState(false)
  const [invItemId, setInvItemId] = useState("")
  const [invQty, setInvQty] = useState("")

  // Edición inline de una compra ya registrada (no cambia el proveedor ni pagos).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState("")
  const [editDueDate, setEditDueDate] = useState("")
  const [editDocument, setEditDocument] = useState("")
  const [editUSD, setEditUSD] = useState("")
  const [editVES, setEditVES] = useState("")
  const [editNote, setEditNote] = useState("")

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetch("/api/suppliers", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (res.ok) setSuppliers(data.suppliers || [])
    } catch {
      /* el listado de compras reporta el error principal */
    }
  }, [])

  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory", { headers: authHeaders(), cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setInventoryItems((data.inventory || []).filter((i: InventoryItem) => i.isActive !== false))
    } catch {
      /* inventario es opcional para esta página */
    }
  }, [])

  const loadPurchases = useCallback(async (supplierFilter: string, paymentStatusFilter: string) => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (supplierFilter) params.set("supplierId", supplierFilter)
      if (paymentStatusFilter) params.set("paymentStatus", paymentStatusFilter)
      const qs = params.toString() ? `?${params.toString()}` : ""
      const res = await fetch(`/api/supplier-purchases${qs}`, { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setPurchases(data.purchases || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPayments = useCallback(async (purchaseId: string) => {
    try {
      const res = await fetch(`/api/supplier-purchases/${purchaseId}/payments`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar los pagos")
      setPaymentHistory((current) => ({ ...current, [purchaseId]: data.payments || [] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    }
  }, [])

  useEffect(() => {
    loadSuppliers()
    loadInventory()
  }, [loadSuppliers, loadInventory])

  useEffect(() => {
    loadPurchases(filterSupplier, filterPaymentStatus)
  }, [filterSupplier, filterPaymentStatus, loadPurchases])

  const visiblePurchases = useMemo(
    () => (onlyOverdue ? purchases.filter((p) => isOverdue(p)) : purchases),
    [onlyOverdue, purchases],
  )

  const summary = useMemo(() => {
    const base = visiblePurchases
    return {
      totalUSD: base.reduce((sum, p) => sum + (p.totalUSD || 0), 0),
      paidUSD: base.reduce((sum, p) => sum + (p.paidUSD || 0), 0),
      pendingUSD: base.reduce((sum, p) => sum + (p.pendingUSD || 0), 0),
      pendingCount: base.filter((p) => p.paymentStatus !== "Pagado").length,
      overdueCount: base.filter((p) => isOverdue(p)).length,
      dueSoonCount: base.filter((p) => isDueSoon(p)).length,
    }
  }, [visiblePurchases])

  async function create() {
    if (!supplierId) {
      setError("Selecciona el proveedor de la compra")
      return
    }
    const wantsInventory = linkInventory && inventoryItems.length > 0
    if (wantsInventory && (!invItemId || !(Number(invQty) > 0))) {
      setError("Para sumar al inventario, elige el insumo y una cantidad mayor a cero.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/supplier-purchases", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          supplierId,
          purchaseDate: date || todayISO(),
          dueDate,
          documentNumber: documentNumber.trim(),
          totalUSD: Number(totalUSD) || 0,
          totalVES: Number(totalVES) || 0,
          note: note.trim(),
          initialPaidUSD: Number(initialPaidUSD) || 0,
          initialPaidVES: Number(initialPaidVES) || 0,
          paymentMethod: initialPaymentMethod.trim(),
          paymentReference: initialPaymentReference.trim(),
          paymentNote: initialPaymentNote.trim(),
          ...(wantsInventory
            ? { inventoryItemId: invItemId, inventoryQuantity: Number(invQty) }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo registrar")
      setDocumentNumber("")
      setTotalUSD("")
      setTotalVES("")
      setNote("")
      setDate(todayISO())
      setDueDate("")
      setInitialPaidUSD("")
      setInitialPaidVES("")
      setInitialPaymentMethod("")
      setInitialPaymentReference("")
      setInitialPaymentNote("")
      setLinkInventory(false)
      setInvItemId("")
      setInvQty("")
      await Promise.all([loadPurchases(filterSupplier, filterPaymentStatus), loadInventory()])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function startEdit(p: Purchase) {
    setEditingId(p.id)
    setEditDate(p.purchaseDate || todayISO())
    setEditDueDate(p.dueDate || "")
    setEditDocument(p.documentNumber)
    setEditUSD(p.totalUSD ? String(p.totalUSD) : "")
    setEditVES(p.totalVES ? String(p.totalVES) : "")
    setEditNote(p.note)
    setError("")
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id: string) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/supplier-purchases/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          purchaseDate: editDate || todayISO(),
          dueDate: editDueDate,
          documentNumber: editDocument.trim(),
          totalUSD: Number(editUSD) || 0,
          totalVES: Number(editVES) || 0,
          note: editNote.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar")
      setEditingId(null)
      await loadPurchases(filterSupplier, filterPaymentStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function savePayment(p: Purchase) {
    const draft = paymentForms[p.id] || paymentDraft()
    if (!(Number(draft.amountUSD) > 0 || Number(draft.amountVES) > 0)) {
      setError("Indica un monto pagado mayor a cero")
      return
    }
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/supplier-purchases/${p.id}/payments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          paymentDate: draft.paymentDate || todayISO(),
          amountUSD: Number(draft.amountUSD) || 0,
          amountVES: Number(draft.amountVES) || 0,
          method: draft.method.trim(),
          reference: draft.reference.trim(),
          note: draft.note.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el pago")
      setPaymentForms((current) => ({ ...current, [p.id]: paymentDraft() }))
      setPurchases((current) => current.map((item) => (item.id === p.id ? data.purchase : item)))
      await Promise.all([loadPurchases(filterSupplier, filterPaymentStatus), loadPayments(p.id)])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function togglePayments(purchaseId: string) {
    const next = expandedPaymentId === purchaseId ? null : purchaseId
    setExpandedPaymentId(next)
    if (next && !paymentHistory[purchaseId]) await loadPayments(purchaseId)
  }

  function setPaymentField(id: string, key: keyof PaymentDraft, value: string) {
    setPaymentForms((current) => ({
      ...current,
      [id]: { ...(current[id] || paymentDraft()), [key]: value },
    }))
  }

  async function remove(p: Purchase) {
    const inventoryWarning =
      p.inventoryItemName && p.inventoryQuantity > 0
        ? `\n\nImportante: esta compra ya sumó ${p.inventoryQuantity} ${p.inventoryUnit} a ${p.inventoryItemName}. Eliminarla solo borra el historial de compra; NO descuenta inventario. Si necesitas corregir stock, registra un ajuste desde Inventario.`
        : ""
    const paymentWarning =
      p.paidUSD > 0 || p.paidVES > 0
        ? `\n\nTambién se eliminará el historial de pagos registrados para esta compra.`
        : ""

    if (
      !window.confirm(
        `¿Eliminar la compra de "${p.supplierName}" del ${p.purchaseDate} por ${usd(p.totalUSD)}? Esta acción no se puede deshacer.${inventoryWarning}${paymentWarning}`,
      )
    )
      return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/supplier-purchases/${p.id}`, { method: "DELETE", headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar")
      await loadPurchases(filterSupplier, filterPaymentStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/local-santo/proveedores"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
          >
            <ArrowLeft size={16} /> Proveedores
          </Link>
          <Link
            href="/local-santo"
            className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]/70"
          >
            Panel
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
              <ShoppingCart size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Compras a proveedores</h1>
              <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
                Registra compras, crédito, pagos parciales, vencimientos e inventario.
              </p>
            </div>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Solo el dueño puede registrar compras, y el módulo de proveedores debe estar activo desde
            la configuración del negocio. Inicia sesión como dueño.
          </p>
        ) : suppliers.length === 0 ? (
          <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/65">
            Primero agrega proveedores en{" "}
            <Link href="/local-santo/proveedores" className="text-[var(--brand-primary)] underline">
              Proveedores
            </Link>
            , luego podrás registrar compras, vencimientos y pagos.
          </p>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">Total filtrado</p>
                <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">{usd(summary.totalUSD)}</p>
              </div>
              <div className="rounded-2xl border-2 border-green-200 bg-white p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-green-700">Pagado</p>
                <p className="mt-1 text-2xl font-black text-green-700">{usd(summary.paidUSD)}</p>
              </div>
              <div className="rounded-2xl border-2 border-yellow-200 bg-white p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-yellow-800">Pendiente</p>
                <p className="mt-1 text-2xl font-black text-yellow-800">{usd(summary.pendingUSD)}</p>
              </div>
              <div className="rounded-2xl border-2 border-red-200 bg-white p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-red-700">Vencidas</p>
                <p className="mt-1 text-2xl font-black text-red-700">{summary.overdueCount}</p>
              </div>
            </div>

            {/* Formulario de nueva compra */}
            <div className="mt-6 grid gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] lg:col-span-2">
                Proveedor
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                >
                  <option value="">Selecciona un proveedor…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.isActive ? "" : " (inactivo)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                Fecha
                <input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                Vence
                <input
                  type="date"
                  value={dueDate}
                  min={date || undefined}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] lg:col-span-2">
                N° documento / factura
                <input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Opcional"
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                Total USD
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalUSD}
                  onChange={(e) => setTotalUSD(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                Total Bs
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalVES}
                  onChange={(e) => setTotalVES(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>

              <div className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3 lg:col-span-4">
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  <CreditCard size={14} /> Pago inicial / crédito
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialPaidUSD}
                    onChange={(e) => setInitialPaidUSD(e.target.value)}
                    placeholder="Pagado USD"
                    className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialPaidVES}
                    onChange={(e) => setInitialPaidVES(e.target.value)}
                    placeholder="Pagado Bs"
                    className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  />
                  <input
                    value={initialPaymentMethod}
                    onChange={(e) => setInitialPaymentMethod(e.target.value)}
                    placeholder="Método"
                    className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  />
                  <input
                    value={initialPaymentReference}
                    onChange={(e) => setInitialPaymentReference(e.target.value)}
                    placeholder="Referencia"
                    className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  />
                  <input
                    value={initialPaymentNote}
                    onChange={(e) => setInitialPaymentNote(e.target.value)}
                    placeholder="Nota del pago"
                    className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
                <p className="mt-2 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                  Si dejas pagado en cero, la compra queda como cuenta por pagar. Luego puedes registrar abonos parciales.
                </p>
              </div>

              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] lg:col-span-4">
                Nota
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opcional (qué se compró, condiciones…)"
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>

              {inventoryItems.length > 0 && (
                <div className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3 lg:col-span-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                    <input
                      type="checkbox"
                      checked={linkInventory}
                      onChange={(e) => setLinkInventory(e.target.checked)}
                      className="h-4 w-4 accent-[var(--brand-primary)]"
                    />
                    Sumar esta compra al inventario
                  </label>
                  {linkInventory && (
                    <>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr]">
                        <select
                          value={invItemId}
                          onChange={(e) => setInvItemId(e.target.value)}
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                        >
                          <option value="">Selecciona un insumo…</option>
                          {inventoryItems.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={invQty}
                          onChange={(e) => setInvQty(e.target.value)}
                          placeholder={`Cantidad${invItemId ? ` (${inventoryItems.find((i) => i.id === invItemId)?.unit || ""})` : ""}`}
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                        />
                      </div>
                      <p className="mt-2 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                        Se sumará al stock y quedará registrado como movimiento de inventario. La
                        entrada no se revierte si luego editas o borras la compra.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="lg:col-span-4">
                <button
                  onClick={create}
                  disabled={busy || !supplierId}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
                >
                  <Plus size={16} /> Registrar compra
                </button>
              </div>
            </div>

            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 font-bold text-red-600">{error}</p>}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  <Truck size={14} /> Proveedor
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilterSupplier(e.target.value)}
                    className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  >
                    <option value="">Todos</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  <ReceiptText size={14} /> Estado
                  <select
                    value={filterPaymentStatus}
                    onChange={(e) => setFilterPaymentStatus(e.target.value)}
                    className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  >
                    <option value="">Todos</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Parcial">Parcial</option>
                    <option value="Pagado">Pagado</option>
                  </select>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-red-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-red-700">
                  <input
                    type="checkbox"
                    checked={onlyOverdue}
                    onChange={(e) => setOnlyOverdue(e.target.checked)}
                    className="h-4 w-4 accent-red-600"
                  />
                  Solo vencidas
                </label>
              </div>
              {!loading && visiblePurchases.length > 0 && (
                <span className="text-sm font-bold text-[var(--brand-ink-2)]/70">
                  {visiblePurchases.length} compra{visiblePurchases.length === 1 ? "" : "s"} · pendiente {usd(summary.pendingUSD)}
                </span>
              )}
            </div>

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : visiblePurchases.length === 0 ? (
              <p className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay compras registradas con estos filtros.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {visiblePurchases.map((p) => {
                  const draft = paymentForms[p.id] || paymentDraft()
                  const payments = paymentHistory[p.id] || []
                  const openPayments = expandedPaymentId === p.id
                  return editingId === p.id ? (
                    <li key={p.id} className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white p-4">
                      <p className="text-sm font-black text-[var(--brand-ink-3)]">{p.supplierName || "—"}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <input
                          type="date"
                          value={editDate}
                          max={todayISO()}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                        />
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                        />
                        <input
                          value={editDocument}
                          onChange={(e) => setEditDocument(e.target.value)}
                          placeholder="N° documento"
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editUSD}
                          onChange={(e) => setEditUSD(e.target.value)}
                          placeholder="Total USD"
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editVES}
                          onChange={(e) => setEditVES(e.target.value)}
                          placeholder="Total Bs"
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                        />
                        <input
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Nota"
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                        />
                      </div>
                      <p className="mt-3 rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3 text-[0.72rem] font-bold text-[var(--brand-ink-2)]/65">
                        Editar el total recalcula el pendiente con los pagos ya registrados. Los pagos se agregan abajo; no se editan desde este formulario.
                      </p>
                      {p.inventoryItemName && p.inventoryQuantity > 0 && (
                        <p className="mt-2 rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3 text-[0.72rem] font-bold text-[var(--brand-ink-2)]/65">
                          Esta compra ya generó una entrada de inventario. Desde aquí solo editas
                          fecha, vencimiento, documento, montos y nota; el stock se corrige con un ajuste en Inventario.
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => saveEdit(p.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
                        >
                          <Check size={14} /> Guardar
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-2 text-xs font-black uppercase text-[var(--brand-primary)] disabled:opacity-50"
                        >
                          <X size={14} /> Cancelar
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li key={p.id} className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-black text-[var(--brand-ink-3)]">{p.supplierName || "—"}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] ${statusClass(p.paymentStatus)}`}>
                              {p.paymentStatus}
                            </span>
                            {isOverdue(p) && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] text-red-700">
                                <AlertTriangle size={11} /> Vencida
                              </span>
                            )}
                            {isDueSoon(p) && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] text-yellow-800">
                                <Clock size={11} /> Por vencer
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-[var(--brand-ink-2)]/60">
                            Compra {p.purchaseDate}
                            {p.dueDate ? ` · Vence ${p.dueDate}` : ""}
                            {p.documentNumber ? ` · Doc. ${p.documentNumber}` : ""}
                          </p>
                          {p.note && <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/80">{p.note}</p>}
                          {p.inventoryItemName && p.inventoryQuantity > 0 && (
                            <p
                              title={p.inventoryMovementId ? `Movimiento: ${p.inventoryMovementId}` : undefined}
                              className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--brand-accent)] px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]"
                            >
                              <Plus size={11} /> {p.inventoryQuantity} {p.inventoryUnit} a {p.inventoryItemName}
                            </p>
                          )}
                          {p.inventoryItemName && p.inventoryQuantity > 0 && (
                            <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/50">
                              Entrada aditiva: editar o borrar esta compra no descuenta inventario.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <div className="text-right">
                            <p className="text-lg font-black text-[var(--brand-ink-3)]">{usd(p.totalUSD)}</p>
                            <p className="text-xs font-bold text-green-700">Pagado {usd(p.paidUSD)}</p>
                            <p className="text-xs font-bold text-red-700">Pendiente {usd(p.pendingUSD)}</p>
                            {p.totalVES > 0 && <p className="text-xs font-bold text-[var(--brand-ink-2)]/55">{ves(p.totalVES)}</p>}
                          </div>
                          <button
                            onClick={() => startEdit(p)}
                            disabled={busy}
                            title="Editar compra"
                            className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)]/25 bg-white p-2 text-[var(--brand-primary)] disabled:opacity-50"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => remove(p)}
                            disabled={busy}
                            title="Eliminar compra"
                            className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {p.paymentStatus !== "Pagado" && (
                        <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
                          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                            <DollarSign size={14} /> Registrar abono
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                            <input
                              type="date"
                              value={draft.paymentDate}
                              max={todayISO()}
                              onChange={(e) => setPaymentField(p.id, "paymentDate", e.target.value)}
                              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                            />
                            <input
                              type="number"
                              min="0"
                              max={p.pendingUSD || undefined}
                              step="0.01"
                              value={draft.amountUSD}
                              onChange={(e) => setPaymentField(p.id, "amountUSD", e.target.value)}
                              placeholder={`USD máx. ${p.pendingUSD.toFixed(2)}`}
                              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                            />
                            <input
                              type="number"
                              min="0"
                              max={p.pendingVES || undefined}
                              step="0.01"
                              value={draft.amountVES}
                              onChange={(e) => setPaymentField(p.id, "amountVES", e.target.value)}
                              placeholder="Bs"
                              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                            />
                            <input
                              value={draft.method}
                              onChange={(e) => setPaymentField(p.id, "method", e.target.value)}
                              placeholder="Método"
                              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                            />
                            <input
                              value={draft.reference}
                              onChange={(e) => setPaymentField(p.id, "reference", e.target.value)}
                              placeholder="Referencia"
                              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                            />
                            <button
                              onClick={() => savePayment(p)}
                              disabled={busy}
                              className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
                            >
                              <Check size={14} /> Abonar
                            </button>
                            <input
                              value={draft.note}
                              onChange={(e) => setPaymentField(p.id, "note", e.target.value)}
                              placeholder="Nota del abono"
                              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)] sm:col-span-2 lg:col-span-6"
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-3">
                        <button
                          onClick={() => togglePayments(p.id)}
                          className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] underline"
                        >
                          {openPayments ? "Ocultar pagos" : "Ver pagos"}
                        </button>
                        {openPayments && (
                          <div className="mt-2 rounded-xl border-2 border-[var(--brand-primary)]/10 bg-white p-3">
                            {payments.length === 0 ? (
                              <p className="text-xs font-bold text-[var(--brand-ink-2)]/55">Aún no hay pagos registrados.</p>
                            ) : (
                              <ul className="space-y-2">
                                {payments.map((payment) => (
                                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--brand-cream)] px-3 py-2 text-xs font-bold">
                                    <span>
                                      {payment.paymentDate} · {usd(payment.amountUSD)}
                                      {payment.amountVES > 0 ? ` · ${ves(payment.amountVES)}` : ""}
                                      {payment.method ? ` · ${payment.method}` : ""}
                                      {payment.reference ? ` · Ref. ${payment.reference}` : ""}
                                    </span>
                                    {payment.note && <span className="text-[var(--brand-ink-2)]/55">{payment.note}</span>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  )
}
