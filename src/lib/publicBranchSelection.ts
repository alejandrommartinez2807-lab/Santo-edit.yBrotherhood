// Selección de sede en el flujo público del cliente. La regla acordada
// (Fase 3 del plan de sedes) es que con varias sedes el cliente debe elegir
// una explícitamente antes de ver mesas o registrar pedidos; solo se
// auto-selecciona cuando hay una única sede o cuando ya hay una preferencia
// válida (URL ?branch o la sede guardada en este dispositivo).

export type PublicBranchOption = {
  id: string
  isActive?: boolean
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

export function getActivePublicBranches<T extends PublicBranchOption>(
  branches: unknown,
): T[] {
  if (!Array.isArray(branches)) return []
  return branches.filter(
    (branch): branch is T =>
      Boolean(branch) &&
      typeof branch === "object" &&
      cleanText((branch as PublicBranchOption).id).length > 0 &&
      (branch as PublicBranchOption).isActive !== false,
  )
}

// Devuelve la sede que debe quedar seleccionada al cargar, o "" si el
// cliente todavía tiene que elegir (varias sedes sin preferencia previa).
export function resolvePreferredPublicBranchId(
  branches: PublicBranchOption[],
  candidates: Array<string | null | undefined>,
): string {
  const active = getActivePublicBranches(branches)

  const preferred = candidates
    .map(cleanText)
    .filter(Boolean)
    .find((candidate) => active.some((branch) => branch.id === candidate))

  if (preferred) return preferred
  if (active.length === 1) return active[0].id
  return ""
}
