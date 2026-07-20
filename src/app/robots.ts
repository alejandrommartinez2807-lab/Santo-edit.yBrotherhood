import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/siteUrl"

// Indexable: el sitio público (menú, reservas). Bloqueado: panel del staff,
// APIs y pantallas transaccionales del cliente (pago y seguimiento de pedido,
// que llevan ids privados en la URL).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/local-santo",
          "/acceso",
          "/api/",
          "/pago",
          "/pedidos",
          "/pedido/",
          "/admin",
          "/panel",
          "/mi-cuenta",
        ],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}
