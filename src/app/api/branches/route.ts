import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getRequestAccess } from "@/lib/localAccess"
import {
  filterBranchesForAccess,
  getBranchConfigsFromRawBusinessConfig,
  mergeRawBusinessConfigWithBranchConfig,
} from "@/lib/branch"
import { getRawBusinessConfig, saveBusinessConfig } from "@/lib/orders"

import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function cleanText(v: unknown) {
  return String(v || "").trim()
}

// Listar sucursales: cualquier rol autenticado (para elegir su sucursal).
export async function GET(request: NextRequest) {
  const access = getRequestAccess(request, getRequestPassword(request))
  if (!access.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, is_active, sort_order")
    .order("sort_order", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Anota cada sede con su marca de evento (modo evento) desde business_config.
  const rawBusinessConfig = await getRawBusinessConfig().catch(() => ({}))
  const branchConfigs = getBranchConfigsFromRawBusinessConfig(rawBusinessConfig)
  const branches = (data ?? []).map((branch) => ({
    ...branch,
    isEvent: Boolean(branchConfigs[String(branch.id)]?.isEvent),
  }))

  return NextResponse.json({ ok: true, branches: filterBranchesForAccess(branches, access) })
}

// Crear sucursal: solo dueño.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-branches-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de sucursales. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  const access = getRequestAccess(request, getRequestPassword(request))
  if (!access.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (access.role !== "owner") {
    return NextResponse.json({ error: "Solo el dueño puede crear sucursales" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const name = cleanText(body.name)
  const isEvent = body.isEvent === true
  if (!name) return NextResponse.json({ error: "Indica el nombre de la sucursal" }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { count } = await supabase.from("branches").select("id", { count: "exact", head: true })
  const { data, error } = await supabase
    .from("branches")
    .insert({ name, sort_order: (count ?? 0) + 1, is_active: true })
    .select("id, name, is_active, sort_order")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Modo evento: la sede nueva queda marcada como evento/feria en business_config
  // (sede temporal con QR propio; se finaliza desactivándola).
  if (isEvent && data?.id) {
    const rawBusinessConfig = await getRawBusinessConfig().catch(() => ({}))
    await saveBusinessConfig(
      mergeRawBusinessConfigWithBranchConfig(rawBusinessConfig, String(data.id), {
        isEvent: true,
      }) as never,
    )
  }

  return NextResponse.json({ ok: true, branch: { ...data, isEvent } }, { status: 201 })
}
