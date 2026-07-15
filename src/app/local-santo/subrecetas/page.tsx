"use client"

// Subrecetas: preparaciones base reutilizables (carnes, masas, salsas) hechas
// con insumos del inventario. CRUD sencillo por sucursal; el costo se calcula
// en vivo con el costo de cada insumo. Reusa /api/subrecipes y /api/inventory.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Trash2, Pencil, X, ChefHat } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type InventoryItem = {
  id: string
  name: string
  unit: string
  costUSD: number
  equivalentCostUSD: number
  isActive: boolean
}

type SubrecipeIngredient = {
  itemId: string
  itemName: string
  quantity: number
  unit: string
}

type Subrecipe = {
  id: string
  name: string
  yieldQuantity: number
  yieldUnit: string
  ingredients: SubrecipeIngredient[]
  note: string
  isActive: boolean
}

type IngredientRow = { itemId: string; quantity: string }

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || ""
      : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function usd(n: number) {
  return `$${(Number(n) || 0).toFixed(2)}`
}

function unitCostOf(item: InventoryItem | undefined) {
  if (!item) return 0
  return Number(item.equivalentCostUSD) || Number(item.costUSD) || 0
}

export default function SubrecetasPage() {
  return (
    <ModuleAccessGuard moduleKey="subrecipes" moduleName="Subrecetas">
      <SubrecetasContent />
    </ModuleAccessGuard>
  )
}

