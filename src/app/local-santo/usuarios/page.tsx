"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  KeyRound,
  Loader2,
  Pencil,
  Power,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import type { LocalModuleKey } from "@/lib/localPlans"
import { normalizeStaffUsername } from "@/lib/staffIdentity"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

const ROLES: { value: string; label: string; defaultModules: LocalModuleKey[] }[] = [
  {
    value: "owner",
    label: "Dueño",
    defaultModules: [
      "mainPanel",
      "cashier",
      "kitchen",
      "kitchenItems",
      "delivery",
      "openAccounts",
      "tickets",
      "tables",
      "qrTables",
      "inventory",
      "inventoryAlerts",
      "suppliers",
      "supplierPurchases",
      "accountsPayable",
      "expenses",
      "history",
      "reports",
      "settings",
      "branches",
      "roles",
      "support",
    ],
  },
  {
    value: "manager",
    label: "Encargado",
    defaultModules: [
      "mainPanel",
      "cashier",
      "kitchen",
      "delivery",
      "openAccounts",
      "tickets",
      "tables",
      "inventory",
      "inventoryAlerts",
      "suppliers",
      "supplierPurchases",
      "expenses",
      "history",
      "reports",
    ],
  },
  { value: "cashier", label: "Caja", defaultModules: ["mainPanel", "cashier", "paymentProofs", "tickets", "openAccounts"] },
  { value: "waiter", label: "Mesonero", defaultModules: ["mainPanel", "openAccounts", "tables", "qrTables", "waiterConfirmation", "tickets"] },
  { value: "promoter", label: "Promotor (eventos/ferias)", defaultModules: ["mainPanel", "cashier", "paymentProofs", "tickets"] },
  { value: "kitchen", label: "Cocina", defaultModules: ["kitchen", "kitchenItems", "tickets"] },
  { value: "delivery", label: "Delivery", defaultModules: ["delivery"] },
  { value: "support", label: "Soporte", defaultModules: ["support", "roles", "branches", "settings"] },
]

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label]),
)

const MODULE_OPTIONS: { key: LocalModuleKey; label: string }[] = [
  { key: "mainPanel", label: "Inicio / Pedidos" },
  { key: "cashier", label: "Caja" },
  { key: "paymentProofs", label: "Comprobantes" },
  { key: "kitchen", label: "Cocina" },
  { key: "kitchenItems", label: "Cocina por producto" },
  { key: "delivery", label: "Delivery" },
  { key: "openAccounts", label: "Mesonero / Cuentas abiertas" },
  { key: "tickets", label: "Tickets" },
  { key: "tables", label: "Mesas" },
  { key: "qrTables", label: "QR por mesa" },
  { key: "inventory", label: "Inventario" },
  { key: "inventoryAlerts", label: "Inventario alertas" },
  { key: "suppliers", label: "Proveedores" },
  { key: "supplierPurchases", label: "Compras" },
  { key: "accountsPayable", label: "Cuentas por pagar" },
  { key: "expenses", label: "Gastos" },
  { key: "history", label: "Cierres" },
  { key: "reports", label: "Reportes" },
  { key: "settings", label: "Configuración" },
  { key: "branches", label: "Sucursales" },
  { key: "roles", label: "Usuarios" },
  { key: "support", label: "Soporte" },
]

const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  MODULE_OPTIONS.map((item) => [item.key, item.label]),
)

type Branch = {
  id: string
  name: string
  is_active?: boolean
}

type StaffUser = {
  id: string
  email: string
  username: string
  displayName: string
  full_name: string
  role: string
  is_active: boolean
  permissionsMode: "role" | "custom"
  allowedModules: LocalModuleKey[]
  allBranches: boolean
  allowedBranchIds: string[]
  lastAccessAt?: string
}

type StaffForm = {
  username: string
  password: string
  displayName: string
  role: string
  permissionsMode: "role" | "custom"
  allowedModules: LocalModuleKey[]
  allBranches: boolean
  allowedBranchIds: string[]
}

const EMPTY_FORM: StaffForm = {
  username: "",
  password: "",
  displayName: "",
  role: "cashier",
  permissionsMode: "role",
  allowedModules: [],
  allBranches: false,
  allowedBranchIds: [],
}

