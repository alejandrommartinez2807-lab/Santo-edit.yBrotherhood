import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://192.168.0.240:3000",
    "http://192.168.0.120:3000",
    "192.168.0.240:3000",
    "192.168.0.120:3000",
  ],
  // Apartamentos Palulu (administración de condominio):
  //  · raíz y /hotel → portal público del residente (/portal)
  //  · /admin y /pedidos (enlaces heredados) → panel administrativo nuevo (/panel)
  async redirects() {
    return [
      { source: "/", destination: "/portal", permanent: false },
      { source: "/hotel", destination: "/portal", permanent: false },
      { source: "/admin", destination: "/panel", permanent: false },
      { source: "/pedidos", destination: "/panel", permanent: false },
    ]
  },
}

export default nextConfig