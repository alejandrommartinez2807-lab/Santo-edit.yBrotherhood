import { NextRequest, NextResponse } from "next/server"
import { deleteWebhook, getWebhooks, saveWebhook } from "@/lib/orders"
import { isValidWebhookUrl, parseWebhookEvents } from "@/lib/hotelWebhooks"
import { fireWebhookTest } from "@/lib/hotelWebhookDispatch"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkWebhooksAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkWebhooksAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const webhooks = await getWebhooks(branchId)
    return NextResponse.json({ ok: true, webhooks })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los webhooks" },
      { status: 500 },
    )
  }
}

// POST: save | delete | test
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-webhooks-post",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 100_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkWebhooksAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action) || "save"

    if (action === "save") {
      const url = cleanText(body.url)
      if (!isValidWebhookUrl(url)) {
        return NextResponse.json({ error: "La URL debe ser http(s) completa, ej. https://…" }, { status: 400 })
      }
      const webhook = await saveWebhook(
        {
          id: cleanText(body.id) || undefined,
          name: cleanText(body.name).slice(0, 80),
          url,
          events: parseWebhookEvents(body.events).join(","),
          secret: cleanText(body.secret).slice(0, 120),
          active: body.active !== false,
        },
        branchId,
      )
      return NextResponse.json({ ok: true, webhook }, { status: body.id ? 200 : 201 })
    }

    if (action === "delete") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Webhook no indicado" }, { status: 400 })
      await deleteWebhook(id, branchId)
      return NextResponse.json({ ok: true })
    }

    if (action === "test") {
      const id = cleanText(body.id)
      const webhooks = await getWebhooks(branchId)
      const webhook = webhooks.find((w) => w.id === id)
      if (!webhook) return NextResponse.json({ error: "Webhook no encontrado" }, { status: 404 })
      const status = await fireWebhookTest(webhook, branchId)
      return NextResponse.json({ ok: true, status })
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el webhook" },
      { status: 500 },
    )
  }
}
