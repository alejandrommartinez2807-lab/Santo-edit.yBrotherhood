// URL pública canónica del sitio, adaptable por cliente/deploy:
//  1) NEXT_PUBLIC_SITE_URL si el dueño tiene dominio propio (.com),
//  2) el dominio de producción que asigna Vercel al proyecto,
//  3) localhost en desarrollo.
// La usan metadata/Open Graph, sitemap, robots y los links absolutos
// (seguimiento de pedido, JSON-LD).
export function getSiteUrl(): string {
  const explicit = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim()
  if (explicit) return explicit.replace(/\/+$/, "")

  const vercelHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim()
  if (vercelHost) return `https://${vercelHost}`

  return "http://localhost:3000"
}
