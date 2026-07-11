import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/siteUrl"

// Solo las páginas públicas que queremos en Google. El panel, las APIs y las
// pantallas transaccionales (pago, seguimiento) quedan fuera (ver robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()

  return [
    {
      url: siteUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/reservar`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/mesa`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ]
}
