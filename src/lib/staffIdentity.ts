export const INTERNAL_STAFF_EMAIL_DOMAIN = "santo.local"

export function normalizeStaffUsername(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42)
}

export function createInternalStaffEmail(username: unknown): string {
  const cleanUsername = normalizeStaffUsername(username)
  return cleanUsername ? `${cleanUsername}@${INTERNAL_STAFF_EMAIL_DOMAIN}` : ""
}

export function isInternalStaffEmail(email: unknown): boolean {
  return String(email || "").trim().toLowerCase().endsWith(`@${INTERNAL_STAFF_EMAIL_DOMAIN}`)
}

export function getStaffUsernameFromEmail(email: unknown): string {
  const cleanEmail = String(email || "").trim().toLowerCase()
  if (!cleanEmail) return ""
  return normalizeStaffUsername(cleanEmail.split("@")[0])
}

export function resolveStaffLoginEmail(identifier: unknown): string {
  const cleanIdentifier = String(identifier || "").trim().toLowerCase()
  if (!cleanIdentifier) return ""
  if (cleanIdentifier.includes("@")) return cleanIdentifier
  return createInternalStaffEmail(cleanIdentifier)
}
