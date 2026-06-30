"use client"

import { useEffect, useState } from "react"
import { Building2, Settings } from "lucide-react"
import {
  getSelectedBranchId,
  setSelectedBranchId,
  BRANCH_CHANGE_EVENT,
} from "@/lib/branchClient"

type Branch = { id: string; name: string; is_active?: boolean }

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

function getBranchHeaders(): HeadersInit | undefined {
  if (typeof window === "undefined") return undefined

  try {
    const password = window.sessionStorage.getItem(OWNER_STORAGE_KEY) || ""
    return password ? { "x-admin-password": password } : undefined
  } catch {
    return undefined
  }
}

// Selector flotante de sucursal para el staff. Solo aparece cuando hay más de
// una sucursal activa. Ahora también funciona con el login simple por clave de
// rol porque envía la sesión guardada, además del token Supabase que inyecta
// AuthBridge cuando exista.
export default function BranchSwitcher() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/branches", {
          headers: getBranchHeaders(),
          cache: "no-store",
        })
        if (!res.ok) return // público o sin sesión → no mostramos nada
        const json = await res.json()
        const list: Branch[] = (json.branches || []).filter((b: Branch) => b.is_active !== false)
        if (cancelled || list.length <= 1) return

        setBranches(list)
        const current = getSelectedBranchId()
        const valid = current && list.some((b) => b.id === current)
        const initial = valid ? current! : list[0].id
        if (!valid) setSelectedBranchId(initial) // fija la primera por defecto (sin recargar)
        setSelected(initial)
      } catch {
        /* sin red: no mostramos selector */
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

  if (branches.length <= 1) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-[calc(100vw-2rem)] rounded-[1.2rem] border-2 border-white/60 bg-[var(--brand-primary)] p-2 text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] sm:bottom-auto sm:top-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
          <Building2 size={18} />
        </span>
        <label className="min-w-0">
          <span className="block text-[0.55rem] font-black uppercase tracking-[0.16em] text-white/75">
            Sede activa
          </span>
          <select
            aria-label="Sucursal"
            value={selected ?? ""}
            onChange={(e) => {
              const id = e.target.value
              setSelectedBranchId(id)
              window.location.reload()
            }}
            className="max-w-[52vw] bg-transparent text-sm font-black uppercase outline-none sm:max-w-[220px]"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="text-zinc-900">
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/local-santo/sucursales"
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          title="Gestionar sedes"
        >
          <Settings size={17} />
        </button>
      </div>
    </div>
  )
}
