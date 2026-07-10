import { getSupabaseAdmin } from "@/lib/supabaseServer"

// Resolución de la sucursal "actual" de una petición. El cliente envía la
// sucursal elegida en el header x-branch-id; si no, se usa la primera activa.
// Toda la operación (pedidos, inventario, caja) se filtra por esta sucursal.

let cachedDefaultId: string | null = null

export type BranchRecord = {
  id: string
  name: string
  is_active?: boolean | null
  isActive?: boolean | null
  sort_order?: number | null
  sortOrder?: number | null
  [key: string]: unknown
}

type HeaderBag = { headers: { get(name: string): string | null } }
type UnknownRecord = Record<string, unknown>

type AccessLike = {
  ok?: boolean
  role?: string | null
  branchId?: unknown
  branchIds?: unknown
  allowedBranchId?: unknown
  allowedBranchIds?: unknown
  allowedBranches?: unknown
  staff?: {
    branchId?: unknown
    branchIds?: unknown
    allowedBranchId?: unknown
    allowedBranchIds?: unknown
    allowedBranches?: unknown
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? { ...value } : {}
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function normalizeBranchKey(branchId: string | null | undefined) {
  return cleanText(branchId)
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "si", "sí", "active", "activo"].includes(normalized)) {
      return true
    }
    if (["false", "0", "no", "inactive", "inactivo"].includes(normalized)) {
      return false
    }
  }
  return fallback
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeBranchRecord(value: unknown): BranchRecord | null {
  if (!isRecord(value)) return null

  const id = cleanText(value.id)
  if (!id) return null

  return {
    ...value,
    id,
    name: cleanText(value.name) || "Sucursal",
    is_active: normalizeBoolean(value.is_active ?? value.isActive, true),
    sort_order: normalizeNumber(value.sort_order ?? value.sortOrder, 0),
  }
}

function normalizeBranchList(branches: unknown): BranchRecord[] {
  if (!Array.isArray(branches)) return []

  return branches
    .map(normalizeBranchRecord)
    .filter((branch): branch is BranchRecord => Boolean(branch))
    .sort((a, b) => {
      const sortA = normalizeNumber(a.sort_order ?? a.sortOrder, 0)
      const sortB = normalizeNumber(b.sort_order ?? b.sortOrder, 0)
      if (sortA !== sortB) return sortA - sortB
      return String(a.name).localeCompare(String(b.name))
    })
}

function collectBranchIdsFromUnknown(value: unknown, target: Set<string>) {
  if (typeof value === "string" || typeof value === "number") {
    const id = cleanText(value)
    if (id) target.add(id)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectBranchIdsFromUnknown(item, target))
    return
  }

  if (!isRecord(value)) return

  collectBranchIdsFromUnknown(value.id, target)
  collectBranchIdsFromUnknown(value.branchId, target)
  collectBranchIdsFromUnknown(value.branch_id, target)
}

function getAllowedBranchIds(access: AccessLike | null | undefined) {
  const ids = new Set<string>()
  if (!access || access.role === "owner" || access.role === "support") return ids

  collectBranchIdsFromUnknown(access.branchId, ids)
  collectBranchIdsFromUnknown(access.branchIds, ids)
  collectBranchIdsFromUnknown(access.allowedBranchId, ids)
  collectBranchIdsFromUnknown(access.allowedBranchIds, ids)
  collectBranchIdsFromUnknown(access.allowedBranches, ids)
  collectBranchIdsFromUnknown(access.staff?.branchId, ids)
  collectBranchIdsFromUnknown(access.staff?.branchIds, ids)
  collectBranchIdsFromUnknown(access.staff?.allowedBranchId, ids)
  collectBranchIdsFromUnknown(access.staff?.allowedBranchIds, ids)
  collectBranchIdsFromUnknown(access.staff?.allowedBranches, ids)

  return ids
}

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

export async function resolveBranchId(request: HeaderBag): Promise<string | null> {
  // Acceso por sede del staff (null en modo contraseña/.env = sin restricción).
  const staffAccess = getStaffBranchAccessFromRequest(request)
  const requested = getExplicitBranchIdFromRequest(request)

  if (requested) {
    // Un usuario restringido que pida una sede que NO es suya se "clampa" a su
    // primera sede permitida: nunca opera ni lee datos de otra sucursal, aunque
    // manipule el header x-branch-id. owner/support (unrestricted) pasan igual.
    if (isBranchAllowedForStaffAccess(requested, staffAccess)) return requested
    if (staffAccess && !staffAccess.unrestricted && staffAccess.branchIds.length) {
      return staffAccess.branchIds[0]
    }
    return requested
  }

  // Sin sede explícita: el staff restringido cae a su primera sede asignada.
  if (staffAccess && !staffAccess.unrestricted && staffAccess.branchIds.length) {
    return staffAccess.branchIds[0]
  }
  return getDefaultBranchId()
}

