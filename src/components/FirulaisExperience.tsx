"use client"

import { useRef, type ReactNode } from "react"
import { motion, useScroll, useTransform, type MotionValue } from "motion/react"
import { ArrowDown, CheckCircle2, Flame, Sparkles } from "lucide-react"

function ImageLayer({
  progress,
  start,
  end,
  src,
  alt,
  className,
  fromY = -90,
  fromScale = 0.92,
  fromRotate = 0,
}: {
  progress: MotionValue<number>
  start: number
  end: number
  src: string
  alt: string
  className: string
  fromY?: number
  fromScale?: number
  fromRotate?: number
}) {
  const opacity = useTransform(progress, [start, end], [0, 1])
  const y = useTransform(progress, [start, end], [fromY, 0])
  const scale = useTransform(progress, [start, end], [fromScale, 1])
  const rotate = useTransform(progress, [start, end], [fromRotate, 0])

  return (
    <motion.img
      src={src}
      alt={alt}
      style={{ opacity, y, scale, rotate, x: "-50%" }}
      className={className}
      draggable={false}
    />
  )
}

function SauceLayer({
  progress,
  start,
  end,
  src,
  alt,
  className,
  fromX = -70,
}: {
  progress: MotionValue<number>
  start: number
  end: number
  src: string
  alt: string
  className: string
  fromX?: number
}) {
  const opacity = useTransform(progress, [start, end], [0, 1])
  const x = useTransform(progress, [start, end], [fromX, 0])
  const scaleX = useTransform(progress, [start, end], [0.65, 1])

  return (
    <motion.img
      src={src}
      alt={alt}
      style={{ opacity, x, scaleX }}
      className={className}
      draggable={false}
    />
  )
}

