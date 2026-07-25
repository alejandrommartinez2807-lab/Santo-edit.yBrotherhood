import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/siteUrl"
import { getBusinessConfig } from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"

// Solo las páginas públicas que queremos en Google. El panel, las APIs y las
// pantallas transaccionales (pago, seguimiento) quedan fuera (ver robots.ts).
// `/reservar` solo se anuncia si el módulo de reservas está ACTIVO (auditoría
// 2026-07-24): con el módulo apagado la URL mostraba "no disponible".
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()

  let reservationsEnabled = false
  try {
    const config = await getBusinessConfig()
    reservationsEnabled = getModulePlanAccess(
      config as unknown as Record<string, unknown>,
      "reservations",
    ).effectiveEnabled
  } catch {
    reservationsEnabled = false
  }

  const routes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/mesa`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ]

  if (reservationsEnabled) {
    routes.push({
      url: `${siteUrl}/reservar`,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  }

  return routes
}