type ScopeRequest = HeaderBag & {
  url?: string
  nextUrl?: { searchParams: { get(name: string): string | null } }
}

function wantsConsolidatedScope(request: ScopeRequest): boolean {
  const fromNextUrl = request.nextUrl?.searchParams?.get("scope")
  if (fromNextUrl) return fromNextUrl === "all"
  if (request.url) {
    try {
      return new URL(request.url).searchParams.get("scope") === "all"
    } catch {
      return false
    }
  }
  return false
}

// Igual que resolveBranchId, pero devuelve null (todas las sedes) cuando se pide
// ?scope=all y el rol puede consolidar (dueño/soporte). Mismo criterio que usa
// /api/reports; el resto de roles siempre queda acotado a su sede.
export async function resolveScopedBranchId(
  request: ScopeRequest,
  role?: string | null,
): Promise<string | null> {
  const privileged = role === "owner" || role === "support"
  if (privileged && wantsConsolidatedScope(request)) return null
  return resolveBranchId(request)
}

export function getExplicitBranchIdFromRequest(request: HeaderBag): string | null {
  const headers = request.headers
  const fromHeader = cleanText(
    headers.get("x-branch-id") ||
      headers.get("x-santo-branch-id") ||
      headers.get("x-current-branch-id"),
  )

  if (fromHeader) return fromHeader

  const rawUrl = cleanText(headers.get("referer") || headers.get("referrer"))
  if (!rawUrl) return null

  try {
    const url = new URL(rawUrl)
    return (
      cleanText(url.searchParams.get("branchId")) ||
      cleanText(url.searchParams.get("branch")) ||
      cleanText(url.searchParams.get("sede")) ||
      null
    )
  } catch {
    return null
  }
}

export function getActiveBranches(branches: unknown[]): BranchRecord[]
export function getActiveBranches(): Promise<BranchRecord[]>
export function getActiveBranches(branches?: unknown[]): BranchRecord[] | Promise<BranchRecord[]> {
  if (Array.isArray(branches)) {
    return normalizeBranchList(branches).filter((branch) =>
      normalizeBoolean(branch.is_active ?? branch.isActive, true),
    )
  }

  return (async () => {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (error) throw new Error(error.message || "No se pudieron cargar las sucursales")
    return normalizeBranchList(data ?? [])
  })()
}

export function getBranchById(branches: unknown[], branchId: string | null | undefined): BranchRecord | null
export function getBranchById(branchId: string | null | undefined): Promise<BranchRecord | null>
export function getBranchById(
  branchesOrId: unknown[] | string | null | undefined,
  maybeBranchId?: string | null | undefined,
): BranchRecord | null | Promise<BranchRecord | null> {
  if (Array.isArray(branchesOrId)) {
    const branchId = normalizeBranchKey(maybeBranchId)
    if (!branchId) return null
    return normalizeBranchList(branchesOrId).find((branch) => branch.id === branchId) || null
  }

  const branchId = normalizeBranchKey(branchesOrId)
  if (!branchId) return Promise.resolve(null)

  return (async () => {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, is_active, sort_order")
      .eq("id", branchId)
      .maybeSingle()

    if (error) throw new Error(error.message || "No se pudo cargar la sucursal")
    return normalizeBranchRecord(data)
  })()
}

export function filterBranchesForAccess<T extends { id?: unknown }>(
  branches: T[],
  access: AccessLike | null | undefined,
): T[] {
  if (!Array.isArray(branches)) return []
  if (!access || access.role === "owner" || access.role === "support") return branches

  const allowedBranchIds = getAllowedBranchIds(access)
  if (allowedBranchIds.size === 0) return branches

  return branches.filter((branch) => allowedBranchIds.has(cleanText(branch.id)))
}

// Acceso por sede del staff, derivado de los headers x-staff-role y
// x-staff-branch-ids. owner/support y los usuarios sin asignación ven todo
// (unrestricted); el resto queda limitado a sus sedes asignadas.
export type StaffBranchAccess = {
  role: string
  unrestricted: boolean
  branchIds: string[]
}

