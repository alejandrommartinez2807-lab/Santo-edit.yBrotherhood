export class DataUrlImageError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "DataUrlImageError"
    this.status = status
  }
}

export type SupportedImageMimeType = "image/jpeg" | "image/png" | "image/webp"

export type ParsedDataUrlImage = {
  mimeType: SupportedImageMimeType
  base64: string
  estimatedBytes: number
}

export type DataUrlImageOptions = {
  maxBytes?: number
  label?: string
  fallbackMimeType?: string
}

const SUPPORTED_MIME_TYPES: SupportedImageMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
]

const MIME_EXTENSION: Record<SupportedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

function normalizeMimeType(value: unknown): SupportedImageMimeType | "" {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()

  if (normalized === "image/jpg" || normalized === "image/pjpeg") {
    return "image/jpeg"
  }

  if (SUPPORTED_MIME_TYPES.includes(normalized as SupportedImageMimeType)) {
    return normalized as SupportedImageMimeType
  }

  return ""
}

function estimateBase64Bytes(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

function cleanBase64(value: string) {
  return value.replace(/\s+/g, "")
}

export function parseDataUrlImage(
  value: unknown,
  options: Pick<DataUrlImageOptions, "fallbackMimeType"> = {},
): ParsedDataUrlImage | null {
  const raw = String(value || "").trim()
  if (!raw) return null

  const match = raw.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/)
  if (!match) return null

  const mimeType =
    normalizeMimeType(match[1]) || normalizeMimeType(options.fallbackMimeType)
  if (!mimeType) return null

  const base64 = cleanBase64(match[2] || "")
  if (!base64 || base64.length % 4 !== 0) return null

  return {
    mimeType,
    base64,
    estimatedBytes: estimateBase64Bytes(base64),
  }
}

export function assertDataUrlImage(
  value: unknown,
  options: DataUrlImageOptions = {},
): ParsedDataUrlImage {
  const label = options.label || "La imagen"
  const parsed = parseDataUrlImage(value, options)

  if (!parsed) {
    throw new DataUrlImageError(
      `${label} debe ser JPG, PNG o WEBP en formato válido.`,
      400,
    )
  }

  const maxBytes = Math.floor(Number(options.maxBytes || 0))
  if (maxBytes > 0 && parsed.estimatedBytes > maxBytes) {
    const maxMb = Math.max(1, Math.floor((maxBytes / 1_000_000) * 10) / 10)
    throw new DataUrlImageError(
      `${label} es demasiado pesada. Usa una imagen menor a ${maxMb} MB.`,
      413,
    )
  }

  return parsed
}

export function decodeDataUrlImage(
  value: unknown,
  options: DataUrlImageOptions = {},
) {
  const parsed = assertDataUrlImage(value, options)
  const buffer = Buffer.from(parsed.base64, "base64")

  if (!buffer.length) {
    throw new DataUrlImageError(
      `${options.label || "La imagen"} no tiene contenido válido.`,
      400,
    )
  }

  return {
    ...parsed,
    buffer,
  }
}

export function getImageExtension(mimeType: SupportedImageMimeType) {
  return MIME_EXTENSION[mimeType] || "jpg"
}

export function sanitizeUploadedImageFileName(
  value: unknown,
  fallbackName: string,
  mimeType: SupportedImageMimeType,
) {
  const extension = getImageExtension(mimeType)
  const cleanBaseName =
    String(value || fallbackName || "imagen")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\.[a-zA-Z0-9]{1,8}$/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "imagen"

  return `${cleanBaseName}.${extension}`
}
