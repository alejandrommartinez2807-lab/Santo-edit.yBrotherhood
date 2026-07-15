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
  async redirects() {
    return [
      { source: "/", destination: "/hotel", permanent: false },
      { source: "/pedidos", destination: "/admin", permanent: false },
    ]
  },
}

export default nextConfig