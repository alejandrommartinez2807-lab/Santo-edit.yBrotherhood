import * as store from "./ordersStoreReviews"
import type { CreateReviewInput, Review } from "./ordersStoreReviews"

export type { CreateReviewInput, Review }

export async function getReviews(branchId?: string | null): Promise<Review[]> {
  return store.getReviews(branchId)
}

export async function createReview(input: CreateReviewInput, branchId?: string | null): Promise<Review> {
  return store.createReview(input, branchId)
}

export async function setReviewPublished(id: string, published: boolean, branchId?: string | null): Promise<Review> {
  return store.setReviewPublished(id, published, branchId)
}

export async function deleteReview(id: string, branchId?: string | null) {
  return store.deleteReview(id, branchId)
}
