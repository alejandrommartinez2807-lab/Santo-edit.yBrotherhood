"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList, Loader2, LogIn, LogOut, Plus, Trash2 } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import {
  SHIFT_PRESETS,
  addDaysISO,
  shiftAttendanceStatus,
  weekDaysFrom,
  weekStartISO,
} from "@/lib/hotelStaffShifts"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Shift = {
  id: string
  staffUsername: string
  staffName: string
  shiftDate: string
  shiftLabel: string
  plannedStart: string
  plannedEnd: string
  checkInAt: string
  checkOutAt: string
  note: string
}
type RosterUser = { username: string; displayName: string }

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function TurnosPage() {
  return (
    <ModuleAccessGuard moduleKey="staffShifts" moduleName="Turnos">
      <TurnosContent />
    </ModuleAccessGuard>
  )
}

function TurnosContent() {
  const [weekStart, setWeekStart] = useState(() => weekStartISO(todayISO()))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [roster, setRoster] = useState<RosterUser[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [formUser, setFormUser] = useState("")
  const [formName, setFormName] = useState("")
  const [formDate, setFormDate] = useState(todayISO())
  const [formPreset, setFormPreset] = useState<string>(SHIFT_PRESETS[0].id)
  const [formNote, setFormNote] = useState("")

  const days = useMemo(() => weekDaysFrom(weekStart), [weekStart])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const to = addDaysISO(weekStart, 7)
      const res = await fetch(`/api/staff-shifts?from=${weekStart}&to=${to}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar los turnos")
      setDenied(false)
      setShifts(data.shifts || [])
      setRoster(data.roster || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  // Filas del tablero: todo el que tiene turno esta semana + el roster.
  const people = useMemo(() => {
    const map = new Map<string, string>()
    for (const user of roster) map.set(user.displayName, user.displayName)
    for (const shift of shifts) map.set(shift.staffName, shift.staffName)
    return [...map.keys()].sort((a, b) => a.localeCompare(b, "es"))
  }, [roster, shifts])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/staff-shifts", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo procesar")
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addShift() {
    const preset = SHIFT_PRESETS.find((p) => p.id === formPreset)
    const staffName = (formUser || formName).trim()
    if (!staffName) return
    const ok = await post({
      action: "save",
      staffUsername: formUser,
      staffName,
      shiftDate: formDate,
      shiftLabel: preset?.label || "Turno",
      plannedStart: preset?.start || "",
      plannedEnd: preset?.end || "",
      note: formNote.trim(),
    })
    if (ok) setFormNote("")
  }

  const inputClass =
    "rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-5xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <ClipboardList size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Turnos del personal</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Planifica la semana y marca la asistencia real. Sin nómina: solo turnos.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para turnos, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Planificar turno */}
            <div className="mt-6 grid gap-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
              {roster.length > 0 ? (
                <select value={formUser} onChange={(e) => setFormUser(e.target.value)} className={inputClass}>
                  <option value="">Elige el usuario…</option>
                  {roster.map((u) => (
                    <option key={u.username} value={u.displayName}>{u.displayName}</option>
                  ))}
                </select>
              ) : (
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nombre del empleado" className={inputClass} />
              )}
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={inputClass} />
              <select value={formPreset} onChange={(e) => setFormPreset(e.target.value)} className={inputClass}>
                {SHIFT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} ({p.start}–{p.end})</option>
                ))}
              </select>
              <input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Nota (opcional)" className={inputClass} />
              <button
                onClick={addShift}
                disabled={busy || !(formUser || formName).trim()}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-bold uppercase text-white disabled:opacity-50"
              >
                <Plus size={16} /> Turno
              </button>
            </div>

            {/* Navegación de semana */}
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--brand-primary)]/20 bg-white px-4 py-2.5">
              <button onClick={() => setWeekStart(addDaysISO(weekStart, -7))} className="inline-flex items-center gap-1 text-xs font-bold uppercase text-[var(--brand-primary)]">
                <ChevronLeft size={16} /> Semana anterior
              </button>
              <p className="font-serif font-semibold text-[var(--brand-ink-3)]">
                {weekStart} — {days[6] || ""}
              </p>
              <button onClick={() => setWeekStart(addDaysISO(weekStart, 7))} className="inline-flex items-center gap-1 text-xs font-bold uppercase text-[var(--brand-primary)]">
                Semana siguiente <ChevronRight size={16} />
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : people.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay usuarios ni turnos. Crea usuarios en el módulo Usuarios o agrega el primer turno arriba.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--brand-primary)]/20 bg-white">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--brand-primary)]/15 text-left text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/55">
                      <th className="px-3 py-2">Persona</th>
                      {days.map((day, i) => (
                        <th key={day} className={`px-2 py-2 ${day === todayISO() ? "text-[var(--brand-primary)]" : ""}`}>
                          {DAY_NAMES[i]} {day.slice(8)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person) => (
                      <tr key={person} className="border-b border-[var(--brand-primary)]/10 align-top">
                        <td className="px-3 py-2 font-bold text-[var(--brand-ink-3)]">{person}</td>
                        {days.map((day) => {
                          const dayShifts = shifts.filter((s) => s.staffName === person && s.shiftDate === day)
                          return (
                            <td key={day} className="px-2 py-2">
                              {dayShifts.map((shift) => (
                                <ShiftChip key={shift.id} shift={shift} busy={busy} onMark={(kind) => post({ action: "mark", id: shift.id, kind })} onDelete={() => { if (window.confirm(`¿Eliminar el turno de ${shift.staffName} del ${shift.shiftDate}?`)) post({ action: "delete", id: shift.id }) }} />
                              ))}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-3 text-xs font-bold text-[var(--brand-ink-2)]/50">
              Entrada y salida se sellan con la hora real al pulsar los botones del turno; la salida exige entrada previa.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function ShiftChip({
  shift,
  busy,
  onMark,
  onDelete,
}: {
  shift: Shift
  busy: boolean
  onMark: (kind: "in" | "out") => void
  onDelete: () => void
}) {
  const status = shiftAttendanceStatus(shift)
  const tone =
    status === "cumplido"
      ? "border-emerald-300 bg-emerald-50"
      : status === "presente"
        ? "border-amber-300 bg-amber-50"
        : "border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]/60"
  const hhmm = (iso: string) => (iso ? new Date(iso).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }) : "")

  return (
    <div className={`mb-1.5 rounded-lg border p-1.5 text-xs font-bold ${tone}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[var(--brand-ink-3)]">
          {shift.shiftLabel || "Turno"}
          {shift.plannedStart && <span className="ml-1 font-semibold text-[var(--brand-ink-2)]/60">{shift.plannedStart}–{shift.plannedEnd}</span>}
        </span>
        <button onClick={onDelete} disabled={busy} title="Eliminar turno" className="text-red-500 disabled:opacity-40">
          <Trash2 size={12} />
        </button>
      </div>
      {shift.note && <p className="mt-0.5 font-semibold text-[var(--brand-ink-2)]/60">{shift.note}</p>}
      <div className="mt-1 flex items-center gap-1.5">
        {status === "pendiente" && (
          <button onClick={() => onMark("in")} disabled={busy} className="inline-flex items-center gap-0.5 rounded border border-[var(--brand-primary)]/40 px-1.5 py-0.5 text-[10px] uppercase text-[var(--brand-primary)] disabled:opacity-40">
            <LogIn size={10} /> Entrada
          </button>
        )}
        {status === "presente" && (
          <>
            <span className="text-emerald-700">Entró {hhmm(shift.checkInAt)}</span>
            <button onClick={() => onMark("out")} disabled={busy} className="inline-flex items-center gap-0.5 rounded border border-[var(--brand-primary)]/40 px-1.5 py-0.5 text-[10px] uppercase text-[var(--brand-primary)] disabled:opacity-40">
              <LogOut size={10} /> Salida
            </button>
          </>
        )}
        {status === "cumplido" && (
          <span className="text-emerald-700">{hhmm(shift.checkInAt)} → {hhmm(shift.checkOutAt)}</span>
        )}
      </div>
    </div>
  )
}