function getRoleDefaultModules(role: string): LocalModuleKey[] {
  return ROLES.find((item) => item.value === role)?.defaultModules || []
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || ""
      : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function formatDate(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function summarizeModules(modules: LocalModuleKey[]) {
  if (!modules.length) return "Sin módulos"
  if (modules.length > 4) {
    return `${modules.slice(0, 4).map((key) => MODULE_LABEL[key] || key).join(", ")} +${modules.length - 4}`
  }
  return modules.map((key) => MODULE_LABEL[key] || key).join(", ")
}

function summarizeBranches(user: StaffUser, branches: Branch[]) {
  if (user.allBranches) return "Todas"
  const names = user.allowedBranchIds
    .map((id) => branches.find((branch) => branch.id === id)?.name || id)
    .filter(Boolean)
  return names.length ? names.join(", ") : "Sin sede asignada"
}

function ModuleCheckboxes({
  selected,
  onChange,
}: {
  selected: LocalModuleKey[]
  onChange: (modules: LocalModuleKey[]) => void
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected])

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {MODULE_OPTIONS.map((moduleOption) => {
        const checked = selectedSet.has(moduleOption.key)
        return (
          <label
            key={moduleOption.key}
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] ${
              checked
                ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink-2)]/70"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                onChange(
                  checked
                    ? selected.filter((key) => key !== moduleOption.key)
                    : [...selected, moduleOption.key],
                )
              }}
            />
            {moduleOption.label}
          </label>
        )
      })}
    </div>
  )
}

