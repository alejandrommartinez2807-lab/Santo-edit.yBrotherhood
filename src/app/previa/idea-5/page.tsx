"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import {
  PreviewSwitcher,
  formatUsd,
  usePreviewData,
} from "../preview-shared"

// IDEA 5 · EL RITUAL — el home como una película por capítulos: secciones a
// pantalla completa con scroll-snap, numeración enorme estilo cartel de cine,
// revelados al entrar en viewport y un riel de progreso lateral. Personalidad:
// oscura, dramática, pausada — lo contrario del póster gritón de la idea 3.

const DISPLAY = { fontFamily: "var(--font-display), Impact, sans-serif" } as const

const reveal = {
  initial: { opacity: 0, y: 34 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.7, ease: "easeOut" },
} as const

function ChapterNumber({ n }: { n: string }) {
  return (
    <motion.span
      {...reveal}
      className="block text-[26vw] leading-none text-white/[0.07] sm:text-[10rem]"
      style={DISPLAY}
    >
      {n}
    </motion.span>
  )
}

export default function PreviaIdea5() {
  const { products, tagline, loading } = usePreviewData()
  const featured = products.filter((p) => p.isFeatured).slice(0, 4)
  const menu = (featured.length >= 3 ? featured : products.slice(0, 4))

  return (
    <main className="h-screen snap-y snap-mandatory overflow-y-auto bg-[#0a0a0a] text-white [scrollbar-width:none]">
      <PreviewSwitcher current="Idea 5 · El Ritual" />

      {/* Riel de progreso */}
      <div aria-hidden className="fixed right-4 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2">
        {["cap1", "cap2", "cap3", "cap4"].map((c) => (
          <span key={c} className="h-6 w-px bg-white/25" />
        ))}
      </div>

      {/* CAP. 01 — Apertura */}
      <section className="relative flex h-screen snap-start flex-col justify-between overflow-hidden px-6 py-8">
        <Image
          src="/brotherhood-hero-burger.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-25"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#0a0a0a]" />

        <header className="relative flex items-center justify-between">
          <Image
            src="/brotherhood-logo-transparente.png"
            alt="Brotherhood"
            width={150}
            height={50}
            className="h-9 w-auto"
            priority
          />
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400" /> Abierto ahora
          </span>
        </header>

        <div className="relative">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[11px] uppercase tracking-[0.4em] text-white/50"
          >
            Capítulo 01 · {tagline}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="mt-4 text-6xl uppercase leading-[0.92]"
            style={DISPLAY}
          >
            Esto no es
            <br />
            <em className="font-serif normal-case italic text-[#f5a623]">comida rápida.</em>
            <br />
            Es un ritual.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-5 max-w-xs text-sm leading-relaxed text-white/60"
          >
            Carne prensada al momento, queso fundido y pan dorado en mantequilla.
            Baja un capítulo más.
          </motion.p>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="mt-8 text-2xl text-[#f5a623]"
            aria-hidden
          >
            ↓
          </motion.div>
        </div>
      </section>

      {/* CAP. 02 — El producto */}
      <section className="relative flex h-screen snap-start flex-col justify-center px-6">
        <ChapterNumber n="02" />
        <motion.h2 {...reveal} className="-mt-8 text-4xl uppercase" style={DISPLAY}>
          La <em className="font-serif normal-case italic text-[#f5a623]">smash</em> perfecta
        </motion.h2>
        <motion.div {...reveal} className="relative mt-6 h-[42vh] overflow-hidden rounded-2xl">
          <Image
            src="/brotherhood-hero-burger.jpg"
            alt="Smash burger Brotherhood"
            fill
            sizes="(max-width: 640px) 88vw, 560px"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/85 to-transparent p-4">
            <p className="text-sm font-semibold">Doble carne · queso americano · pepinillos</p>
          </div>
        </motion.div>
        <motion.div {...reveal} className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            ["90g", "por medallón"],
            ["3 min", "en plancha"],
            ["4.8★", "en reseñas"],
          ].map(([big, small]) => (
            <div key={small} className="rounded-xl border border-white/10 py-3">
              <p className="text-xl text-[#f5a623]" style={DISPLAY}>{big}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/50">{small}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* CAP. 03 — El menú */}
      <section className="relative flex h-screen snap-start flex-col justify-center px-6">
        <ChapterNumber n="03" />
        <motion.h2 {...reveal} className="-mt-8 text-4xl uppercase" style={DISPLAY}>
          Elige tu <em className="font-serif normal-case italic text-[#f5a623]">papel</em>
        </motion.h2>
        {loading && <p className="mt-6 text-sm text-white/50">Cargando el menú…</p>}
        <div className="mt-6 space-y-2.5">
          {menu.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex items-center justify-between border-b border-white/10 pb-2.5"
            >
              <div className="min-w-0 pr-3">
                <p className="truncate text-base font-bold">{item.name}</p>
                <p className="line-clamp-1 text-xs text-white/45">{item.description}</p>
              </div>
              <span className="shrink-0 text-lg text-[#f5a623]" style={DISPLAY}>
                {formatUsd(item.price)}
              </span>
            </motion.div>
          ))}
        </div>
        <motion.div {...reveal} className="mt-8">
          <Link
            href="/#menu"
            className="block rounded-full bg-[#f5a623] px-6 py-4 text-center text-base font-bold text-black transition hover:brightness-110"
          >
            Ver el menú completo y pedir
          </Link>
        </motion.div>
      </section>

      {/* CAP. 04 — Cierre + barra */}
      <section className="relative flex h-screen snap-start flex-col justify-center px-6 pb-28">
        <ChapterNumber n="04" />
        <motion.h2 {...reveal} className="-mt-8 text-4xl uppercase" style={DISPLAY}>
          Te esperamos <em className="font-serif normal-case italic text-[#f5a623]">hoy</em>
        </motion.h2>
        <motion.div {...reveal} className="mt-6 space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full bg-green-400" /> Abierto ahora
            </span>
            <span className="text-xs text-white/50">Valencia</span>
          </div>
          <Link
            href="/#sedes"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold transition hover:bg-white/10"
          >
            📍 Cómo llegar a nuestras sedes <span aria-hidden>→</span>
          </Link>
          <Link
            href="/mis-pedidos"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold transition hover:bg-white/10"
          >
            🛍️ Seguir mi pedido <span aria-hidden>→</span>
          </Link>
        </motion.div>
        <motion.p {...reveal} className="mt-10 text-center text-xs text-white/35">
          Brotherhood · Smash burgers, chicken y más
        </motion.p>

        {/* Barra inferior */}
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md">
          <div className="mx-auto grid max-w-md grid-cols-4 text-center text-[10px] font-semibold text-white/60">
            {[
              { label: "Inicio", icon: "🏠", href: "/previa/idea-5", active: true },
              { label: "Menú", icon: "🍔", href: "/#menu", active: false },
              { label: "Pedidos", icon: "🛍️", href: "/mis-pedidos", active: false },
              { label: "Cuenta", icon: "👤", href: "/mis-pedidos", active: false },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 ${item.active ? "text-[#f5a623]" : ""}`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </section>
    </main>
  )
}