function TextStep({
  children,
  progress,
  start,
  end,
}: {
  children: ReactNode
  progress: MotionValue<number>
  start: number
  end: number
}) {
  const opacity = useTransform(progress, [start, end], [0.35, 1])
  const scale = useTransform(progress, [start, end], [0.98, 1])

  return (
    <motion.div
      style={{ opacity, scale }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
    >
      {children}
    </motion.div>
  )
}

export default function FirulaisExperience() {
  const sectionRef = useRef<HTMLDivElement | null>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })

  const cardScale = useTransform(scrollYProgress, [0, 1], [0.96, 1])
  const glowOpacity = useTransform(scrollYProgress, [0.4, 1], [0.08, 0.3])

  const finalOpacity = useTransform(scrollYProgress, [0.76, 0.92], [0, 1])
  const finalScale = useTransform(scrollYProgress, [0.76, 0.92], [0.9, 1])

  const completeOpacity = useTransform(scrollYProgress, [0.86, 1], [0, 1])
  const completeScale = useTransform(scrollYProgress, [0.86, 1], [0.92, 1])

  return (
    <section id="firulais" className="relative bg-black text-white">
      <div
        ref={sectionRef}
        className="relative h-[210vh] bg-[linear-gradient(to_bottom,#000,#050505,#000)]"
      >
        <div className="sticky top-16 flex min-h-screen items-center px-4 py-8 sm:px-6">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[0.88fr_1.12fr]">
            <motion.div
              initial={{ opacity: 0, x: -35 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <p className="mb-4 text-xs font-black uppercase tracking-[0.35em] text-yellow-400 sm:text-sm">
                Producto estrella
              </p>

              <h2 className="text-5xl font-black uppercase leading-[0.88] tracking-[-0.08em] sm:text-7xl">
                El Firulais se{" "}
                <span className="bg-gradient-to-r from-[var(--brand-accent)] via-orange-400 to-red-500 bg-clip-text text-transparent">
                  arma en vivo
                </span>
              </h2>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                Baja por la página y mira cómo se construye por capas: caja,
                pan, salchicha, queso, papitas, topping y salsas. Esto lo hace
                sentir como un producto premium, no como un perro común.
              </p>

              <div className="mt-8 grid gap-3">
                <TextStep progress={scrollYProgress} start={0.02} end={0.18}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-black">
                      <Flame size={20} />
                    </div>

                    <div>
                      <p className="text-sm font-black uppercase text-white">
                        Base caliente
                      </p>
                      <p className="text-sm text-zinc-400">
                        Caja, pan tostado y salchicha premium.
                      </p>
                    </div>
                  </div>
                </TextStep>

                <TextStep progress={scrollYProgress} start={0.25} end={0.52}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-black">
                      <Sparkles size={20} />
                    </div>

                    <div>
                      <p className="text-sm font-black uppercase text-white">
                        Toppings reales
                      </p>
                      <p className="text-sm text-zinc-400">
                        Queso fundido, papitas crunchy y tocineta.
                      </p>
                    </div>
                  </div>
                </TextStep>

                <TextStep progress={scrollYProgress} start={0.58} end={0.84}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-black">
                      <CheckCircle2 size={20} />
                    </div>

                    <div>
                      <p className="text-sm font-black uppercase text-white">
                        Acabado BC
                      </p>
                      <p className="text-sm text-zinc-400">
                        Salsas y presentación final lista para vender.
                      </p>
                    </div>
                  </div>
                </TextStep>
              </div>

              <a
                href="#menu"
                className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-red-600 to-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-[0.18em] text-black shadow-xl shadow-red-950/40 transition hover:-translate-y-1 active:scale-[0.97]"
              >
                Pedir el Firulais
              </a>
            </motion.div>

            <motion.div style={{ scale: cardScale }} className="relative">
              <div className="relative overflow-hidden rounded-[2rem] border border-red-900/50 bg-zinc-950 p-4 shadow-2xl shadow-red-950/30 sm:p-6">
                <motion.div
                  style={{ opacity: glowOpacity }}
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.24),transparent_45%)]"
                />

                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">
                      Scroll animation
                    </p>

                    <h3 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-white sm:text-4xl">
                      Armado premium
                    </h3>
                  </div>

                  <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="rounded-full bg-white/10 p-3 text-yellow-400"
                  >
                    <ArrowDown size={20} />
                  </motion.div>
                </div>

                <div className="relative min-h-[450px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#060606] sm:min-h-[580px]">
                  <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.16)_1px,transparent_0)] [background-size:18px_18px]" />

                  <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/90 to-transparent px-6 py-5">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
                      Baja para ver el armado
                    </p>
                  </div>

                  <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-red-600/10 blur-3xl" />
                  <div className="absolute left-1/2 bottom-16 h-72 w-72 -translate-x-1/2 rounded-full bg-yellow-400/10 blur-3xl" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative h-[370px] w-full max-w-[560px] sm:h-[460px]">
                      <ImageLayer
                        progress={scrollYProgress}
                        start={0.02}
                        end={0.12}
                        src="/caja-burger-club.png"
                        alt="Caja Burger Club"
                        fromY={120}
                        fromScale={0.88}
                        className="absolute bottom-[14px] left-1/2 z-10 w-[520px] max-w-[94%] select-none object-contain drop-shadow-2xl"
                      />

                      <ImageLayer
                        progress={scrollYProgress}
                        start={0.10}
                        end={0.22}
                        src="/pan-base.png"
                        alt="Pan tostado"
                        fromY={95}
                        fromScale={0.9}
                        className="absolute bottom-[96px] left-1/2 z-20 w-[430px] max-w-[84%] select-none object-contain drop-shadow-2xl"
                      />

                      <ImageLayer
                        progress={scrollYProgress}
                        start={0.20}
                        end={0.32}
                        src="/salchicha.png"
                        alt="Salchicha premium"
                        fromY={-130}
                        fromRotate={-4}
                        className="absolute bottom-[137px] left-1/2 z-30 w-[390px] max-w-[78%] select-none object-contain drop-shadow-2xl"
                      />

                      <ImageLayer
                        progress={scrollYProgress}
                        start={0.32}
                        end={0.45}
                        src="/queso-fundido.png"
                        alt="Queso fundido"
                        fromY={-120}
                        fromRotate={5}
                        className="absolute bottom-[173px] left-1/2 z-40 w-[370px] max-w-[78%] select-none object-contain drop-shadow-xl"
                      />

                      <ImageLayer
                        progress={scrollYProgress}
                        start={0.45}
                        end={0.58}
                        src="/papitas-crunchy.png"
                        alt="Papitas crunchy"
                        fromY={-150}
                        fromRotate={-5}
                        className="absolute bottom-[184px] left-1/2 z-50 w-[390px] max-w-[82%] select-none object-contain drop-shadow-2xl"
                      />

                      <ImageLayer
                        progress={scrollYProgress}
                        start={0.55}
                        end={0.68}
                        src="/topping-tocineta.png"
                        alt="Topping de tocineta"
                        fromY={-150}
                        fromRotate={6}
                        className="absolute bottom-[220px] left-1/2 z-[55] w-[340px] max-w-[72%] select-none object-contain drop-shadow-xl"
                      />

                      <SauceLayer
                        progress={scrollYProgress}
                        start={0.64}
                        end={0.76}
                        src="/salsa-roja.png"
                        alt="Salsa roja"
                        className="absolute bottom-[202px] left-[23%] z-[60] w-[330px] max-w-[62%] select-none object-contain drop-shadow-xl"
                      />

                      <SauceLayer
                        progress={scrollYProgress}
                        start={0.69}
                        end={0.81}
                        src="/salsa-blanca.png"
                        alt="Salsa blanca"
                        className="absolute bottom-[224px] left-[25%] z-[61] w-[330px] max-w-[62%] select-none object-contain drop-shadow-xl"
                        fromX={70}
                      />

                      <SauceLayer
                        progress={scrollYProgress}
                        start={0.73}
                        end={0.85}
                        src="/salsa-amarilla.png"
                        alt="Salsa amarilla"
                        className="absolute bottom-[238px] left-[27%] z-[62] w-[320px] max-w-[60%] select-none object-contain drop-shadow-xl"
                      />

                      <motion.img
                        src="/firulais-completo.png"
                        alt="Firulais con Clase completo"
                        style={{
                          opacity: completeOpacity,
                          scale: completeScale,
                          x: "-50%",
                        }}
                        className="absolute bottom-[96px] left-1/2 z-[70] w-[470px] max-w-[88%] select-none object-contain drop-shadow-2xl"
                        draggable={false}
                      />

                      <motion.div
                        style={{
                          opacity: finalOpacity,
                          scale: finalScale,
                          x: "-50%",
                        }}
                        className="absolute bottom-0 left-1/2 z-[80] flex items-center gap-3 rounded-2xl bg-yellow-400 px-5 py-3 text-black shadow-xl shadow-yellow-950/30"
                      >
                        <CheckCircle2 size={22} />

                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.22em]">
                            Firulais listo
                          </p>
                          <p className="text-lg font-black">
                            Antojo desbloqueado
                          </p>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
