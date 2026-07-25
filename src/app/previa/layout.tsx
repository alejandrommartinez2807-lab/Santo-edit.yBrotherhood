import type { Metadata } from "next"
import type { ReactNode } from "react"

// Rutas de VISTA PREVIA del rediseño público (Parte D del super prompt).
// Aisladas de la página real: no se indexan ni se enlazan desde el sitio.
export const metadata: Metadata = {
  title: "Vistas previas — Brotherhood",
  robots: { index: false, follow: false },
}

export default function PreviaLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-black text-white">{children}</div>
}
