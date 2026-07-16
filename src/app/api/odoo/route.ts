import { NextRequest, NextResponse } from "next/server"
import { getOdooIntegration, saveOdooIntegration, updateOdooConnectionState } from "@/lib/orders"
import { odooAuthenticate } from "@/lib/odooClient"
import { runOdooSync } from "@/lib/odooSyncEngine"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkOdooAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

/** La conexión SIN la API key (no se devuelve el secreto en claro). */
function publicView(integration: Awaited<ReturnType<typeof getOdooIntegration>>) {
  if (!integration) {
    return { configured: false, baseUrl: "", dbName: "", login: "", active: false, liveSync: false, hasApiKey: false, lastUid: null, lastSyncAt: "", lastResult: "" }
  }
  return {
    configured: true,
    baseUrl: integration.baseUrl,
    dbName: integration.dbName,
    login: integration.login,
    active: integration.active,
    liveSync: integration.liveSync,
    hasApiKey: Boolean(integration.apiKey),
    lastUid: integration.lastUid,
    lastSyncAt: integration.lastSyncAt,
    lastResult: integration.lastResult,
  }
}

// GET: estado de la conexión (sin la API key).
export async function GET(request: NextRequest) {
  try {
    const access = await checkOdooAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const integration = await getOdooIntegration(branchId)
    return NextResponse.json({ ok: true, integration: publicView(integration) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la conexión con Odoo" },
      { status: 500 },
    )
  }
}

// POST: saveConfig | testConnection
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-odoo-post",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 200_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkOdooAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action)

    if (action === "saveConfig") {
      const baseUrl = cleanText(body.baseUrl)
      if (!baseUrl) return NextResponse.json({ error: "Indica la URL de Odoo" }, { status: 400 })
      const integration = await saveOdooIntegration(
        {
          baseUrl,
          dbName: cleanText(body.dbName),
          login: cleanText(body.login),
          apiKey: cleanText(body.apiKey), // vacío ⇒ conserva la guardada
          active: body.active !== false,
          liveSync: body.liveSync === true,
        },
        branchId,
      )
      return NextResponse.json({ ok: true, integration: publicView(integration) }, { status: 201 })
    }

    if (action === "testConnection") {
      // Prueba lo que el usuario tenga en pantalla; si no reenvió la API key,
      // usa la guardada (para no obligar a re-teclear el secreto).
      const saved = await getOdooIntegration(branchId)
      const conn = {
        baseUrl: cleanText(body.baseUrl) || saved?.baseUrl || "",
        dbName: cleanText(body.dbName) || saved?.dbName || "",
        login: cleanText(body.login) || saved?.login || "",
        apiKey: cleanText(body.apiKey) || saved?.apiKey || "",
      }
      const result = await odooAuthenticate(conn)
      if (saved) {
        await updateOdooConnectionState(branchId, {
          lastUid: result.ok ? result.uid : null,
          lastResult: result.ok ? `Conectado como uid ${result.uid}` : result.error,
        }).catch(() => {})
      }
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
      return NextResponse.json({ ok: true, uid: result.uid, message: `Conectado como uid ${result.uid}` })
    }

    if (action === "sync") {
      const report = await runOdooSync(branchId, { dryRun: body.dryRun !== false })
      // dryRun por defecto: solo se escribe en Odoo si el cliente pide dryRun:false.
      return NextResponse.json({ ok: report.ok, report }, { status: report.ok ? 200 : 200 })
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar la conexión con Odoo" },
      { status: 500 },
    )
  }
}
