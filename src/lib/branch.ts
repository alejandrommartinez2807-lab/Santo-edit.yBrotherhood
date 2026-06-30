import { getSupabaseAdmin } from "@/lib/supabaseServer"

// Resolución de la sucursal "actual" de una petición. El cliente envía la
// sucursal elegida en el header x-branch-id; si no, se usa la primera activa.
// Toda la operación (pedidos, inventario, caja) se filtra por esta sucursal.

let cachedDefaultId: string | null = null

export async function getDefaultBranchId(): Promise<string | null> {
  if (cachedDefaultId) return cachedDefaultId
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from("branches")
    .select("id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()
  cachedDefaultId = (data as { id?: string } | null)?.id ?? null
  return cachedDefaultId
}

type HeaderBag = { headers: { get(name: string): string | null } }

export async function resolveBranchId(request: HeaderBag): Promise<string | null> {
  const fromHeader = (request.headers.get("x-branch-id") || "").trim()
  if (fromHeader) return fromHeader
  return getDefaultBranchId()
}
