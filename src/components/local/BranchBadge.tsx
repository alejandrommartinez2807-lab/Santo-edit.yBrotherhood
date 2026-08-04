"use client"

import { useEffect, useMemo, useState } from "react"
import { MapPin } from "lucide-react"
import {
  fetchActiveBranches,
  getSelectedBranchId,
  BRANCH_CHANGE_EVENT,
  type StaffBranch,
} from "@/lib/branchClient"

// Rótulo SOLO-LECTURA con el nombre de la sucursal, para la cabecera grande de
// los paneles de staff (caja, cocina, delivery, mesonero, pantalla…). Con las
// claves compartidas es fácil abrir el panel de la sede equivocada y cobrar
// donde no era: el nombre tiene que estar delante de los ojos, no solo en la
// píldora pequeña de la barra de módulos.
//
// No es un selector a propósito: cambiar de sede ya vive en la barra de
// módulos (LocalModuleNav) y en /pedidos (CurrentBranchBanner). Dos selects
// que recargan la página serían dos sitios donde equivocarse.
//
// En negocios de una sola sede no pinta nada (las plantillas mono-sede no
// necesitan este ruido).

// /api/branches no cambia durante el turno: una sola consulta por página, y
// las demás instancias (o remontajes) la reutilizan un rato.
let cachedBranches: { at: number; promise: Promise<StaffBranch[]> } | null = null
const BRANCHES_CACHE_MS = 60_000

function loadBranchesOnce(): Promise<StaffBranch[]> {
  const now = Date.now()

  if (!cachedBranches || now - cachedBranches.at > BRANCHES_CACHE_MS) {
    cachedBranches = { at: now, promise: fetchActiveBranches() }
    // Un fallo no puede quedarse pegado 60 s: se olvida para reintentar.
    cachedBranches.promise.then(
      (list) => {
        if (list.length === 0) cachedBranches = null
      },
      () => {
        cachedBranches = null
      },
    )
  }

  return cachedBranches.promise
}

export default function BranchBadge({
  tone = "light",
  className = "",
}: {
  // "dark" para la pantalla de TV (fondo #0a0a0a): mismo dato, otra piel.
  tone?: "light" | "dark"
  className?: string
}) {
  const [branches, setBranches] = useState<StaffBranch[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await loadBranchesOnce()
        if (cancelled || list.length === 0) return
        setBranches(list)
        setSelected(getSelectedBranchId())
      } catch {
        // sin datos no hay rótulo; el panel sigue funcionando igual
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onChange = () => setSelected(getSelectedBranchId())
    window.addEventListener(BRANCH_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(BRANCH_CHANGE_EVENT, onChange)
  }, [])

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selected) || branches[0],
    [branches, selected],
  )

  // Una sola sede (o sin datos): no hay confusión posible, no hay rótulo.
  if (branches.length <= 1 || !selectedBranch) return null

  const skin =
    tone === "dark"
      ? "border-[#f5a623] bg-[#1a1a1a] text-[#f5a623]"
      : "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black"

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border-2 px-3 py-1 ${skin} ${className}`}
    >
      <MapPin size={16} aria-hidden />
      <span className="text-sm font-black uppercase tracking-wide leading-none">
        Sede {selectedBranch.name}
      </span>
    </span>
  )
}
