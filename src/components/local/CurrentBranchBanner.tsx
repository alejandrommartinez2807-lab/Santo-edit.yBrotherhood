"use client"

import { useEffect, useMemo, useState } from "react"
import { MapPin } from "lucide-react"
import {
  fetchActiveBranches,
  getSelectedBranchId,
  setSelectedBranchId,
  BRANCH_CHANGE_EVENT,
  type StaffBranch as Branch,
} from "@/lib/branchClient"

// Banner de sede dentro del panel. Deja clarísimo en qué sucursal está
// trabajando el usuario (todos los pedidos y datos que ve son de esta sede).
// Si tiene más de una sede permitida, puede cambiarla aquí mismo.
export default function CurrentBranchBanner() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await fetchActiveBranches()
      if (cancelled || list.length === 0) return

      setBranches(list)
      const current = getSelectedBranchId()
      const valid = current && list.some((b) => b.id === current)
      const initial = valid ? current! : list[0].id
      if (!valid) setSelectedBranchId(initial)
      setSelected(initial)
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

  if (branches.length === 0 || !selectedBranch) return null

  const multiBranch = branches.length > 1

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-[var(--brand-ink)]">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]">
        <MapPin size={18} />
      </span>
      <div className="flex flex-col">
        <span className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          Estás viendo la sede
        </span>
        {multiBranch ? (
          <select
            aria-label="Sucursal actual"
            value={selected ?? selectedBranch.id}
            onChange={(e) => {
              setSelectedBranchId(e.target.value)
              window.location.reload()
            }}
            className="mt-0.5 cursor-pointer rounded-lg border-2 border-[var(--brand-primary)] bg-white px-2 py-1 text-base font-black uppercase text-[var(--brand-primary)] outline-none"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xl font-black uppercase leading-tight text-[var(--brand-primary)]">
            {selectedBranch.name}
          </span>
        )}
      </div>
      <span className="ml-auto max-w-[15rem] text-right text-[0.68rem] font-bold leading-tight text-[var(--brand-ink)]/80">
        {multiBranch
          ? "Todos los pedidos y datos de abajo son solo de esta sede. Cambia arriba para ver otra."
          : "Todos los pedidos y datos de abajo son de esta sede."}
      </span>
    </div>
  )
}
