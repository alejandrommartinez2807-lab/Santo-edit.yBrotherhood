import { NextRequest, NextResponse } from "next/server"
import {
  deleteRoomBlock,
  getRoomBlocks,
  getRooms,
  saveRoomBlock,
  updateRoomIcalUrl,
} from "@/lib/orders"
import { parseIcalEvents, planIcalSync } from "@/lib/icalImport"
import { isValidWebhookUrl } from "@/lib/hotelWebhooks"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { captureError } from "@/lib/monitoring"

import { checkChannelSyncAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ICS_TIMEOUT_MS = 10_000
const MAX_ICS_BYTES = 2_000_000

function cleanText(value: unknown) {
  return String(value || "").trim()
}

// Error de columna faltante → pista clara de la migración pendiente.
function migrationHint(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error || "")
  if (/ical_import_url|room_blocks\.source|column .*source/i.test(msg)) {
    return "Falta aplicar la migración 0043 en Supabase para activar la sincronización iCal."
  }
  return null
}

async function fetchIcs(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ICS_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "text/calendar,*/*" } })
    if (!response.ok) throw new Error(`El calendario respondió ${response.status}`)
    const text = await response.text()
    if (text.length > MAX_ICS_BYTES) throw new Error("El calendario es demasiado grande")
    return text
  } finally {
    clearTimeout(timer)
  }
}

// GET: habitaciones con su URL de importación (para el panel de Canales).
export async function GET(request: NextRequest) {
  try {
    const access = await checkChannelSyncAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const rooms = await getRooms(branchId)
    return NextResponse.json({
      ok: true,
      rooms: rooms
        .filter((r) => r.active)
        .map((r) => ({ id: r.id, name: r.name, icalImportUrl: r.icalImportUrl })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las habitaciones" },
      { status: 500 },
    )
  }
}

// POST: setUrl {roomId, url} | sync {roomId?}
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-channel-sync-post",
    limit: 20,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 100_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkChannelSyncAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action)

    if (action === "setUrl") {
      const roomId = cleanText(body.roomId)
      const url = cleanText(body.url)
      if (!roomId) return NextResponse.json({ error: "Habitación no indicada" }, { status: 400 })
      if (url && !isValidWebhookUrl(url)) {
        return NextResponse.json({ error: "La URL debe ser http(s) completa (o vacía para quitarla)" }, { status: 400 })
      }
      try {
        await updateRoomIcalUrl(roomId, url, branchId)
      } catch (error) {
        const hint = migrationHint(error)
        if (hint) return NextResponse.json({ error: hint }, { status: 409 })
        throw error
      }
      return NextResponse.json({ ok: true })
    }

    if (action === "sync") {
      const onlyRoomId = cleanText(body.roomId)
      const rooms = (await getRooms(branchId)).filter(
        (r) => r.active && r.icalImportUrl && (!onlyRoomId || r.id === onlyRoomId),
      )
      if (rooms.length === 0) {
        return NextResponse.json(
          { error: "Ninguna habitación tiene URL de calendario externo configurada." },
          { status: 400 },
        )
      }

      const today = new Date().toISOString().slice(0, 10)
      const horizon = `${new Date().getFullYear() + 2}-01-01`
      const allBlocks = await getRoomBlocks({ from: today, to: horizon }, branchId)

      const results: { roomId: string; roomName: string; created: number; deleted: number; error: string }[] = []
      // Secuencial a propósito: pocas habitaciones con URL y errores legibles.
      for (const room of rooms) {
        try {
          const ics = await fetchIcs(room.icalImportUrl)
          const events = parseIcalEvents(ics)
          const plan = planIcalSync({
            existing: allBlocks.filter((b) => b.roomId === room.id),
            events,
            todayISO: today,
          })
          for (const block of plan.toCreate) {
            await saveRoomBlock({ roomId: room.id, ...block, source: "ical" }, branchId)
          }
          for (const id of plan.toDeleteIds) {
            await deleteRoomBlock(id, branchId)
          }
          results.push({
            roomId: room.id,
            roomName: room.name,
            created: plan.toCreate.length,
            deleted: plan.toDeleteIds.length,
            error: "",
          })
        } catch (error) {
          captureError(error, { route: "/api/channel-sync", action: `sync:${room.id}` })
          results.push({
            roomId: room.id,
            roomName: room.name,
            created: 0,
            deleted: 0,
            error: migrationHint(error) || (error instanceof Error ? error.message : "No se pudo sincronizar"),
          })
        }
      }

      return NextResponse.json({ ok: true, results })
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
  } catch (error) {
    const hint = migrationHint(error)
    if (hint) return NextResponse.json({ error: hint }, { status: 409 })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar" },
      { status: 500 },
    )
  }
}
