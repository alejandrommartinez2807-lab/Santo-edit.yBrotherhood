export type HeaderSetter = {
  set(name: string, value: string): void
}

const API_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const

const API_NO_STORE_VALUE = "no-store, no-cache, must-revalidate, proxy-revalidate"

export function applyApiSecurityHeaders(headers: HeaderSetter) {
  for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) {
    headers.set(name, value)
  }

  headers.set("Vary", "Origin")

  return headers
}

export function applyApiNoStoreHeaders(headers: HeaderSetter) {
  headers.set("Cache-Control", API_NO_STORE_VALUE)
  return headers
}

export function applyPrivateApiHeaders(headers: HeaderSetter) {
  applyApiSecurityHeaders(headers)
  applyApiNoStoreHeaders(headers)
  return headers
}

export function getApiNoStoreValue() {
  return API_NO_STORE_VALUE
}
