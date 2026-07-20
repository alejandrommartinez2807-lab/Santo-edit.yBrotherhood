import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { decodeDataUrlImage, sanitizeUploadedImageFileName } from "@/lib/dataUrlImages"

// Reutilizamos el bucket público que ya existe en el template para imágenes.
const BUCKET = "menu-images"

// Sube una imagen (data URL) al storage y devuelve su URL pública.
// `folder` agrupa por uso (locales, portadas, galeria…), `name` es un nombre base.
export async function uploadMallImage(dataUrl: string, folder: string, name: string): Promise<string> {
  const supabase = getSupabaseAdmin()
  const image = decodeDataUrlImage(dataUrl, {
    label: "La imagen",
    maxBytes: 6_000_000,
    fallbackMimeType: "image/jpeg",
  })
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "mall"
  const safeName = sanitizeUploadedImageFileName(`${name || "imagen"}.jpg`, name || "imagen", image.mimeType)
  const path = `mall/${safeFolder}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, image.buffer, {
    contentType: image.mimeType,
    upsert: true,
  })
  if (error) throw new Error(error.message || "No se pudo subir la imagen")

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = data?.publicUrl || ""
  if (!url) throw new Error("La imagen se subió pero no se obtuvo el enlace")
  return url
}
