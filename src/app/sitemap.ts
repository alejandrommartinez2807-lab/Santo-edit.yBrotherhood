import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/siteUrl"
import { getSupabaseAdmin } from "@/lib/supabaseServer"

// Páginas públicas del centro comercial + cada micrositio publicado. El panel,
// las APIs y las pantallas transaccionales quedan fuera (ver robots.ts).
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()

  const pages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/portal`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/consultorios`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/mapa`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/estacionamiento`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/contacto`, changeFrequency: "monthly", priority: 0.3 },
  ]

  // Micrositios publicados (si la DB no responde, quedan al menos las páginas fijas).
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from("units")
      .select("microsite_slug")
      .eq("microsite_enabled", true)
      .neq("microsite_slug", "")
      .limit(500)
    for (const u of data ?? []) {
      if (u.microsite_slug) {
        pages.push({ url: `${siteUrl}/tienda/${u.microsite_slug}`, changeFrequency: "weekly", priority: 0.7 })
      }
    }
  } catch {
    // silencioso: el sitemap sigue válido con las páginas fijas
  }

  return pages
}
