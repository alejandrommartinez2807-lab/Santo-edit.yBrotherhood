// ============================================================
// RESEÑAS · lógica pura de resumen (Hotel · Fase 13)
// Promedio, conteo y distribución 1-5 de las reseñas publicadas. Sin DB.
// ============================================================

export type ReviewLike = { rating?: number; published?: boolean }

export function clampRating(value: unknown): number {
  const n = Math.round(Number(value) || 0)
  return Math.max(1, Math.min(5, n))
}

export type ReviewsSummary = {
  count: number
  average: number
  distribution: Record<number, number> // 1..5 -> cantidad
}

export function summarizeReviews(reviews: ReviewLike[]): ReviewsSummary {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  let count = 0
  for (const review of reviews) {
    if (review.published === false) continue
    const rating = clampRating(review.rating)
    distribution[rating] += 1
    total += rating
    count += 1
  }
  const average = count > 0 ? Math.round((total / count) * 10) / 10 : 0
  return { count, average, distribution }
}
