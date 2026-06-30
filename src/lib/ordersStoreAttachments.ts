import { cleanText } from "@/lib/localOrderHelpers"
import { decodeDataUrlImage } from "@/lib/dataUrlImages"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import type { CreateOrderInput } from "./ordersCoreTypes"

// Imagen opcional adjunta por el cliente: se sube a Storage y su URL queda
// en el pedido (visible en Caja y en el panel de Pedidos).
export async function uploadOrderAttachmentImage(
  orderId: string,
  input: Pick<CreateOrderInput, "attachmentDataUrl" | "attachmentMimeType">,
): Promise<string> {
  if (!cleanText(input.attachmentDataUrl)) return ""

  const supabase = getSupabaseAdmin()
  let image: ReturnType<typeof decodeDataUrlImage>

  try {
    image = decodeDataUrlImage(input.attachmentDataUrl, {
      label: "La imagen adjunta",
      maxBytes: 8_000_000,
      fallbackMimeType: input.attachmentMimeType || "image/jpeg",
    })
  } catch {
    return ""
  }

  const path = `orders/${orderId}-${Date.now()}`
  const { error: uploadError } = await supabase.storage
    .from("order-attachments")
    .upload(path, image.buffer, { contentType: image.mimeType, upsert: true })

  if (uploadError) return ""

  const { data: publicData } = supabase.storage
    .from("order-attachments")
    .getPublicUrl(path)

  return publicData?.publicUrl || ""
}