export function getStaffBranchAccessFromRequest(request: HeaderBag): StaffBranchAccess | null {
  const headers = request.headers
  const role = cleanText(headers.get("x-staff-role")).toLowerCase()
  if (!role) return null

  const branchIds = cleanText(headers.get("x-staff-branch-ids"))
    .split(/[,;|]/g)
    .map((id) => cleanText(id))
    .filter(Boolean)

  const privilegedRole = role === "owner" || role === "support"

  return {
    role,
    branchIds,
    unrestricted: privilegedRole || branchIds.length === 0,
  }
}

export function filterBranchesForStaffAccess<T extends { id?: unknown }>(
  branches: T[],
  access: StaffBranchAccess | null | undefined,
): T[] {
  if (!Array.isArray(branches)) return []
  if (!access || access.unrestricted) return branches

  const allowed = new Set(access.branchIds)
  return branches.filter((branch) => allowed.has(cleanText(branch.id)))
}

export function isBranchAllowedForStaffAccess(
  branchId: string | null | undefined,
  access: StaffBranchAccess | null | undefined,
): boolean {
  if (!access || access.unrestricted) return true
  return access.branchIds.includes(cleanText(branchId))
}

export type BranchScopedTable = { name: string; area?: string }

export type BranchScopedConfig = {
  publicName?: string
  address?: string
  zone?: string
  estimatedTimeText?: string
  mainWhatsapp?: string
  deliveryWhatsapp?: string
  ordersPaused?: boolean
  temporarilyClosed?: boolean
  // Sede temporal creada como evento/feria (modo evento): tiene su propio QR
  // y se finaliza desactivando la sede, conservando sus ventas y cierres.
  isEvent?: boolean
  localTables?: BranchScopedTable[]
  // Tasa propia de la sede: pisa el modo/valor global solo para esta sucursal.
  // Ausente = hereda lo definido en Configuración → "Tasa y moneda".
  exchangeRateMode?: "automatic" | "manual"
  manualExchangeRate?: number
  [key: string]: unknown
}

const BRANCH_SCOPED_TEXT_FIELDS = [
  "publicName",
  "address",
  "zone",
  "estimatedTimeText",
  "mainWhatsapp",
  "deliveryWhatsapp",
] as const

const BRANCH_SCOPED_BOOLEAN_FIELDS = ["ordersPaused", "temporarilyClosed", "isEvent"] as const

function normalizeBranchScopedTables(value: unknown): BranchScopedTable[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/g)
      : []

  return rawList
    .map((rawTable): BranchScopedTable | null => {
      if (isRecord(rawTable)) {
        const name = cleanText(rawTable.name)
        if (!name) return null
        const area = cleanText(rawTable.area)
        return area ? { name, area } : { name }
      }

      const [namePart, areaPart] = String(rawTable || "").split("|")
      const name = cleanText(namePart)
      if (!name) return null
      const area = cleanText(areaPart)
      return area ? { name, area } : { name }
    })
    .filter((table): table is BranchScopedTable => Boolean(table))
}

// Normaliza la configuración pública de una sede a un objeto disperso: solo
// incluye los campos presentes en la entrada (sin anidar el mapa completo de
// sedes ni datos internos del personal), de modo que copiar/mezclar sea exacto.
export function normalizeBranchScopedConfig(branchConfig: unknown): BranchScopedConfig {
  const source = toRecord(branchConfig)
  const config: BranchScopedConfig = {}

  for (const field of BRANCH_SCOPED_TEXT_FIELDS) {
    if (field in source) config[field] = cleanText(source[field])
  }

  for (const field of BRANCH_SCOPED_BOOLEAN_FIELDS) {
    if (field in source) config[field] = normalizeBoolean(source[field], false)
  }

  if ("localTables" in source) {
    config.localTables = normalizeBranchScopedTables(source.localTables)
  }

  if ("exchangeRateMode" in source) {
    const mode = cleanText(source.exchangeRateMode).toLowerCase()
    if (mode === "automatic" || mode === "manual") config.exchangeRateMode = mode
  }

  if ("manualExchangeRate" in source) {
    const rate = Number(source.manualExchangeRate)
    if (Number.isFinite(rate) && rate > 0) config.manualExchangeRate = rate
  }

  return config
}