function BranchCheckboxes({
  branches,
  allBranches,
  selected,
  onAllBranchesChange,
  onSelectedChange,
}: {
  branches: Branch[]
  allBranches: boolean
  selected: string[]
  onAllBranchesChange: (value: boolean) => void
  onSelectedChange: (branchIds: string[]) => void
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected])

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)]">
        <input
          type="checkbox"
          checked={allBranches}
          onChange={(e) => onAllBranchesChange(e.target.checked)}
        />
        Todas las sedes
      </label>
      {!allBranches ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => {
            const checked = selectedSet.has(branch.id)
            return (
              <label
                key={branch.id}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] ${
                  checked
                    ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                    : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink-2)]/70"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    onSelectedChange(
                      checked
                        ? selected.filter((id) => id !== branch.id)
                        : [...selected, branch.id],
                    )
                  }}
                />
                {branch.name}
              </label>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function StaffFormFields({
  form,
  setForm,
  branches,
  requirePassword,
}: {
  form: StaffForm
  setForm: (form: StaffForm) => void
  branches: Branch[]
  requirePassword: boolean
}) {
  const roleModules = getRoleDefaultModules(form.role)
  const visibleModules = form.permissionsMode === "custom" ? form.allowedModules : roleModules

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          required
          type="text"
          placeholder="Usuario: maria"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: normalizeStaffUsername(e.target.value) })}
          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
        />
        <input
          required={requirePassword}
          type="text"
          placeholder={requirePassword ? "Clave inicial" : "Nueva clave (opcional)"}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
        />
        <input
          type="text"
          placeholder="Nombre visible"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
        />
        <select
          value={form.role}
          onChange={(e) => {
            const role = e.target.value
            setForm({
              ...form,
              role,
              allowedModules: form.permissionsMode === "role" ? getRoleDefaultModules(role) : form.allowedModules,
              allBranches: role === "owner" || role === "support" ? true : form.allBranches,
            })
          }}
          className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
        >
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">Sedes permitidas</p>
        <div className="mt-3">
          <BranchCheckboxes
            branches={branches}
            allBranches={form.allBranches}
            selected={form.allowedBranchIds}
            onAllBranchesChange={(allBranches) => setForm({ ...form, allBranches })}
            onSelectedChange={(allowedBranchIds) => setForm({ ...form, allowedBranchIds })}
          />
        </div>
      </div>

      <div className="rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">Módulos permitidos</p>
            <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
              {form.permissionsMode === "role" ? "Usando permisos del rol." : "Permisos personalizados para este trabajador."}
            </p>
          </div>
          <select
            value={form.permissionsMode}
            onChange={(e) => {
              const permissionsMode = e.target.value === "custom" ? "custom" : "role"
              setForm({
                ...form,
                permissionsMode,
                allowedModules: permissionsMode === "custom" ? visibleModules : getRoleDefaultModules(form.role),
              })
            }}
            className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.1em] outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="role">Por rol</option>
            <option value="custom">Personalizados</option>
          </select>
        </div>

        <div className="mt-3">
          {form.permissionsMode === "custom" ? (
            <ModuleCheckboxes
              selected={form.allowedModules}
              onChange={(allowedModules) => setForm({ ...form, allowedModules })}
            />
          ) : (
            <p className="rounded-xl border border-[var(--brand-primary)]/15 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
              {summarizeModules(roleModules)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function UsuariosContent() {
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const [form, setForm] = useState<StaffForm>({
    ...EMPTY_FORM,
    allowedModules: getRoleDefaultModules(EMPTY_FORM.role),
  })
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<StaffForm>({ ...EMPTY_FORM })

  const activeBranches = branches.filter((branch) => branch.is_active !== false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/staff", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setStaff(data.staff || [])
      setBranches(data.branches || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Difiere la carga un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (form.allowedBranchIds.length === 0 && activeBranches.length === 1 && !form.allBranches) {
      const timer = setTimeout(() => {
        setForm((current) => ({ ...current, allowedBranchIds: [activeBranches[0].id] }))
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [activeBranches, form.allowedBranchIds.length, form.allBranches])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError("")
    try {
      const payload = {
        ...form,
        fullName: form.displayName,
        allowedModules: form.permissionsMode === "custom" ? form.allowedModules : getRoleDefaultModules(form.role),
      }
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      setForm({ ...EMPTY_FORM, allowedModules: getRoleDefaultModules(EMPTY_FORM.role) })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear")
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(u: StaffUser) {
    setBusyId(u.id)
    setError("")
    try {
      const res = await fetch(`/api/staff/${u.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: !u.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusyId(null)
    }
  }

  async function resetPassword(u: StaffUser) {
    const newPassword = window.prompt(`Nueva contraseña para ${u.username || u.email} (mín. 6):`)
    if (!newPassword) return
    setBusyId(u.id)
    setError("")
    try {
      const res = await fetch(`/api/staff/${u.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudo cambiar la clave")
      window.alert("Contraseña actualizada.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusyId(null)
    }
  }

  function beginEdit(u: StaffUser) {
    setEditingId(u.id)
    setEditForm({
      username: u.username,
      password: "",
      displayName: u.displayName || u.full_name,
      role: u.role,
      permissionsMode: u.permissionsMode || "role",
      allowedModules: u.allowedModules?.length ? u.allowedModules : getRoleDefaultModules(u.role),
      allBranches: u.allBranches,
      allowedBranchIds: u.allowedBranchIds || [],
    })
  }

  async function saveEdit(userId: string) {
    setBusyId(userId)
    setError("")
    try {
      const payload: Record<string, unknown> = {
        username: editForm.username,
        fullName: editForm.displayName,
        role: editForm.role,
        permissionsMode: editForm.permissionsMode,
        allowedModules: editForm.permissionsMode === "custom"
          ? editForm.allowedModules
          : getRoleDefaultModules(editForm.role),
        allBranches: editForm.allBranches,
        allowedBranchIds: editForm.allowedBranchIds,
      }
      if (editForm.password.trim()) payload.password = editForm.password.trim()

      const res = await fetch(`/api/staff/${userId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudo guardar")
      setEditingId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-7xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Usuarios del personal</h1>
              <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
                Crea usuarios simples por nombre, asigna sedes y controla módulos reales.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
            {staff.filter((u) => u.is_active).length} activo(s)
          </span>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white p-5 text-sm font-bold text-[var(--brand-primary)]">
            Solo dueño o soporte pueden gestionar usuarios. Inicia sesión con un usuario autorizado en <Link href="/acceso" className="underline">/acceso</Link>.
          </p>
        ) : (
          <>
            <form onSubmit={handleCreate} className="mt-6 rounded-[1.6rem] border-2 border-[var(--brand-primary)]/20 bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Nuevo trabajador</p>
              <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/65">
                El dueño escribe un usuario como <strong>maria</strong>. Internamente, si Supabase lo necesita, se crea como usuario técnico.
              </p>
              <div className="mt-4">
                <StaffFormFields form={form} setForm={setForm} branches={activeBranches} requirePassword />
              </div>
              <button type="submit" disabled={creating} className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-60">
                {creating ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />} Crear usuario
              </button>
            </form>

            {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}

            <div className="mt-6 overflow-hidden rounded-[1.6rem] border-2 border-[var(--brand-primary)]/20 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--brand-primary)]/10 text-left text-sm">
                  <thead className="bg-[var(--brand-primary)] text-white">
                    <tr>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">Trabajador</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">Usuario</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">Rol</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">Sedes</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">Módulos</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">Estado</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">Último acceso</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--brand-primary)]/10">
                    {loading ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center"><Loader2 className="mx-auto animate-spin text-[var(--brand-primary)]" size={24} /></td></tr>
                    ) : staff.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center font-bold text-[var(--brand-ink-2)]/60">Aún no hay usuarios. Crea el primero arriba.</td></tr>
                    ) : staff.map((u) => (
                      <tr key={u.id} className={u.is_active ? "bg-white" : "bg-[var(--brand-primary)]/5"}>
                        <td className="px-4 py-3 align-top font-black text-[var(--brand-ink-3)]">{u.displayName || u.full_name || u.username}</td>
                        <td className="px-4 py-3 align-top font-bold text-[var(--brand-ink-2)]/75">{u.username}</td>
                        <td className="px-4 py-3 align-top font-bold">{ROLE_LABEL[u.role] || u.role}</td>
                        <td className="max-w-[220px] px-4 py-3 align-top">
                          <span className={`inline-block rounded-full px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.06em] ${
                            u.allBranches
                              ? "bg-amber-100 text-amber-800"
                              : u.allowedBranchIds.length
                                ? "bg-sky-100 text-sky-800"
                                : "bg-red-100 text-red-800"
                          }`}>
                            {summarizeBranches(u, branches)}
                          </span>
                        </td>
                        <td className="max-w-[320px] px-4 py-3 align-top">
                          <p className="font-bold text-[var(--brand-ink-2)]/75">{summarizeModules(u.allowedModules || [])}</p>
                          <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                            {u.permissionsMode === "custom" ? "Permisos personalizados" : "Permisos por rol"}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`rounded-full px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] ${u.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                            {u.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top font-bold text-[var(--brand-ink-2)]/60">{formatDate(u.lastAccessAt)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => beginEdit(u)} disabled={busyId === u.id} className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/40 bg-white px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50">
                              <Pencil size={13} /> Editar
                            </button>
                            <button onClick={() => toggleActive(u)} disabled={busyId === u.id} className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)] bg-white px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50">
                              <Power size={13} /> {u.is_active ? "Desactivar" : "Activar"}
                            </button>
                            <button onClick={() => resetPassword(u)} disabled={busyId === u.id} className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/40 bg-white px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50">
                              <KeyRound size={13} /> Reset clave
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {editingId ? (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--brand-ink-3)]/55 px-4 py-4 backdrop-blur-sm sm:items-center">
                <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-cream)] p-5 shadow-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Editar trabajador</p>
                      <h2 className="mt-1 text-2xl font-black uppercase text-[var(--brand-ink-3)]">Permisos, sedes y datos</h2>
                    </div>
                    <button onClick={() => setEditingId(null)} className="rounded-full border-2 border-[var(--brand-primary)] bg-white p-2 text-[var(--brand-primary)]"><X size={20} /></button>
                  </div>
                  <div className="mt-4">
                    <StaffFormFields form={editForm} setForm={setEditForm} branches={activeBranches} requirePassword={false} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => saveEdit(editingId)} disabled={busyId === editingId} className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-60">
                      {busyId === editingId ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Guardar cambios
                    </button>
                    <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      <X size={16} /> Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}

export default function UsuariosPage() {
  return (
    <ModuleAccessGuard moduleKey="roles" moduleName="Usuarios">
      <UsuariosContent />
    </ModuleAccessGuard>
  )
}
