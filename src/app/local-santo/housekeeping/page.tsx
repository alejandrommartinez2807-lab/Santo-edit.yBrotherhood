"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BedDouble,
  Check,
  ClipboardList,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

// Estado de limpieza de la habitación (vive en rooms.housekeeping_status).
const ROOM_STATUSES = ["limpia", "sucia", "inspeccion", "mantenimiento"] as const
type RoomStatus = (typeof ROOM_STATUSES)[number]

const ROOM_LABELS: Record<string, string> = {
  limpia: "Limpia",
  sucia: "Sucia",
  inspeccion: "Inspección",
  mantenimiento: "Mantenimiento",
}

const ROOM_STYLES: Record<string, string> = {
  limpia: "border-green-600/30 bg-green-50 text-green-700",
  sucia: "border-amber-300 bg-amber-50 text-amber-700",
  inspeccion: "border-blue-300 bg-blue-50 text-blue-700",
  mantenimiento: "border-red-200 bg-red-50 text-red-600",
}

// Tareas asignables (housekeeping_tasks).
const TASK_TYPES = ["salida", "estancia", "inspeccion", "mantenimiento"] as const
const TASK_TYPE_LABELS: Record<string, string> = {
  salida: "Limpieza de salida",
  estancia: "Repaso de estancia",
  inspeccion: "Inspección",
  mantenimiento: "Mantenimiento",
}

const TASK_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  hecha: "Hecha",
}

type Room = {
  id: string
  name: string
  floor: string
  housekeepingStatus: string
  outOfService: boolean
}

