import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getRequestAccess } from "@/lib/localAccess"
import { getBranchConfigsFromRawBusinessConfig } from "@/lib/branch"
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

function requireOwner(request: NextRequest) {
  const access = getRequestAccess(request, getRequestPassword(request))
  if (!access.ok) return { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  if (access.role !== "owner") {
    return { ok: false as const, response: NextResponse.json({ error: "Solo el dueño puede gestionar sucursales" }, { status: 403 }) }
  }
  return { ok: true as const, response: null }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-branches-patch",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de sucursales. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  const auth = requireOwner(request)
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = cleanText(body.name)
  if (body.is_active !== undefined) patch.is_active = body.is_active === true

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("branches")
    .update(patch)
    .eq("id", id)
    .select("id, name, is_active, sort_order")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, branch: data })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-branches-delete",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 128_000,
    rateLimitMessage: "Demasiados cambios de sucursales. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  const auth = requireOwner(request)
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const supabase = getSupabaseAdmin()

  const { count } = await supabase.from("branches").select("id", { count: "exact", head: true })
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: "Debe quedar al menos una sucursal" }, { status: 400 })
  }

  // ON DELETE CASCADE borra los datos de esa sucursal. Confirmación en el panel.
  const { error } = await supabase.from("branches").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sin la sede, su override en business_config (marca de evento, textos, mesas)
  // quedaría huérfano; se limpia aquí. Si falla no bloquea el borrado.
  try {
    const rawBusinessConfig = await getRawBusinessConfig()
    const branchConfigs = getBranchConfigsFromRawBusinessConfig(rawBusinessConfig)
    const branchKey = cleanText(id)
    if (branchKey in branchConfigs) {
      delete branchConfigs[branchKey]
      await saveBusinessConfig({ ...rawBusinessConfig, branchConfigs } as never)
    }
  } catch {
    /* limpieza best-effort */
  }

  return NextResponse.json({ ok: true })
}
