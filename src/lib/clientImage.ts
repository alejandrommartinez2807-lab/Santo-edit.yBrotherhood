"use client"

// Lectura + compresión de imágenes EN EL NAVEGADOR antes de subirlas.
//
// Por qué existe: las fotos de cámara de un teléfono moderno pesan 4–12 MB
// (y en iPhone llegan como HEIC, que el servidor no acepta). Antes se subía
// el archivo tal cual: fallaba por el límite de 5 MB, fallaba en HEIC y en
// redes lentas la subida se caía a mitad de camino. Aquí se reescala a un
// máximo razonable y se exporta como JPEG liviano (~10x más pequeño), así el
// comprobante llega rápido incluso con mala señal.

export type CompressedImageResult = {
  dataUrl: string
  fileName: string
  mimeType: string
}

export class ClientImageError extends Error {}

const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_TARGET_MAX_BYTES = 1_200_000
// Tope duro de entrada: más de esto ni lo intentamos decodificar (evita
// congelar teléfonos de gama baja con archivos absurdos).
const HARD_INPUT_LIMIT_BYTES = 25 * 1024 * 1024

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new ClientImageError("No se pudo leer la imagen."))
    reader.readAsDataURL(file)
  })
}

async function decodeToBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap decodifica casi todo lo que el navegador soporte
  // (en Safari incluye HEIC). Si falla, probamos con <img> + object URL.
  try {
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(file)
    }
  } catch {
    // cae al plan B
  }

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new ClientImageError("El navegador no pudo abrir esta imagen."))
    }
    image.src = objectUrl
  })
}

function getBitmapSize(bitmap: ImageBitmap | HTMLImageElement) {
  if ("naturalWidth" in bitmap) {
    return { width: bitmap.naturalWidth, height: bitmap.naturalHeight }
  }
  return { width: bitmap.width, height: bitmap.height }
}

function renameToJpeg(fileName: string, fallback: string) {
  const base = String(fileName || "").trim() || fallback
  return `${base.replace(/\.[a-z0-9]+$/i, "")}.jpg`
}

/**
 * Lee un archivo de imagen y devuelve un data URL listo para subir:
 * reescalado a `maxDimension` y exportado como JPEG, bajando la calidad
 * hasta quedar por debajo de `targetMaxBytes`. Si el navegador no puede
 * decodificar el archivo (formato raro), usa el original solo si es un
 * formato aceptado por el servidor y pesa poco.
 */
export async function readImageFileForUpload(
  file: File,
  options: {
    maxDimension?: number
    targetMaxBytes?: number
    fallbackName?: string
  } = {},
): Promise<CompressedImageResult> {
  if (!file.type.startsWith("image/")) {
    throw new ClientImageError("El archivo debe ser una imagen (captura o foto).")
  }

  if (file.size > HARD_INPUT_LIMIT_BYTES) {
    throw new ClientImageError("La imagen pesa demasiado. Usa una captura de pantalla del pago.")
  }

  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION
  const targetMaxBytes = options.targetMaxBytes || DEFAULT_TARGET_MAX_BYTES
  const fallbackName = options.fallbackName || "imagen"

  let bitmap: ImageBitmap | HTMLImageElement | null = null

  try {
    bitmap = await decodeToBitmap(file)
  } catch {
    bitmap = null
  }

  if (bitmap) {
    const { width, height } = getBitmapSize(bitmap)

    if (width > 0 && height > 0) {
      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))

      const context = canvas.getContext("2d")

      if (context) {
        // Fondo blanco: los PNG con transparencia no quedan negros al pasar a JPEG.
        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

        if ("close" in bitmap) {
          try {
            bitmap.close()
          } catch {
            // liberar memoria es mejor-esfuerzo
          }
        }

        for (const quality of [0.82, 0.7, 0.58, 0.45]) {
          const dataUrl = canvas.toDataURL("image/jpeg", quality)

          if (dataUrl.startsWith("data:image/jpeg") && estimateDataUrlBytes(dataUrl) <= targetMaxBytes) {
            return {
              dataUrl,
              fileName: renameToJpeg(file.name, fallbackName),
              mimeType: "image/jpeg",
            }
          }
        }

        // Última pasada: calidad mínima, se envía como quede (ya es MUCHO
        // más liviana que el original).
        const dataUrl = canvas.toDataURL("image/jpeg", 0.4)

        if (dataUrl.startsWith("data:image/jpeg")) {
          return {
            dataUrl,
            fileName: renameToJpeg(file.name, fallbackName),
            mimeType: "image/jpeg",
          }
        }
      }
    }
  }

  // El navegador no pudo decodificar (formato exótico): mandamos el original
  // solo si el servidor lo acepta y no es pesado.
  const supported = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

  if (!supported.includes(file.type.toLowerCase())) {
    throw new ClientImageError(
      "Este formato de imagen no es compatible. Toma una captura de pantalla del pago y súbela.",
    )
  }

  if (file.size > 4 * 1024 * 1024) {
    throw new ClientImageError("La imagen pesa más de 4 MB. Usa una captura más liviana.")
  }

  const dataUrl = await readFileAsDataUrl(file)

  if (!dataUrl.startsWith("data:image/")) {
    throw new ClientImageError("No se pudo leer la imagen.")
  }

  return {
    dataUrl,
    fileName: file.name || `${fallbackName}.jpg`,
    mimeType: file.type || "image/jpeg",
  }
}
