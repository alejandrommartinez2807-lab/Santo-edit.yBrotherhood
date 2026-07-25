"use client"

import Image from "next/image"
import Link from "next/link"

// Comparador de las 5 opciones de rediseño del home público.
// Ruta aislada solo para decidir; no toca la página real.

const LIVE_PREVIEWS = [
  {
    href: "/previa/idea-3",
    n: "3",
    name: "Street Heat",
    desc: "Póster callejero en ámbar: titulares gigantes en negro sobre naranja, cintas marquee en movimiento y menú en carrusel. Energía alta.",
    chip: "bg-[#f5a623] text-black",
  },
  {
    href: "/previa/idea-4",
    n: "4",
    name: "Midnight Glass",
    desc: "App premium: vidrio esmerilado sobre negro profundo, resplandor ámbar ambiental, burger flotante y pills de categorías con resorte.",
    chip: "bg-white/10 text-white",
  },
  {
    href: "/previa/idea-5",
    n: "5",
    name: "El Ritual",
    desc: "Historia cinematográfica por capítulos a pantalla completa: scroll con snap, números enormes, revelados al hacer scroll.",
    chip: "bg-[#1a1a1a] text-[#f5a623] border border-[#f5a623]/40",
  },
]

export default function PreviaIndex() {
  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-10">
      <Image
        src="/brotherhood-logo-transparente.png"
        alt="Brotherhood"
        width={190}
        height={64}
        className="mx-auto h-14 w-auto"
        priority
      />
      <h1 className="mt-6 text-center text-2xl font-bold">Rediseño del home</h1>
      <p className="mt-2 text-center text-sm text-white/60">
        5 opciones para comparar. Las ideas 1 y 2 son mockups (imagen); las
        ideas 3, 4 y 5 son páginas navegables de verdad.
      </p>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-widest text-white/40">
        Mockups de referencia
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[
          { src: "/previa/idea-1.png", label: "Idea 1 · Oscura mayúsculas" },
          { src: "/previa/idea-2.png", label: "Idea 2 · Elegante serif" },
        ].map((idea) => (
          <figure key={idea.src} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <Image
              src={idea.src}
              alt={idea.label}
              width={470}
              height={840}
              sizes="(max-width: 480px) 45vw, 220px"
              className="h-auto w-full"
            />
            <figcaption className="px-3 py-2 text-[11px] text-white/60">{idea.label}</figcaption>
          </figure>
        ))}
      </div>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-widest text-white/40">
        Previas navegables (nuevas)
      </h2>
      <div className="mt-3 space-y-3">
        {LIVE_PREVIEWS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-[#f5a623]/60 hover:bg-white/10"
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black ${p.chip}`}
            >
              {p.n}
            </span>
            <span>
              <span className="block font-bold">{p.name}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-white/60">{p.desc}</span>
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-center text-[11px] text-white/40">
        Estas rutas viven bajo <code>/previa</code>, no se indexan y no tocan la
        página pública real.
      </p>
    </main>
  )
}
