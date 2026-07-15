import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://192.168.0.240:3000",
    "http://192.168.0.120:3000",
    "192.168.0.240:3000",
    "192.168.0.120:3000",
  ],
  // Producto Hotel (Lidotel): la portada pública es el hotel, no el menú de
  // restaurante del template. La raíz redirige a /hotel y el panel privado
  // vive en /admin (los enlaces viejos a /pedidos siguen funcionando).
  // OJO: los QR de room service/mesa apuntan a "/?mesa=..." — con cualquiera
  // de esos parámetros NO se redirige, para que el huésped sí pueda pedir.
  async redirects() {
    const orderParams = ["mesa", "table", "ubicacion", "mesa_qr", "qr", "branch"]
    return [
      {
        source: "/",
        destination: "/hotel",
        permanent: false,
        missing: orderParams.map((key) => ({ type: "query" as const, key })),
      },
      { source: "/pedidos", destination: "/admin", permanent: false },
    ]
  },
  // La carta de room service / restaurante con URL propia (sirve el menú de /).
  async rewrites() {
    return [{ source: "/carta", destination: "/" }]
  },
}

export default nextConfig