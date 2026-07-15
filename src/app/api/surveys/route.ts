import { NextRequest, NextResponse } from "next/server"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { resolveBranchId } from "@/lib/branch"
import { getSurveyResults, markOrderSurveySent } from "@/lib/surveys"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Encuestas post-venta (lado interno): resultados con promedios para el
// dueño/encargado, y marca de "encuesta ya enviada" cuando el staff usa el
// botón manual (así el envío automático no la repite).

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    }
  }

  if (!allowedRoles.includes(access.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Esta clave no tiene permiso para las encuestas" },
        { status: 403 },
      ),
    }
  }

  return { ok: true as const, access }
}

export async function GET(request: NextRequest) {
  try {
    const roleCheck = checkRole(request, ["owner", "manager", "support"])
    if (!roleCheck.ok) return roleCheck.response

    const results = await getSurveyResults({
      branchId: await resolveBranchId(request),
      limit: Number(request.nextUrl.searchParams.get("limit")) || 200,
    })

    return NextResponse.json({ ok: true, ...results })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las encuestas",
      },
      { status: 500 },
    )
  }
}

// POST { action: "markSent", orderId }: el staff abrió el WhatsApp de la
// encuesta para ese pedido; se marca para que el envío automático no repita.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-surveys-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 32_000,
    rateLimitMessage: "Demasiadas solicitudes. Espera unos segundos.",
  })

  if (guardResponse) return guardResponse

  try {
    const roleCheck = checkRole(request, ["owner", "manager", "cashier", "promoter", "support"])
    if (!roleCheck.ok) return roleCheck.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const orderId = String(body.orderId || "").trim().toLowerCase()

    if (String(body.action || "") !== "markSent" || !orderId.startsWith("ord-")) {
      return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
    }

    const marked = await markOrderSurveySent(orderId, "manual-whatsapp")

    return NextResponse.json({ ok: true, marked })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo marcar la encuesta",
      },
      { status: 500 },
    )
  }
}
