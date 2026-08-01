// Espejo reducido de `dataUrlImages.ts` para los modelos 3D de la carta.
// Vive aparte a propósito: `dataUrlImages.ts` lo comparten los comprobantes de
// pago y tocarlo tiene consecuencias en cobros.
//
// Dos formatos, uno por plataforma:
//   .glb  (model/gltf-binary)   → visor 3D + AR en Android (Scene Viewer)
//   .usdz (model/vnd.usdz+zip)  → AR nativo en iPhone (AR Quick Look)

export class DataUrlModelError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "DataUrlModelError"
    this.status = status
  }
}

export type SupportedModelMimeType = "model/gltf-binary" | "model/vnd.usdz+zip"

export type ParsedDataUrlModel = {
  mimeType: SupportedModelMimeType
  base64: string
  estimatedBytes: number
}

export type DataUrlModelOptions = {
  maxBytes?: number
  label?: string
  fallbackMimeType?: string
  /** Nombre original del archivo: manda sobre el MIME (ver `normalizeModelMimeType`). */
  fileName?: string
}

const MIME_EXTENSION: Record<SupportedModelMimeType, string> = {
  "model/gltf-binary": "glb",
  "model/vnd.usdz+zip": "usdz",
}

// Variantes que mandan navegadores y sistemas operativos para el mismo archivo.
const MIME_ALIASES: Record<string, SupportedModelMimeType> = {
  "model/gltf-binary": "model/gltf-binary",
  "model/gltf+binary": "model/gltf-binary",
  "application/octet-stream+glb": "model/gltf-binary",
  "model/vnd.usdz+zip": "model/vnd.usdz+zip",
  "application/vnd.usdz+zip": "model/vnd.usdz+zip",
  "model/vnd.usd+zip": "model/vnd.usdz+zip",
  "model/usd": "model/vnd.usdz+zip",
}

function normalizeModelMimeType(value: unknown): SupportedModelMimeType | "" {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()

  return MIME_ALIASES[normalized] || ""
}

export function getModelMimeTypeFromFileName(value: unknown): SupportedModelMimeType | "" {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()

  if (normalized.endsWith(".glb")) return "model/gltf-binary"
  if (normalized.endsWith(".usdz")) return "model/vnd.usdz+zip"

  return ""
}

function estimateBase64Bytes(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

function cleanBase64(value: string) {
  return value.replace(/\s+/g, "")
}

export function parseDataUrlModel(
  value: unknown,
  options: Pick<DataUrlModelOptions, "fallbackMimeType" | "fileName"> = {},
): ParsedDataUrlModel | null {
  const raw = String(value || "").trim()
  if (!raw) return null

  const match = raw.match(/^data:([^;,]*);base64,([A-Za-z0-9+/=\s]+)$/)
  if (!match) return null

  // La extensión manda sobre el MIME: muchos navegadores mandan
  // `application/octet-stream` (o directamente nada) para un `.glb` válido.
  // Si vino nombre de archivo y NO termina en .glb/.usdz, se rechaza aunque el
  // MIME diga lo contrario.
  const rawFileName = String(options.fileName || "").trim()
  const typeFromFileName = getModelMimeTypeFromFileName(rawFileName)

  if (rawFileName && !typeFromFileName) return null

  const mimeType =
    typeFromFileName ||
    normalizeModelMimeType(match[1]) ||
    normalizeModelMimeType(options.fallbackMimeType)

  if (!mimeType) return null

  const base64 = cleanBase64(match[2] || "")
  if (!base64 || base64.length % 4 !== 0) return null

  return {
    mimeType,
    base64,
    estimatedBytes: estimateBase64Bytes(base64),
  }
}

export function assertDataUrlModel(
  value: unknown,
  options: DataUrlModelOptions = {},
): ParsedDataUrlModel {
  const label = options.label || "El modelo 3D"
  const parsed = parseDataUrlModel(value, options)

  if (!parsed) {
    throw new DataUrlModelError(
      `${label} debe ser un archivo .glb o .usdz válido.`,
      400,
    )
  }

  const maxBytes = Math.floor(Number(options.maxBytes || 0))
  if (maxBytes > 0 && parsed.estimatedBytes > maxBytes) {
    const maxMb = Math.max(1, Math.floor((maxBytes / 1_000_000) * 10) / 10)
    throw new DataUrlModelError(
      `${label} es demasiado pesado. Usa un archivo menor a ${maxMb} MB.`,
      413,
    )
  }

  return parsed
}

// Firma binaria del archivo. Sin esto, cualquiera con permiso de subir modelos
// podría meter un HTML/SVG llamado "plato.glb" en un bucket PÚBLICO.
//   .glb  → magic ASCII "glTF" (spec glTF 2.0, header binario)
//   .usdz → es un ZIP sin comprimir → "PK\x03\x04"
function assertModelFileSignature(
  buffer: Buffer,
  mimeType: SupportedModelMimeType,
  label: string,
) {
  if (mimeType === "model/gltf-binary") {
    if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "glTF") {
      throw new DataUrlModelError(
        `${label} no parece un .glb real (le falta la firma glTF). Exporta el modelo como glTF binario.`,
        400,
      )
    }
    return
  }

  const isZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04

  if (!isZip) {
    throw new DataUrlModelError(
      `${label} no parece un .usdz real. Exporta el modelo en formato USDZ.`,
      400,
    )
  }
}

export function decodeDataUrlModel(
  value: unknown,
  options: DataUrlModelOptions = {},
) {
  const label = options.label || "El modelo 3D"
  const parsed = assertDataUrlModel(value, options)
  const buffer = Buffer.from(parsed.base64, "base64")

  if (!buffer.length) {
    throw new DataUrlModelError(`${label} no tiene contenido válido.`, 400)
  }

  assertModelFileSignature(buffer, parsed.mimeType, label)

  return {
    ...parsed,
    buffer,
  }
}

export function getModelExtension(mimeType: SupportedModelMimeType) {
  return MIME_EXTENSION[mimeType] || "glb"
}

export function sanitizeUploadedModelFileName(
  value: unknown,
  fallbackName: string,
  mimeType: SupportedModelMimeType,
) {
  const extension = getModelExtension(mimeType)
  const cleanBaseName =
    String(value || fallbackName || "modelo")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\.[a-zA-Z0-9]{1,8}$/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "modelo"

  return `${cleanBaseName}.${extension}`
}
