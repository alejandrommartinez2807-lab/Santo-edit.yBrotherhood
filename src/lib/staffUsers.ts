import { getRawBusinessConfig, saveBusinessConfig } from "@/lib/ordersBusinessConfig"
import {
  LOCAL_MODULE_KEYS,
  normalizeLocalModuleList,
  type LocalModuleKey,
} from "@/lib/localPlans"
import {
  getAllowedModulesForLocalRole,
  type LocalRole,
} from "@/lib/localAccess"
import {
  createInternalStaffEmail,
  getStaffUsernameFromEmail,
  normalizeStaffUsername,
} from "@/lib/staffIdentity"

export type StaffPermissionsMode = "role" | "custom"

export type StaffUserAccessConfig = {
  id: string
  username: string
  displayName: string
  permissionsMode: StaffPermissionsMode
  allowedModules: LocalModuleKey[]
  allBranches: boolean
  allowedBranchIds: string[]
  lastAccessAt?: string
}

export const STAFF_USERS_CONFIG_KEY = "staffUsers"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function uniqueStrings(values: unknown): string[] {
  const source = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(/[;,|\n]/g)
      : []
  const seen = new Set<string>()
  const result: string[] = []

  source.forEach((item) => {
    const value = cleanText(item)
    if (!value || seen.has(value)) return
    seen.add(value)
    result.push(value)
  })

  return result
}

function readStaffUsersSource(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>)
  return []
}

export function normalizeStaffUserAccessConfig(value: unknown): StaffUserAccessConfig | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const id = cleanText(source.id)
  if (!id) return null

  return {
    id,
    username: normalizeStaffUsername(source.username),
    displayName: cleanText(source.displayName || source.fullName || source.name),
    permissionsMode: source.permissionsMode === "custom" ? "custom" : "role",
    allowedModules: normalizeLocalModuleList(source.allowedModules),
    allBranches: source.allBranches === true,
    allowedBranchIds: uniqueStrings(source.allowedBranchIds || source.branchIds),
    lastAccessAt: source.lastAccessAt ? cleanText(source.lastAccessAt) : undefined,
  }
}

export function normalizeStaffUsersConfig(value: unknown): StaffUserAccessConfig[] {
  const seen = new Set<string>()
  return readStaffUsersSource(value)
    .map(normalizeStaffUserAccessConfig)
    .filter((item): item is StaffUserAccessConfig => Boolean(item))
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
}

export async function getStaffUsersConfig(): Promise<StaffUserAccessConfig[]> {
  const rawConfig = await getRawBusinessConfig()
  return normalizeStaffUsersConfig(rawConfig[STAFF_USERS_CONFIG_KEY])
}

export async function getStaffUserAccessConfig(id: string): Promise<StaffUserAccessConfig | null> {
  const staffUsers = await getStaffUsersConfig()
  return staffUsers.find((item) => item.id === id) || null
}

export async function saveStaffUserAccessConfig(input: StaffUserAccessConfig) {
  const current = await getStaffUsersConfig()
  const next = current.filter((item) => item.id !== input.id)
  next.push(input)
  await saveBusinessConfig({ [STAFF_USERS_CONFIG_KEY]: next } as unknown as never)
  return input
}

export async function removeStaffUserAccessConfig(id: string) {
  const current = await getStaffUsersConfig()
  const next = current.filter((item) => item.id !== id)
  await saveBusinessConfig({ [STAFF_USERS_CONFIG_KEY]: next } as unknown as never)
}

export async function touchStaffLastAccess(id: string) {
  if (!id) return
  try {
    const current = await getStaffUsersConfig()
    const index = current.findIndex((item) => item.id === id)
    if (index < 0) return
    const lastAccessAt = new Date().toISOString()
    current[index] = { ...current[index], lastAccessAt }
    await saveBusinessConfig({ [STAFF_USERS_CONFIG_KEY]: current } as unknown as never)
  } catch {
    // No bloquea el login por una escritura de auditoría blanda.
  }
}

export function createStaffAccessConfig(input: {
  id: string
  email?: string
  username?: unknown
  displayName?: unknown
  role: LocalRole
  permissionsMode?: unknown
  allowedModules?: unknown
  allBranches?: unknown
  allowedBranchIds?: unknown
}): StaffUserAccessConfig {
  const username = normalizeStaffUsername(input.username) || getStaffUsernameFromEmail(input.email)
  const permissionsMode = input.permissionsMode === "custom" ? "custom" : "role"
  const allowedModules = normalizeLocalModuleList(input.allowedModules)
  const roleModules = getAllowedModulesForLocalRole(input.role)

  return {
    id: input.id,
    username,
    displayName: cleanText(input.displayName),
    permissionsMode,
    allowedModules: permissionsMode === "custom" ? allowedModules : roleModules,
    allBranches: input.allBranches === true,
    allowedBranchIds: uniqueStrings(input.allowedBranchIds),
  }
}

export function getEffectiveStaffModules(role: LocalRole, config?: StaffUserAccessConfig | null) {
  if (role === "owner" || role === "support") return LOCAL_MODULE_KEYS
  if (config?.permissionsMode === "custom") return normalizeLocalModuleList(config.allowedModules)
  return getAllowedModulesForLocalRole(role)
}

export function getEffectiveStaffBranchAccess(role: LocalRole, config?: StaffUserAccessConfig | null) {
  if (role === "owner" || role === "support") {
    return { allBranches: true, allowedBranchIds: [] }
  }

  // Compatibilidad: usuarios viejos de Supabase sin config no se bloquean.
  if (!config) {
    return { allBranches: true, allowedBranchIds: [] }
  }

  return {
    allBranches: config.allBranches === true,
    allowedBranchIds: uniqueStrings(config.allowedBranchIds),
  }
}

export function canStaffAccessModule(
  role: LocalRole,
  moduleKey: LocalModuleKey,
  config?: StaffUserAccessConfig | null,
) {
  return getEffectiveStaffModules(role, config).includes(moduleKey)
}

export function canStaffAccessBranch(
  access: {
    allBranches?: boolean
    allowedBranchIds?: string[]
  },
  branchId: string | null | undefined,
) {
  if (!branchId) return true
  if (access.allBranches !== false) return true
  return (access.allowedBranchIds || []).includes(branchId)
}

export function getDisplayUsername(email: unknown, config?: StaffUserAccessConfig | null) {
  return normalizeStaffUsername(config?.username) || getStaffUsernameFromEmail(email)
}

export function getDisplayName(fullName: unknown, config?: StaffUserAccessConfig | null) {
  return cleanText(config?.displayName) || cleanText(fullName)
}

export function getEmailForUsername(username: unknown) {
  return createInternalStaffEmail(username)
}
