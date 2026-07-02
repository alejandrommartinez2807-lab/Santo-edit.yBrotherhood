"use client"

// Envoltorio de los módulos del staff (lo monta ModuleAccessGuard cuando el
// acceso ya fue validado). Hace tres cosas:
//  1) Si el enlace trae ?sede=<id o nombre>, fija esa sucursal en el
//     dispositivo (enlaces por sede generados desde el panel de Sucursales).
//  2) En módulos operativos (caja, cocina, mesas…) con varias sedes, obliga a
//     elegir sede UNA vez por dispositivo antes de mostrar datos: nunca más
//     "no veo nada" sin saber de qué sede era.
//  3) Muestra la barra de módulos con la sede activa siempre visible.

import { useEffect, useState, type ReactNode } from "react"
import { Loader2, MapPin } from "lucide-react"
import {
  fetchActiveBranches,
  getSelectedBranchId,
  setSelectedBranchId,
  type StaffBranch,
} from "@/lib/branchClient"
import LocalModuleNav from "@/components/LocalModuleNav"

// Módulos cuyos datos son de UNA sede: exigen sede elegida antes de operar.
// Los administrativos (reportes, usuarios, configuración…) no bloquean.
const BRANCH_SCOPED_MODULES = new Set([
  "cashier",
  "kitchen",
  "kitchenItems",
  "openAccounts",
  "tables",
  "qrTables",
  "delivery",
  "paymentProofs",
  "tickets",
  "inventory",
  "inventoryAlerts",
  "history",
])

function readSedeParam(): string {
  if (typeof window === "undefined") return ""
  try {
    return (new URLSearchParams(window.location.search).get("sede") || "").trim()
  } catch {
    return ""
  }
}

function matchBranch(branches: StaffBranch[], value: string): StaffBranch | null {
  if (!value) return null
  const clean = value.toLowerCase()
  return (
    branches.find((branch) => branch.id === value) ||
    branches.find((branch) => branch.name.trim().toLowerCase() === clean) ||
    null
  )
}

export default function LocalStaffShell({
  moduleKey,
  allowedModules,
  roleLabel,
  displayName,
  children,
}: {
  moduleKey: string
  allowedModules: string[]
  roleLabel: string
  displayName?: string
  children: ReactNode
}) {
  const [branches, setBranches] = useState<StaffBranch[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const list = await fetchActiveBranches()
      if (cancelled) return

      // Enlace por sede: ?sede= manda sobre lo guardado en el dispositivo.
      const fromParam = matchBranch(list, readSedeParam())
      if (fromParam) setSelectedBranchId(fromParam.id)

      const stored = getSelectedBranchId()
      const valid = stored && list.some((branch) => branch.id === stored)

      // Con una sola sede no hay nada que preguntar: se fija sola.
      if (!valid && list.length === 1) setSelectedBranchId(list[0].id)

      setBranches(list)
      setSelected(getSelectedBranchId())
    })()

    return () => {
      cancelled = true
    }
  }, [])

  function chooseBranch(branchId: string) {
    setSelectedBranchId(branchId)
    setSelected(branchId)
  }

  const list = branches || []
  const selectedBranch = list.find((branch) => branch.id === selected) || null
  const needsChoice =
    BRANCH_SCOPED_MODULES.has(moduleKey) && list.length > 1 && !selectedBranch

  if (branches === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)]">
        <Loader2 className="animate-spin text-[var(--brand-primary)]" size={30} />
      </main>
    )
  }

  if (needsChoice) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
        <div className="w-full max-w-lg rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white px-6 py-8 text-center shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]">
            <MapPin size={30} />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
            ¿En qué sede estás?
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            Elige la sucursal donde trabajas. Este dispositivo la recordará y
            todo lo que veas será solo de esa sede (puedes cambiarla arriba
            cuando quieras).
          </p>
          <div className="mt-6 grid gap-3">
            {list.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => chooseBranch(branch.id)}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
              >
                <MapPin size={16} />
                {branch.name}
              </button>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <>
      <LocalModuleNav
        currentModuleKey={moduleKey}
        allowedModules={allowedModules}
        roleLabel={roleLabel}
        displayName={displayName}
        branches={list}
        selectedBranchId={selectedBranch?.id || null}
        onSelectBranch={(branchId) => {
          setSelectedBranchId(branchId)
          // Recargar: todos los datos del módulo pertenecen a la nueva sede.
          window.location.reload()
        }}
      />
      {children}
    </>
  )
}
