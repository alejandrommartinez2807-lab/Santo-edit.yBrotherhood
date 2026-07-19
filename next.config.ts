import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://192.168.0.240:3000",
    "http://192.168.0.120:3000",
    "192.168.0.240:3000",
    "192.168.0.120:3000",
  ],
  // Apartamentos Palulu (administración de condominio): mientras se construyen
  // los módulos, la raíz lleva al panel administrativo (/admin). El portal
  // público del residente reemplazará la raíz en una fase posterior.
  async redirects() {
    return [
      { source: "/", destination: "/admin", permanent: false },
      { source: "/pedidos", destination: "/admin", permanent: false },
      { source: "/hotel", destination: "/admin", permanent: false },
    ]
  },
}

export default nextConfig