function SubrecetasContent() {
  const [subrecipes, setSubrecipes] = useState<Subrecipe[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Formulario (crear o editar).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [yieldQuantity, setYieldQuantity] = useState("1")
  const [yieldUnit, setYieldUnit] = useState("porción")
  const [note, setNote] = useState("")
  const [rows, setRows] = useState<IngredientRow[]>([{ itemId: "", quantity: "" }])

  const itemsById = useMemo(() => {
    const map = new Map<string, InventoryItem>()
    inventory.forEach((item) => map.set(item.id, item))
    return map
  }, [inventory])

  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory", { headers: authHeaders(), cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setInventory(
        (data.inventory || []).filter((i: InventoryItem) => i.isActive !== false),
      )
    } catch {
      /* inventario es opcional para el picker */
    }
  }, [])

  const loadSubrecipes = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/subrecipes", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setSubrecipes(Array.isArray(data.subrecipes) ? data.subrecipes : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInventory()
      loadSubrecipes()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadInventory, loadSubrecipes])

  function resetForm() {
    setEditingId(null)
    setName("")
    setYieldQuantity("1")
    setYieldUnit("porción")
    setNote("")
    setRows([{ itemId: "", quantity: "" }])
  }

  function startEdit(sr: Subrecipe) {
    setEditingId(sr.id)
    setName(sr.name)
    setYieldQuantity(String(sr.yieldQuantity || 1))
    setYieldUnit(sr.yieldUnit || "porción")
    setNote(sr.note || "")
    setRows(
      sr.ingredients.length
        ? sr.ingredients.map((ing) => ({
            itemId: ing.itemId,
            quantity: String(ing.quantity || ""),
          }))
        : [{ itemId: "", quantity: "" }],
    )
    setError("")
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function buildIngredients(): SubrecipeIngredient[] {
    return rows
      .filter((row) => row.itemId && Number(row.quantity) > 0)
      .map((row) => {
        const item = itemsById.get(row.itemId)
        return {
          itemId: row.itemId,
          itemName: item?.name || "",
          quantity: Number(row.quantity) || 0,
          unit: item?.unit || "unidades",
        }
      })
  }

  async function save() {
    if (!name.trim()) {
      setError("Escribe el nombre de la subreceta.")
      return
    }
    const ingredients = buildIngredients()
    setBusy(true)
    setError("")
    try {
      const payload = {
        name: name.trim(),
        yieldQuantity: Number(yieldQuantity) || 1,
        yieldUnit: yieldUnit.trim() || "porción",
        ingredients,
        note: note.trim(),
      }
      const res = await fetch(
        editingId ? `/api/subrecipes/${editingId}` : "/api/subrecipes",
        {
          method: editingId ? "PATCH" : "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo guardar")
      resetForm()
      await loadSubrecipes()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function remove(sr: Subrecipe) {
    if (!window.confirm(`¿Eliminar la subreceta "${sr.name}"?`)) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/subrecipes/${sr.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar")
      if (editingId === sr.id) resetForm()
      await loadSubrecipes()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function subrecipeCost(sr: Subrecipe) {
    return sr.ingredients.reduce(
      (sum, ing) => sum + unitCostOf(itemsById.get(ing.itemId)) * ing.quantity,
      0,
    )
  }

  // Costo estimado en vivo del formulario.
  const draftCost = useMemo(() => {
    return rows.reduce((sum, row) => {
      const qty = Number(row.quantity) || 0
      return sum + unitCostOf(itemsById.get(row.itemId)) * qty
    }, 0)
  }, [rows, itemsById])
  const draftYield = Number(yieldQuantity) || 1

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/local-santo/inventario"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]"
          >
            <ArrowLeft size={16} /> Inventario
          </Link>
          <Link
            href="/admin"
            className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]/70"
          >
            Panel
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <ChefHat size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Subrecetas</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Preparaciones base reutilizables hechas con insumos del inventario.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Inicia sesión como dueño y activa el módulo de Subrecetas desde la
            configuración del negocio para usarlo.
          </p>
        ) : (
          <>
            {/* Formulario */}
            <div className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                {editingId ? "Editar subreceta" : "Nueva subreceta"}
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)] sm:col-span-2">
                  Nombre
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Carne mechada, Masa de pizza…"
                    className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Rinde (cantidad)
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={yieldQuantity}
                    onChange={(e) => setYieldQuantity(e.target.value)}
                    className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Unidad de rendimiento
                  <input
                    value={yieldUnit}
                    onChange={(e) => setYieldUnit(e.target.value)}
                    placeholder="porción, kg, litro…"
                    className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                  />
                </label>
              </div>

              {/* Ingredientes */}
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                Ingredientes (del inventario)
              </p>
              {inventory.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3 text-xs font-bold text-[var(--brand-ink-2)]/60">
                  No hay insumos activos en inventario. Puedes crear la subreceta
                  igual y agregar ingredientes cuando cargues insumos.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {rows.map((row, index) => {
                    const item = itemsById.get(row.itemId)
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={row.itemId}
                          onChange={(e) =>
                            setRows((current) =>
                              current.map((r, i) =>
                                i === index ? { ...r, itemId: e.target.value } : r,
                              ),
                            )
                          }
                          className="min-w-0 flex-1 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                        >
                          <option value="">Insumo…</option>
                          {inventory.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={row.quantity}
                          onChange={(e) =>
                            setRows((current) =>
                              current.map((r, i) =>
                                i === index ? { ...r, quantity: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Cant."
                          className="w-24 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                        />
                        <span className="w-16 shrink-0 text-xs font-bold text-[var(--brand-ink-2)]/55">
                          {item?.unit || ""}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRows((current) =>
                              current.length > 1
                                ? current.filter((_, i) => i !== index)
                                : current,
                            )
                          }
                          className="rounded-lg border border-red-200 bg-white p-1.5 text-red-600"
                          title="Quitar ingrediente"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setRows((current) => [...current, { itemId: "", quantity: "" }])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-[0.66rem] font-bold uppercase text-[var(--brand-primary)]"
                  >
                    <Plus size={13} /> Agregar ingrediente
                  </button>
                </div>
              )}

              <label className="mt-4 flex flex-col gap-1 text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                Nota
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opcional (preparación, tiempos…)"
                  className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[var(--brand-ink-2)]/65">
                  Costo estimado:{" "}
                  <span className="font-bold text-[var(--brand-ink-3)]">{usd(draftCost)}</span>
                  {draftYield > 0 && (
                    <>
                      {" "}· {usd(draftCost / draftYield)} por {yieldUnit.trim() || "unidad"}
                    </>
                  )}
                </p>
                <div className="flex gap-2">
                  {editingId && (
                    <button
                      onClick={resetForm}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-2.5 text-xs font-bold uppercase text-[var(--brand-primary)] disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={save}
                    disabled={busy || !name.trim()}
                    className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-xs font-bold uppercase text-white disabled:opacity-50"
                  >
                    <Plus size={15} /> {editingId ? "Guardar cambios" : "Crear subreceta"}
                  </button>
                </div>
              </div>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Listado */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : subrecipes.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay subrecetas. Crea la primera arriba.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {subrecipes.map((sr) => {
                  const cost = subrecipeCost(sr)
                  const perUnit = sr.yieldQuantity > 0 ? cost / sr.yieldQuantity : cost
                  return (
                    <li
                      key={sr.id}
                      className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-lg font-bold text-[var(--brand-ink-3)]">
                            {sr.name}
                            {!sr.isActive && (
                              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-zinc-600">
                                Inactiva
                              </span>
                            )}
                          </p>
                          <p className="text-xs font-bold text-[var(--brand-ink-2)]/60">
                            Rinde {sr.yieldQuantity} {sr.yieldUnit}
                            {sr.note ? ` · ${sr.note}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-bold text-[var(--brand-ink-3)]">{usd(cost)}</p>
                            <p className="text-[0.66rem] font-bold text-[var(--brand-ink-2)]/55">
                              {usd(perUnit)} / {sr.yieldUnit}
                            </p>
                          </div>
                          <button
                            onClick={() => startEdit(sr)}
                            disabled={busy}
                            title="Editar"
                            className="inline-flex items-center justify-center rounded-full border border-[var(--brand-primary)]/25 bg-white p-2 text-[var(--brand-primary)] disabled:opacity-50"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => remove(sr)}
                            disabled={busy}
                            title="Eliminar"
                            className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {sr.ingredients.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {sr.ingredients.map((ing, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-[var(--brand-cream)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/75"
                            >
                              {ing.quantity} {ing.unit} · {ing.itemName || "insumo"}
                            </span>
                          ))}
                        </div>
                      )}
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
