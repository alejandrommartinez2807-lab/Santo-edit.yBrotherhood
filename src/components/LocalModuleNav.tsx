"use client"

// Barra de navegación del staff: muestra SOLO los módulos que la clave activa
// tiene permitidos (navModules calculado en el backend), para moverse entre
// módulos en la misma pestaña sin volver a iniciar sesión. El dueño ve todo
// más el acceso rápido al panel general.

import { useState } from "react"
import { ChevronDown, LayoutGrid, MapPin } from "lucide-react"
import type { StaffBranch } from "@/lib/branchClient"

export type LocalNavModuleKey = string

type NavEntry = {
  key: LocalNavModuleKey
  label: string
  href: string
}

// Solo módulos con página propia. El orden es el orden de la barra:
// operación diaria primero, administración después.
const NAV_ENTRIES: NavEntry[] = [
  { key: "cashier", label: "Caja", href: "/local-santo/caja" },
  { key: "kitchen", label: "Cocina", href: "/local-santo/cocina" },
  { key: "openAccounts", label: "Mesonero", href: "/local-santo/mesonero" },
  { key: "tables", label: "Mesas y QR", href: "/local-santo/mesas" },
  { key: "reservations", label: "Reservas", href: "/local-santo/reservas" },
  { key: "delivery", label: "Delivery", href: "/local-santo/delivery" },
  { key: "paymentProofs", label: "Comprobantes", href: "/local-santo/comprobantes" },
  { key: "tickets", label: "Tickets", href: "/local-santo/tickets" },
  { key: "kitchenItems", label: "Cocina por producto", href: "/local-santo/cocina-productos" },
  { key: "inventory", label: "Inventario", href: "/local-santo/inventario" },
  { key: "inventoryAlerts", label: "Alertas", href: "/local-santo/inventario-alertas" },
  { key: "subrecipes", label: "Subrecetas", href: "/local-santo/subrecetas" },
  { key: "expenses", label: "Control de gastos", href: "/local-santo/control-gastos" },
  { key: "suppliers", label: "Proveedores", href: "/local-santo/proveedores" },
  { key: "supplierPurchases", label: "Compras", href: "/local-santo/compras" },
  { key: "accountsPayable", label: "Cuentas por pagar", href: "/local-santo/cuentas-por-pagar" },
  { key: "customers", label: "Clientes", href: "/local-santo/clientes" },
  { key: "history", label: "Cierres", href: "/local-santo/cierres" },
  { key: "reports", label: "Reportes", href: "/local-santo/reportes" },
  { key: "menuProducts", label: "Menú", href: "/local-santo/menu" },
  { key: "advancedMenu", label: "Menú avanzado", href: "/local-santo/menu-avanzado" },
  { key: "ownerDashboard", label: "Dueño", href: "/local-santo/dueno" },
  { key: "roles", label: "Usuarios", href: "/local-santo/usuarios" },
  { key: "branches", label: "Sucursales", href: "/local-santo/sucursales" },
  { key: "auditLog", label: "Auditoría", href: "/local-santo/auditoria" },
  { key: "settings", label: "Configuración", href: "/local-santo/configuracion" },
  { key: "support", label: "Soporte", href: "/local-santo/soporte" },
]

export default function LocalModuleNav({
  currentModuleKey,
  allowedModules,
  roleLabel,
  displayName,
  branches = [],
  selectedBranchId = null,
  onSelectBranch,
}: {
  currentModuleKey: string
  allowedModules: string[]
  roleLabel: string
  displayName?: string
  branches?: StaffBranch[]
  selectedBranchId?: string | null
  onSelectBranch?: (branchId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const allowed = new Set(allowedModules)
  const entries = NAV_ENTRIES.filter((entry) => allowed.has(entry.key))
  const showPanelLink = allowed.has("mainPanel")

  const selectedBranch =
    branches.find((branch) => branch.id === selectedBranchId) || null

  // Sin módulos a los que moverse ni sede que mostrar, la barra sobra.
  if (entries.length <= 1 && !showPanelLink && branches.length === 0) return null

  const currentEntry = entries.find((entry) => entry.key === currentModuleKey)

  return (
    <nav className="sticky top-0 z-40 border-b-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]/95 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] sm:hidden"
        >
          <LayoutGrid size={14} />
          {currentEntry?.label || "Módulos"}
          <ChevronDown
            size={14}
            className={expanded ? "rotate-180 transition" : "transition"}
          />
        </button>

        <div
          className={`${expanded ? "flex" : "hidden"} w-full flex-wrap items-center gap-1.5 sm:flex sm:w-auto sm:flex-1`}
        >
          {showPanelLink ? (
            <a
              href="/local-santo"
              className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)] bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
            >
              <LayoutGrid size={13} />
              Panel
            </a>
          ) : null}

          {entries.map((entry) => {
            const isCurrent = entry.key === currentModuleKey
            return (
              <a
                key={entry.key}
                href={entry.href}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "inline-flex items-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-white"
                    : "inline-flex items-center rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                }
              >
                {entry.label}
              </a>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {branches.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-white">
              <MapPin size={13} />
              {branches.length > 1 && onSelectBranch ? (
                <select
                  aria-label="Sede actual"
                  value={selectedBranch?.id || ""}
                  onChange={(event) => onSelectBranch(event.target.value)}
                  className="cursor-pointer border-none bg-transparent font-black uppercase text-white outline-none"
                >
                  {!selectedBranch ? <option value="">Elegir sede</option> : null}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id} className="text-[var(--brand-ink)]">
                      {branch.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{selectedBranch?.name || branches[0]?.name}</span>
              )}
            </span>
          ) : null}

          {roleLabel ? (
            <span className="hidden text-[0.6rem] font-black uppercase tracking-[0.14em] text-[var(--brand-ink)]/55 sm:inline">
              {displayName ? `${displayName} · ` : ""}
              {roleLabel}
            </span>
          ) : null}
        </div>
      </div>
    </nav>
  )
}