export function getBranchConfigsFromRawBusinessConfig(
  rawBusinessConfig: unknown,
): Record<string, UnknownRecord> {
  const raw = toRecord(rawBusinessConfig)
  const branchConfigsSource = raw.branchConfigs

  if (!isRecord(branchConfigsSource)) return {}

  return Object.entries(branchConfigsSource).reduce<Record<string, UnknownRecord>>(
    (branchConfigs, [branchId, branchConfig]) => {
      const normalizedBranchId = normalizeBranchKey(branchId)
      if (!normalizedBranchId) return branchConfigs

      branchConfigs[normalizedBranchId] = normalizeBranchScopedConfig(branchConfig)
      return branchConfigs
    },
    {},
  )
}

export function getBranchConfigFromRawBusinessConfig(
  rawBusinessConfig: unknown,
  branchId: string | null | undefined,
): UnknownRecord {
  const normalizedBranchId = normalizeBranchKey(branchId)
  if (!normalizedBranchId) return {}

  return getBranchConfigsFromRawBusinessConfig(rawBusinessConfig)[normalizedBranchId] || {}
}

export function getBranchConfig(
  rawBusinessConfig: unknown,
  branchId: string | null | undefined,
): UnknownRecord {
  return getBranchConfigFromRawBusinessConfig(rawBusinessConfig, branchId)
}

// Mezcla un override de configuración sobre la sede indicada, preservando la
// configuración de las demás sedes. Un campo enviado como null elimina ese
// override de la sede (p. ej. localTables: null vuelve a las mesas globales,
// porque la ausencia de la clave es lo que significa "usar lo global").
export function mergeRawBusinessConfigWithBranchConfig(
  rawBusinessConfig: unknown,
  branchId: string | null | undefined,
  branchConfig: unknown,
): UnknownRecord {
  const raw = toRecord(rawBusinessConfig)
  const normalizedBranchId = normalizeBranchKey(branchId)
  if (!normalizedBranchId) return raw

  const branchConfigs = getBranchConfigsFromRawBusinessConfig(raw)
  const previousBranchConfig = branchConfigs[normalizedBranchId] || {}
  const mergedConfig: UnknownRecord = {
    ...previousBranchConfig,
    ...toRecord(branchConfig),
  }

  for (const key of Object.keys(mergedConfig)) {
    if (mergedConfig[key] === null) delete mergedConfig[key]
  }

  return {
    ...raw,
    branchConfigs: {
      ...branchConfigs,
      [normalizedBranchId]: normalizeBranchScopedConfig(mergedConfig),
    },
  }
}

// Copia la configuración de la sede origen a la sede destino.
export function copyBranchConfigInRawBusinessConfig(
  rawBusinessConfig: unknown,
  sourceBranchId: string | null | undefined,
  targetBranchId: string | null | undefined,
): UnknownRecord {
  const raw = toRecord(rawBusinessConfig)
  const sourceId = normalizeBranchKey(sourceBranchId)
  const targetId = normalizeBranchKey(targetBranchId)

  if (!sourceId || !targetId) return raw

  const branchConfigs = getBranchConfigsFromRawBusinessConfig(raw)
  const sourceConfig = branchConfigs[sourceId] || {}

  return {
    ...raw,
    branchConfigs: {
      ...branchConfigs,
      [targetId]: normalizeBranchScopedConfig({ ...sourceConfig }),
    },
  }
}

export function buildSafePublicBranch(
  branch: unknown,
  rawBusinessConfig?: unknown,
): UnknownRecord | null {
  const normalizedBranch = normalizeBranchRecord(branch)
  if (!normalizedBranch) return null

  const branchConfig = normalizeBranchScopedConfig(
    getBranchConfigFromRawBusinessConfig(rawBusinessConfig, normalizedBranch.id),
  )

  return {
    id: normalizedBranch.id,
    name: cleanText(branchConfig.publicName) || normalizedBranch.name,
    isActive: normalizeBoolean(normalizedBranch.is_active ?? normalizedBranch.isActive, true),
    sortOrder: normalizeNumber(normalizedBranch.sort_order ?? normalizedBranch.sortOrder, 0),
    publicName: branchConfig.publicName,
    address: branchConfig.address,
    zone: branchConfig.zone,
    estimatedTimeText: branchConfig.estimatedTimeText,
    mainWhatsapp: branchConfig.mainWhatsapp,
    config: branchConfig,
    branchConfig,
  }
}

export function buildSafePublicBranches(
  branches: unknown[],
  rawBusinessConfig?: unknown,
): UnknownRecord[] {
  return normalizeBranchList(branches)
    .filter((branch) => normalizeBoolean(branch.is_active ?? branch.isActive, true))
    .map((branch) => buildSafePublicBranch(branch, rawBusinessConfig))
    .filter((branch): branch is UnknownRecord => Boolean(branch))
}
