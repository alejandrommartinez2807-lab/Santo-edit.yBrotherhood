"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  PreviewSwitcher,
  formatUsd,
  usePreviewData,
} from "../preview-shared"

// IDEA 4 · MIDNIGHT GLASS — el home como una app premium: negro profundo con
// resplandor ámbar ambiental, tarjetas de vidrio esmerilado (backdrop-blur),
// burger flotando en levitación y pills de categorías con indicador de
// resorte (layoutId). Personalidad: pulida, silenciosa, cara.


export default function PreviaIdea4() {
  const { products, categories, tagline, loading } = usePreviewData()
  const [activeCat, setActiveCat] = useState<string | null>(null)

  const cats = useMemo(
    () => categories.filter((cat) => products.some((p) => p.category === cat)),
    [categories, products]
  )
  const currentCat = activeCat && cats.includes(activeCat) ? activeCat : cats[0] ?? null
  const visible = useMemo(
    () => products.filter((p) => !currentCat || p.category === currentCat).slice(0, 10),
    [products, currentCat]
  )

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070707] pb-28 text-white">
      <PreviewSwitcher current="Idea 4 · Midnight Glass" />

      {/* Resplandor ambiental */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-[-20%] h-96 w-96 rounded-full bg-[#f5a623]/25 blur-[110px]" />
        <div className="absolute top-[45%] left-[-25%] h-80 w-80 rounded-full bg-[#f5a623]/12 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-md px-5">
        {/* Barra superior de vidrio */}
        <header className="sticky top-3 z-40 mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-xl">
          <Image
            src="/brotherhood-logo-transparente.png"
            alt="Brotherhood"
            width={130}
            height={44}
            className="h-8 w-auto"
            priority
          />
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-[11px] font-semibold text-green-400">
            <motion.span
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-2 w-2 rounded-full bg-green-400"
            />
            Abierto ahora
          </span>
        </header>

        {/* Héroe con burger en levitación */}
        <section className="pt-8 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#f5a623]"
          >
            {tagline}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-4xl font-bold leading-tight"
          >
            La smash que
            <br />
            <span className="text-[#f5a623]">se siente premium.</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative mx-auto mt-6 h-64 w-64"
          >
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative h-full w-full overflow-hidden rounded-full border border-white/10 shadow-[0_30px_80px_rgba(245,166,35,0.25)]"
            >
              <Image
                src="/brotherhood-hero-burger.jpg"
                alt="Smash burger Brotherhood"
                fill
                sizes="256px"
                className="object-cover"
                priority
              />
            </motion.div>
            <motion.div
              aria-hidden
              animate={{ scaleX: [1, 0.82, 1], opacity: [0.5, 0.3, 0.5] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-5 left-1/2 h-4 w-40 -translate-x-1/2 rounded-full bg-black/80 blur-md"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-9 grid gap-3"
          >
            <Link
              href="/#menu"
              className="rounded-2xl bg-[#f5a623] px-6 py-4 text-center text-base font-bold text-black shadow-[0_10px_40px_rgba(245,166,35,0.35)] transition hover:brightness-110"
            >
              Ver menú y pedir
            </Link>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { label: "Cómo llegar", href: "/#sedes" },
                { label: "Reseñas 4.8★", href: "/#contacto" },
                { label: "Mis pedidos", href: "/mis-pedidos" },
              ].map((b) => (
                <Link
                  key={b.label}
                  href={b.href}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-2 py-3 text-center font-semibold text-white/80 backdrop-blur-md transition hover:bg-white/10"
                >
                  {b.label}
                </Link>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Menú con pills animadas */}
        <section id="menu" className="pt-12">
          <h2 className="text-xl font-bold">Explora el menú</h2>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {cats.map((cat) => {
              const active = cat === currentCat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "text-black" : "text-white/70 hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="previa4-pill"
                      className="absolute inset-0 rounded-full bg-[#f5a623]"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative">{cat}</span>
                </button>
              )
            })}
          </div>

          {loading && <p className="py-8 text-sm text-white/50">Cargando el menú…</p>}

          <div className="mt-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {visible.map((item, i) => (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-md"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                    <Image src={item.image} alt={item.name} fill sizes="64px" unoptimized className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="line-clamp-1 text-xs text-white/50">{item.description}</p>
                    <p className="mt-1 text-sm font-bold text-[#f5a623]">{formatUsd(item.price)}</p>
                  </div>
                  <Link
                    href="/#menu"
                    aria-label={`Pedir ${item.name}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5a623] text-lg font-bold text-black transition active:scale-90"
                  >
                    +
                  </Link>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <p className="pt-10 text-center text-xs text-white/35">
          Brotherhood · Valencia · Abierto ahora
        </p>
      </div>

      {/* Dock inferior de vidrio */}
      <nav className="fixed inset-x-0 bottom-4 z-50 px-6">
        <div className="mx-auto flex max-w-md items-center justify-around rounded-3xl border border-white/12 bg-black/70 py-3 backdrop-blur-2xl">
          {[
            { label: "Inicio", icon: "🏠", href: "/previa/idea-4", active: true },
            { label: "Menú", icon: "🍔", href: "#menu", active: false },
            { label: "Pedidos", icon: "🛍️", href: "/mis-pedidos", active: false },
            { label: "Cuenta", icon: "👤", href: "/mis-pedidos", active: false },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
                item.active ? "text-[#f5a623]" : "text-white/60"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  )
}
