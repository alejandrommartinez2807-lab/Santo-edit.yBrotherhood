"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import {
  PreviewSwitcher,
  formatUsd,
  usePreviewData,
} from "../preview-shared"

// IDEA 3 · STREET HEAT — póster callejero invertido: el ámbar es el fondo
// (las ideas 1 y 2 son oscuras), tipografía condensada gigante en negro,
// cintas marquee en movimiento perpetuo y menú en carruseles con snap.

const DISPLAY = { fontFamily: "var(--font-display), Impact, sans-serif" } as const

function Marquee({ inverted = false }: { inverted?: boolean }) {
  const words = ["SMASH BURGERS", "CHICKEN", "COMBOS", "VALENCIA", "BROTHERHOOD"]
  const strip = Array.from({ length: 3 }, () => words).flat()

  return (
    <div
      className={`overflow-hidden border-y-2 border-black py-2 ${
        inverted ? "bg-black text-[#f5a623]" : "bg-[#f5a623] text-black"
      }`}
    >
      <div className="flex w-max animate-[previa-marquee_18s_linear_infinite] gap-6 whitespace-nowrap">
        {strip.map((word, i) => (
          <span key={i} className="flex items-center gap-6 text-sm font-black tracking-widest" style={DISPLAY}>
            {word} <span aria-hidden>★</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes previa-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

export default function PreviaIdea3() {
  const { products, categories, tagline, loading } = usePreviewData()

  const byCategory = categories
    .map((cat) => ({
      cat,
      items: products.filter((p) => p.category === cat).slice(0, 8),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <main className="min-h-screen bg-[#f5a623] pb-24 text-black">
      <PreviewSwitcher current="Idea 3 · Street Heat" />

      {/* Barra superior */}
      <header className="flex items-center justify-between px-5 pt-5">
        <Image
          src="/brotherhood-logotipo-negro.png"
          alt="Brotherhood"
          width={150}
          height={50}
          className="h-10 w-auto"
          priority
        />
        <span className="flex items-center gap-1.5 rounded-full border-2 border-black bg-white px-3 py-1 text-[11px] font-black uppercase">
          <span className="h-2 w-2 rounded-full bg-green-500" /> Abierto ahora
        </span>
      </header>

      {/* Héroe póster */}
      <section className="px-5 pt-6">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-black uppercase tracking-[0.3em]"
        >
          🔥 {tagline}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-3 text-[17vw] leading-[0.9] sm:text-7xl"
          style={DISPLAY}
        >
          HECHAS
          <br />A GOLPE
          <br />
          <span className="bg-black px-2 text-[#f5a623]">DE PLANCHA</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, rotate: -6, scale: 0.92 }}
          animate={{ opacity: 1, rotate: -3, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 120 }}
          className="relative mt-6 overflow-hidden rounded-3xl border-4 border-black shadow-[8px_8px_0_#000]"
        >
          <Image
            src="/brotherhood-hero-burger.jpg"
            alt="Smash burger Brotherhood"
            width={800}
            height={600}
            sizes="(max-width: 640px) 92vw, 560px"
            className="h-64 w-full object-cover"
            priority
          />
          <span className="absolute right-3 top-3 rotate-6 rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase">
            Doble queso
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="mt-6 grid gap-3"
        >
          <Link
            href="/#menu"
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-black bg-black px-6 py-4 text-base font-black uppercase tracking-wide text-[#f5a623] shadow-[6px_6px_0_rgba(0,0,0,0.35)] transition active:translate-y-1 active:shadow-none"
          >
            Ver menú y pedir →
          </Link>
          <div className="grid grid-cols-2 gap-3 text-sm font-black uppercase">
            <Link href="/#sedes" className="rounded-2xl border-2 border-black bg-white/70 px-4 py-3 text-center transition hover:bg-white">
              📍 Cómo llegar
            </Link>
            <Link href="/#contacto" className="rounded-2xl border-2 border-black bg-white/70 px-4 py-3 text-center transition hover:bg-white">
              ⭐ Reseñas
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Cintas en movimiento */}
      <div className="mt-8 -rotate-1">
        <Marquee inverted />
      </div>
      <div className="rotate-1">
        <Marquee />
      </div>

      {/* Menú en carruseles */}
      <section id="menu" className="mt-8 bg-black pb-10 pt-8 text-white">
        <h2 className="px-5 text-4xl uppercase text-[#f5a623]" style={DISPLAY}>
          El menú
        </h2>
        {loading && (
          <p className="px-5 py-8 text-sm text-white/60">Cargando el menú…</p>
        )}
        {byCategory.map((group) => (
          <div key={group.cat} className="mt-6">
            <h3 className="px-5 text-sm font-black uppercase tracking-[0.25em] text-white/60">
              {group.cat}
            </h3>
            <div className="mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
              {group.items.map((item) => (
                <motion.article
                  key={item.id}
                  whileTap={{ scale: 0.97 }}
                  className="w-56 shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-[#f5a623]/60 bg-[#111]"
                >
                  <div className="relative h-32 w-full bg-[#181818]">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="224px"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-black uppercase">{item.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-white/50">{item.description}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-lg text-[#f5a623]" style={DISPLAY}>
                        {formatUsd(item.price)}
                      </span>
                      <Link
                        href="/#menu"
                        className="rounded-full bg-[#f5a623] px-3 py-1 text-xs font-black uppercase text-black"
                      >
                        Pedir
                      </Link>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        ))}
        <p className="mt-8 px-5 text-center text-xs text-white/40">
          Brotherhood · Valencia · Smash burgers, chicken y más
        </p>
      </section>

      {/* Barra inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-black bg-[#f5a623]">
        <div className="mx-auto grid max-w-md grid-cols-4 text-center text-[10px] font-black uppercase">
          {[
            { label: "Inicio", icon: "🏠", href: "/previa/idea-3" },
            { label: "Menú", icon: "🍔", href: "#menu" },
            { label: "Pedidos", icon: "🛍️", href: "/mis-pedidos" },
            { label: "Cuenta", icon: "👤", href: "/mis-pedidos" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="flex flex-col items-center gap-0.5 py-2.5">
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  )
}
