import { NextRequest, NextResponse } from "next/server"
import { deleteReview, getReviews, setReviewPublished } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { summarizeReviews } from "@/lib/reviewsSummary"

import { checkReviewsAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkReviewsAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const reviews = await getReviews(branchId)
    return NextResponse.json({ ok: true, reviews, summary: summarizeReviews(reviews) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las reseñas" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-reviews-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de reseñas. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkReviewsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const id = cleanText(body.id)
    if (!id) return NextResponse.json({ error: "Reseña no indicada" }, { status: 400 })

    if (cleanText(body.action) === "delete") {
      await deleteReview(id, branchId)
      return NextResponse.json({ ok: true })
    }

    const review = await setReviewPublished(id, body.published !== false, branchId)
    return NextResponse.json({ ok: true, review })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la reseña" },
      { status: 500 }
    )
  }
}