type Task = {
  id: string
  roomId: string
  type: string
  status: string
  assignedTo: string
  note: string
  createdAt: string
  doneAt: string | null
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function HousekeepingPage() {
  return (
    <ModuleAccessGuard moduleKey="housekeeping" moduleName="Limpieza">
      <HousekeepingPageContent />
    </ModuleAccessGuard>
  )
}

function HousekeepingPageContent() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Formulario de nueva tarea, abierto para una habitación a la vez.
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [taskType, setTaskType] = useState<string>("salida")
  const [taskAssignee, setTaskAssignee] = useState("")
  const [taskNote, setTaskNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/housekeeping", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setRooms(data.rooms || [])
      setTasks(data.tasks || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const tasksByRoom = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((task) => {
      const list = map.get(task.roomId) || []
      list.push(task)
      map.set(task.roomId, list)
    })
    return map
  }, [tasks])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { limpia: 0, sucia: 0, inspeccion: 0, mantenimiento: 0 }
    rooms.forEach((room) => {
      const key = counts[room.housekeepingStatus] === undefined ? "limpia" : room.housekeepingStatus
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }, [rooms])

  const openTaskCount = useMemo(
    () => tasks.filter((task) => task.status !== "hecha").length,
    [tasks],
  )

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/housekeeping", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
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

  async function setRoomStatus(room: Room, status: RoomStatus) {
    if (room.housekeepingStatus === status) return
    await post({ action: "setRoomStatus", roomId: room.id, status })
  }

  async function addTask(room: Room) {
    const ok = await post({
      action: "createTask",
      roomId: room.id,
      type: taskType,
      assignedTo: taskAssignee.trim(),
      note: taskNote.trim(),
    })
    if (ok) {
      setAddingFor(null)
      setTaskAssignee("")
      setTaskNote("")
      setTaskType("salida")
    }
  }

  async function advanceTask(task: Task) {
    const next = task.status === "pendiente" ? "en_proceso" : "hecha"
    await post({ action: "updateTask", id: task.id, status: next })
  }

  async function reopenTask(task: Task) {
    await post({ action: "updateTask", id: task.id, status: "pendiente" })
  }

  async function removeTask(task: Task) {
    if (!window.confirm("¿Eliminar esta tarea de limpieza?")) return
    await post({ action: "deleteTask", id: task.id })
  }

  const inputClass =
    "rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/local-santo"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Sparkles size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Limpieza</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Estado de limpieza por habitación y tareas asignables. El check-out marca la
              habitación como sucia automáticamente.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para usar limpieza, o el módulo está desactivado en la
            configuración del negocio.
          </p>
        ) : loading ? (
          <p className="mt-8 inline-flex items-center gap-2 font-bold">
            <Loader2 className="animate-spin" size={18} /> Cargando…
          </p>
        ) : (
          <>
            {/* Resumen */}
            <div className="mt-6 flex flex-wrap gap-2">
              {ROOM_STATUSES.map((status) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${ROOM_STYLES[status]}`}
                >
                  {statusCounts[status] || 0} {ROOM_LABELS[status]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-ink-2)]/70">
                <ClipboardList size={13} /> {openTaskCount} tareas abiertas
              </span>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {rooms.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                No hay habitaciones aún. Créalas en el módulo Habitaciones para usar el tablero de
                limpieza.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {rooms.map((room) => {
                  const roomTasks = tasksByRoom.get(room.id) || []
                  const openTasks = roomTasks.filter((task) => task.status !== "hecha")
                  const doneCount = roomTasks.length - openTasks.length
                  return (
                    <li
                      key={room.id}
                      className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <BedDouble size={18} className="text-[var(--brand-primary)]" />
                          <p className="text-lg font-black text-[var(--brand-ink-3)]">
                            {room.name}
                            {room.floor ? (
                              <span className="ml-2 text-sm font-bold text-[var(--brand-ink-2)]/55">
                                · Piso {room.floor}
                              </span>
                            ) : null}
                          </p>
                          {room.outOfService && (
                            <span className="text-xs font-black uppercase text-red-600">
                              Fuera de servicio
                            </span>
                          )}
                        </div>
                        <span
                          className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                            ROOM_STYLES[room.housekeepingStatus] || ROOM_STYLES.limpia
                          }`}
                        >
                          {ROOM_LABELS[room.housekeepingStatus] || room.housekeepingStatus}
                        </span>
                      </div>

                      {/* Cambiar estado de limpieza */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {ROOM_STATUSES.map((status) => (
                          <button
                            key={status}
                            onClick={() => setRoomStatus(room, status)}
                            disabled={busy || room.housekeepingStatus === status}
                            className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase disabled:opacity-40 ${
                              room.housekeepingStatus === status
                                ? ROOM_STYLES[status]
                                : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink-2)]/70"
                            }`}
                          >
                            {ROOM_LABELS[status]}
                          </button>
                        ))}
                      </div>

                      {/* Tareas abiertas */}
                      {openTasks.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {openTasks.map((task) => (
                            <li
                              key={task.id}
                              className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-3 py-2"
                            >
                              <span className="rounded-full border-2 border-[var(--brand-primary)]/20 bg-white px-2 py-0.5 text-[11px] font-black uppercase text-[var(--brand-ink-2)]/70">
                                {TASK_TYPE_LABELS[task.type] || task.type}
                              </span>
                              <span
                                className={`text-[11px] font-black uppercase ${
                                  task.status === "en_proceso"
                                    ? "text-blue-600"
                                    : "text-amber-600"
                                }`}
                              >
                                {TASK_STATUS_LABELS[task.status] || task.status}
                              </span>
                              {task.assignedTo && (
                                <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--brand-ink-2)]/70">
                                  <UserRound size={13} /> {task.assignedTo}
                                </span>
                              )}
                              {task.note && (
                                <span className="text-sm font-bold text-[var(--brand-ink-2)]/55">
                                  {task.note}
                                </span>
                              )}
                              <div className="ml-auto flex items-center gap-1.5">
                                <button
                                  onClick={() => advanceTask(task)}
                                  disabled={busy}
                                  title={
                                    task.status === "pendiente" ? "Empezar" : "Marcar hecha"
                                  }
                                  className="inline-flex items-center justify-center rounded-full border-2 border-green-600/30 bg-green-50 p-1.5 text-green-700 disabled:opacity-50"
                                >
                                  {task.status === "pendiente" ? (
                                    <Play size={14} />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                </button>
                                <button
                                  onClick={() => removeTask(task)}
                                  disabled={busy}
                                  title="Eliminar tarea"
                                  className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-1.5 text-red-600 disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Pie: contador de hechas + agregar tarea */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {doneCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                            <Check size={13} /> {doneCount} hecha(s)
                          </span>
                        )}
                        {doneCount > 0 && (
                          <button
                            onClick={() => {
                              const done = roomTasks.find((t) => t.status === "hecha")
                              if (done) reopenTask(done)
                            }}
                            disabled={busy}
                            title="Reabrir la última tarea hecha"
                            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-ink-2)]/55 disabled:opacity-50"
                          >
                            <RotateCcw size={12} /> Reabrir
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setAddingFor((current) => (current === room.id ? null : room.id))
                          }
                          disabled={busy}
                          className="ml-auto inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-primary)] disabled:opacity-50"
                        >
                          <Plus size={14} /> Tarea
                        </button>
                      </div>

                      {/* Formulario de nueva tarea */}
                      {addingFor === room.id && (
                        <div className="mt-3 grid gap-2 rounded-xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3 sm:grid-cols-2">
                          <select
                            value={taskType}
                            onChange={(e) => setTaskType(e.target.value)}
                            className={inputClass}
                          >
                            {TASK_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {TASK_TYPE_LABELS[type]}
                              </option>
                            ))}
                          </select>
                          <input
                            value={taskAssignee}
                            onChange={(e) => setTaskAssignee(e.target.value)}
                            placeholder="Responsable (opcional)"
                            className={inputClass}
                          />
                          <input
                            value={taskNote}
                            onChange={(e) => setTaskNote(e.target.value)}
                            placeholder="Nota (opcional)"
                            className={`${inputClass} sm:col-span-2`}
                          />
                          <button
                            onClick={() => addTask(room)}
                            disabled={busy}
                            className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
                          >
                            <Plus size={16} /> Asignar tarea
                          </button>
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
