"use client"

import { useEffect, useMemo, useState } from "react"
import {
  fetchActiveBranches,
  getSelectedBranchId,
  setSelectedBranchId,
  BRANCH_CHANGE_EVENT,
  type StaffBranch as Branch,
} from "@/lib/branchClient"

// Selector flotante de sucursal para el staff. Fase 7: /api/branches ya
// devuelve solo las sedes permitidas para el usuario. Si solo tiene una sede,
// no puede cambiarla y se muestra claramente "Trabajando en".
export default function BranchSwitcher() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  // SOLO en el panel privado (pedido del dueño 2026-07-21): en la página
  // pública este flotante tapaba el carrito y confundía al cliente (aparecía
  // en teléfonos con sesión de staff). En /local-santo/* tampoco va porque
  // la barra de módulos ya muestra y cambia la sede.
  const [hidden] = useState(() => {
    if (typeof window === "undefined") return true
    const path = window.location.pathname
    return path !== "/pedidos" && !path.startsWith("/pedidos/")
  })

  useEffect(() => {
    if (hidden) return
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
  }, [hidden])

  useEffect(() => {
    const onChange = () => setSelected(getSelectedBranchId())
    window.addEventListener(BRANCH_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(BRANCH_CHANGE_EVENT, onChange)
  }, [])

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selected) || branches[0],
    [branches, selected],
  )

  if (hidden || branches.length === 0 || !selectedBranch) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "var(--brand-primary)",
        color: "white",
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span aria-hidden style={{ opacity: 0.85 }}>🏢</span>
      {branches.length <= 1 ? (
        <span style={{ fontWeight: 800 }}>Trabajando en: {selectedBranch.name}</span>
      ) : (
        <>
          <span style={{ opacity: 0.9 }}>Sede</span>
          <select
            aria-label="Sucursal"
            value={selected ?? selectedBranch.id}
            onChange={(e) => {
              const id = e.target.value
              setSelectedBranchId(id)
              window.location.reload()
            }}
            style={{
              background: "transparent",
              color: "white",
              border: "none",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id} style={{ color: "#222" }}>
                {b.name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}
