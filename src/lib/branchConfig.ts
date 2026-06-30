import { getBusinessConfig, getRawBusinessConfig, type BusinessConfig } from "@/lib/orders"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import {
  applyBranchConfigOverrides,
  normalizeBranchConfig,
  normalizeBranchConfigMap,
  type BranchConfig,
} from "@/lib/branchConfigSchema"

const BRANCH_CONFIGS_KEY = "branchConfigs"

function cleanBranchId(value: unknown) {
  return String(value || "").trim()
}

export async function getBranchConfig(branchId: string): Promise<BranchConfig> {
  const cleanId = cleanBranchId(branchId)
  if (!cleanId) return normalizeBranchConfig({})

  const rawBusinessConfig = await getRawBusinessConfig()
  const branchConfigs = normalizeBranchConfigMap(rawBusinessConfig[BRANCH_CONFIGS_KEY])
  return branchConfigs[cleanId] ?? normalizeBranchConfig({})
}

export async function saveBranchConfig(
  branchId: string,
  input: unknown,
): Promise<BranchConfig> {
  const cleanId = cleanBranchId(branchId)
  if (!cleanId) throw new Error("Sucursal inválida")

  const supabase = getSupabaseAdmin()
  const rawBusinessConfig = await getRawBusinessConfig()
  const currentBranchConfigs = normalizeBranchConfigMap(rawBusinessConfig[BRANCH_CONFIGS_KEY])
  const updatedAt = new Date().toISOString()
  const nextBranchConfig = normalizeBranchConfig({
    ...(currentBranchConfigs[cleanId] ?? {}),
    ...(input && typeof input === "object" ? (input as Record<string, unknown>) : {}),
    updatedAt,
  })
  const nextBusinessConfig = {
    ...rawBusinessConfig,
    [BRANCH_CONFIGS_KEY]: {
      ...currentBranchConfigs,
      [cleanId]: nextBranchConfig,
    },
    updatedAt,
  }

  const { error } = await supabase
    .from("business_config")
    .upsert({ id: 1, config: nextBusinessConfig })

  if (error) {
    throw new Error(error.message || "No se pudo guardar la configuración de la sede")
  }

  return nextBranchConfig
}


export async function copyBranchConfig(
  sourceBranchId: string,
  targetBranchId: string,
): Promise<BranchConfig> {
  const cleanSourceId = cleanBranchId(sourceBranchId)
  const cleanTargetId = cleanBranchId(targetBranchId)

  if (!cleanSourceId || !cleanTargetId) throw new Error("Sucursal inválida")
  if (cleanSourceId === cleanTargetId) {
    throw new Error("Elige una sede origen distinta a la sede destino")
  }

  const sourceConfig = await getBranchConfig(cleanSourceId)
  return saveBranchConfig(cleanTargetId, {
    ...sourceConfig,
    updatedAt: undefined,
  })
}

export async function getEffectiveBusinessConfigForBranch(
  branchId?: string | null,
): Promise<BusinessConfig & Record<string, unknown>> {
  const businessConfig = (await getBusinessConfig()) as BusinessConfig & Record<string, unknown>
  const cleanId = cleanBranchId(branchId)
  if (!cleanId) return businessConfig

  const branchConfig = await getBranchConfig(cleanId)
  return applyBranchConfigOverrides(businessConfig, branchConfig, cleanId)
}
