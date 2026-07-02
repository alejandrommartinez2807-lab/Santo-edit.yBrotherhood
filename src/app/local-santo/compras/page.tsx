"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Trash2, ShoppingCart, Truck, Pencil, Check, X, Wallet } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Supplier = { id: string; name: string; isActive: boolean }
type InventoryItem = { id: string; name: string; unit: string; isActive: boolean }
type SupplierPaymentStatus = "Pendiente" | "Parcial" | "Pagado"
type Purchase = {
  id: string
  supplierId: string | null
  supplierName: string
  purchaseDate: string
  dueDate: string
  documentNumber: string
  totalUSD: number
  totalVES: number
  note: string
  createdAt: string
  inventoryItemId: string | null
  inventoryItemName: string
  inventoryQuantity: number
  inventoryUnit: string
  paidUSD: number
  paidVES: number
  pendingUSD: number
  pendingVES: number
  paymentStatus: SupplierPaymentStatus
  isOverdue: boolean
}
type SupplierPayment = {
  id: string
  paymentDate: string
  amountUSD: number
  amountVES: number
  paymentMethod: string
  reference: string
  note: string
}

const STATUS_STYLES: Record<SupplierPaymentStatus, string> = {
  Pendiente: "bg-red-100 text-red-700",
  Parcial: "bg-amber-100 text-amber-700",
  Pagado: "bg-emerald-100 text-emerald-700",
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function usd(n: number) {
  return `$${(n || 0).toFixed(2)}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function ComprasPage() {
  return (
    <ModuleAccessGuard moduleKey="supplierPurchases" moduleName="Compras">
      <ComprasPageContent />
    </ModuleAccessGuard>
  )
}

function ComprasPageContent() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Filtro del listado por proveedor ("" = todos).
  const [filterSupplier, setFilterSupplier] = useState("")

  // Formulario de nueva compra.
  const [supplierId, setSupplierId] = useState("")
  const [date, setDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState("")
  const [documentNumber, setDocumentNumber] = useState("")
  const [totalUSD, setTotalUSD] = useState("")
  const [totalVES, setTotalVES] = useState("")
  const [note, setNote] = useState("")

  // Relación opcional con inventario (Fase 2b): sumar la compra al stock.
  const [linkInventory, setLinkInventory] = useState(false)
  const [invItemId, setInvItemId] = useState("")
  const [invQty, setInvQty] = useState("")

  // Panel de abonos (cuentas por pagar) de una compra.
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [payUSD, setPayUSD] = useState("")
  const [payVES, setPayVES] = useState("")
  const [payMethod, setPayMethod] = useState("")
  const [payReference, setPayReference] = useState("")
  const [payDate, setPayDate] = useState(todayISO())

  // Edición inline de una compra ya registrada (no cambia el proveedor).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState("")
  const [editDue, setEditDue] = useState("")
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

  // Inventario opcional: si el módulo está activo, ofrecemos vincular la compra
  // a un insumo. Si está apagado (403), simplemente no mostramos la opción.
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

  const loadPurchases = useCallback(async (supplierFilter: string) => {
    setLoading(true)
    setError("")
    try {
      const qs = supplierFilter ? `?supplierId=${encodeURIComponent(supplierFilter)}` : ""
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

  useEffect(() => {
    // Difiere la carga un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(() => {
      loadSuppliers()
      loadInventory()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadSuppliers, loadInventory])

  useEffect(() => {
    const timer = setTimeout(() => loadPurchases(filterSupplier), 0)
    return () => clearTimeout(timer)
  }, [filterSupplier, loadPurchases])

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
          ...(wantsInventory
            ? { inventoryItemId: invItemId, inventoryQuantity: Number(invQty) }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo registrar")
      // Limpia el formulario (deja el proveedor seleccionado para cargas seguidas).
      setDocumentNumber("")
      setTotalUSD("")
      setTotalVES("")
      setNote("")
      setDate(todayISO())
      setDueDate("")
      setLinkInventory(false)
      setInvItemId("")
      setInvQty("")
      await Promise.all([loadPurchases(filterSupplier), loadInventory()])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function startEdit(p: Purchase) {
    setEditingId(p.id)
    setEditDate(p.purchaseDate || todayISO())
    setEditDue(p.dueDate || "")
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
          dueDate: editDue,
          documentNumber: editDocument.trim(),
          totalUSD: Number(editUSD) || 0,
          totalVES: Number(editVES) || 0,
          note: editNote.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar")
      setEditingId(null)
      await loadPurchases(filterSupplier)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const loadPayments = useCallback(async (purchaseId: string) => {
    setPaymentsLoading(true)
    try {
      const res = await fetch(`/api/supplier-purchases/${purchaseId}/payments`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      const data = await res.json()
      setPayments(res.ok ? data.payments || [] : [])
    } catch {
      setPayments([])
    } finally {
      setPaymentsLoading(false)
    }
  }, [])

  function openPayments(p: Purchase) {
    setPayingId(p.id)
    setPayUSD("")
    setPayVES("")
    setPayMethod("")
    setPayReference("")
    setPayDate(todayISO())
    setError("")
    loadPayments(p.id)
  }

  function closePayments() {
    setPayingId(null)
    setPayments([])
  }

  async function registerPayment(id: string) {
    if (!(Number(payUSD) > 0) && !(Number(payVES) > 0)) {
      setError("Indica un monto pagado mayor a cero (USD o Bs).")
      return
    }
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/supplier-purchases/${id}/payments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          paymentDate: payDate || todayISO(),
          amountUSD: Number(payUSD) || 0,
          amountVES: Number(payVES) || 0,
          method: payMethod.trim(),
          reference: payReference.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el pago")
      setPayUSD("")
      setPayVES("")
      setPayMethod("")
      setPayReference("")
      await Promise.all([loadPayments(id), loadPurchases(filterSupplier)])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function remove(p: Purchase) {
    if (
      !window.confirm(
        `¿Eliminar la compra de "${p.supplierName}" del ${p.purchaseDate} por ${usd(p.totalUSD)}? Esta acción no se puede deshacer.`,
      )
    )
      return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/supplier-purchases/${p.id}`, { method: "DELETE", headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar")
      await loadPurchases(filterSupplier)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const totalShown = useMemo(
    () => purchases.reduce((sum, p) => sum + (p.totalUSD || 0), 0),
    [purchases],
  )

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
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

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <ShoppingCart size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Compras a proveedores</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Registra e historiza las compras de cada proveedor.
            </p>
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
            , luego podrás registrar sus compras.
          </p>
        ) : (
          <>
            {/* Formulario de nueva compra */}
            <div className="mt-6 grid gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] sm:col-span-2">
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
                N° documento / factura
                <input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Opcional"
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] sm:col-span-2">
                Vencimiento (opcional)
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
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
                Total Bs (opcional)
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

              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] sm:col-span-2">
                Nota
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opcional (qué se compró, condiciones…)"
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>

              {/* Relación opcional con inventario (solo si el módulo está activo) */}
              {inventoryItems.length > 0 && (
                <div className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3 sm:col-span-2">
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

              <div className="sm:col-span-2">
                <button
                  onClick={create}
                  disabled={busy || !supplierId}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
                >
                  <Plus size={16} /> Registrar compra
                </button>
              </div>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Filtro + total */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                <Truck size={14} /> Filtrar
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                >
                  <option value="">Todos los proveedores</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {!loading && purchases.length > 0 && (
                <span className="text-sm font-bold text-[var(--brand-ink-2)]/70">
                  {purchases.length} compra{purchases.length === 1 ? "" : "s"} · {usd(totalShown)}
                </span>
              )}
            </div>

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : purchases.length === 0 ? (
              <p className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay compras registradas{filterSupplier ? " para este proveedor" : ""}.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {purchases.map((p) =>
                  editingId === p.id ? (
                    <li
                      key={p.id}
                      className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white p-4"
                    >
                      <p className="text-sm font-black text-[var(--brand-ink-3)]">{p.supplierName || "—"}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <input
                          type="date"
                          value={editDate}
                          max={todayISO()}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                        />
                        <input
                          value={editDocument}
                          onChange={(e) => setEditDocument(e.target.value)}
                          placeholder="N° documento"
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                        />
                        <input
                          type="date"
                          value={editDue}
                          onChange={(e) => setEditDue(e.target.value)}
                          title="Vencimiento"
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)] sm:col-span-2"
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
                          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)] sm:col-span-2"
                        />
                      </div>
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
                    <li
                      key={p.id}
                      className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                    >
                     <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black text-[var(--brand-ink-3)]">{p.supplierName || "—"}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] ${STATUS_STYLES[p.paymentStatus]}`}>
                            {p.paymentStatus}
                          </span>
                          {p.isOverdue && (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] text-white">
                              Vencida
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-[var(--brand-ink-2)]/60">
                          {p.purchaseDate}
                          {p.documentNumber ? ` · Doc. ${p.documentNumber}` : ""}
                          {p.dueDate ? ` · Vence ${p.dueDate}` : ""}
                        </p>
                        {p.note && <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/80">{p.note}</p>}
                        {p.inventoryItemName && p.inventoryQuantity > 0 && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--brand-accent)] px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                            <Plus size={11} /> {p.inventoryQuantity} {p.inventoryUnit} a {p.inventoryItemName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-black text-[var(--brand-ink-3)]">{usd(p.totalUSD)}</p>
                          {p.totalVES > 0 && (
                            <p className="text-xs font-bold text-[var(--brand-ink-2)]/55">Bs {p.totalVES.toFixed(2)}</p>
                          )}
                          {p.paymentStatus !== "Pagado" && (p.pendingUSD > 0 || p.pendingVES > 0) && (
                            <p className="text-[0.68rem] font-black uppercase tracking-[0.06em] text-red-600">
                              Pendiente {usd(p.pendingUSD)}
                              {p.pendingVES > 0 ? ` · Bs ${p.pendingVES.toFixed(2)}` : ""}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => (payingId === p.id ? closePayments() : openPayments(p))}
                          disabled={busy}
                          title="Abonos / cuentas por pagar"
                          className="inline-flex items-center justify-center rounded-full border-2 border-emerald-300 bg-white p-2 text-emerald-700 disabled:opacity-50"
                        >
                          <Wallet size={16} />
                        </button>
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

                      {payingId === p.id && (
                        <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-3">
                          <p className="text-xs font-black uppercase tracking-[0.1em] text-emerald-800">
                            Abonos · pagado {usd(p.paidUSD)}
                            {p.paidVES > 0 ? ` · Bs ${p.paidVES.toFixed(2)}` : ""}
                          </p>

                          {p.paymentStatus !== "Pagado" && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <input
                                type="date"
                                value={payDate}
                                max={todayISO()}
                                onChange={(e) => setPayDate(e.target.value)}
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                value={payMethod}
                                onChange={(e) => setPayMethod(e.target.value)}
                                placeholder="Método (transferencia, efectivo…)"
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={payUSD}
                                onChange={(e) => setPayUSD(e.target.value)}
                                placeholder="Abono USD"
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={payVES}
                                onChange={(e) => setPayVES(e.target.value)}
                                placeholder="Abono Bs"
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                value={payReference}
                                onChange={(e) => setPayReference(e.target.value)}
                                placeholder="Referencia (opcional)"
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 sm:col-span-2"
                              />
                              <button
                                onClick={() => registerPayment(p.id)}
                                disabled={busy}
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
                              >
                                <Plus size={14} /> Registrar abono
                              </button>
                            </div>
                          )}

                          <div className="mt-3">
                            {paymentsLoading ? (
                              <p className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800">
                                <Loader2 className="animate-spin" size={14} /> Cargando abonos…
                              </p>
                            ) : payments.length === 0 ? (
                              <p className="text-xs font-bold text-emerald-800/60">Sin abonos registrados.</p>
                            ) : (
                              <ul className="space-y-1">
                                {payments.map((pay) => (
                                  <li
                                    key={pay.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[var(--brand-ink-2)]"
                                  >
                                    <span>
                                      {pay.paymentDate}
                                      {pay.paymentMethod ? ` · ${pay.paymentMethod}` : ""}
                                      {pay.reference ? ` · Ref. ${pay.reference}` : ""}
                                    </span>
                                    <span className="font-black text-emerald-700">
                                      {pay.amountUSD > 0 ? usd(pay.amountUSD) : ""}
                                      {pay.amountUSD > 0 && pay.amountVES > 0 ? " · " : ""}
                                      {pay.amountVES > 0 ? `Bs ${pay.amountVES.toFixed(2)}` : ""}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  )
                )}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  )
}
