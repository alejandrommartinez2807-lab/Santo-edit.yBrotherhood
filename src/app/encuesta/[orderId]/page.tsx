"use client"

// Encuesta post-venta pública: el cliente llega con el link de su pedido
// (por WhatsApp, manual o automático), califica con estrellas 1–5 los
// aspectos que configuró el dueño y deja una sugerencia libre. Una sola
// respuesta por pedido.

import { use, useEffect, useState } from "react"
import Image from "next/image"
import { CheckCircle2, Loader2, Send, Star } from "lucide-react"
import { BRAND } from "@/lib/brand"

type SurveyInfo = {
  businessName: string
  displayNumber: string
  customerName: string
  aspects: string[]
  alreadyAnswered: boolean
}

function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          aria-label={`${star} estrella${star > 1 ? "s" : ""}`}
          className="rounded-lg p-1 transition active:scale-90"
        >
          <Star
            size={34}
            className={
              star <= value
                ? "fill-amber-400 text-amber-500"
                : "text-[var(--brand-ink-2)]/25"
            }
          />
        </button>
      ))}
    </div>
  )
}

export default function EncuestaPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = use(params)
  const cleanOrderId = String(orderId || "").trim().toLowerCase()

  const [info, setInfo] = useState<SurveyInfo | null>(null)
  const [loadError, setLoadError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch(
          `/api/public/survey?pedido=${encodeURIComponent(cleanOrderId)}`,
          { cache: "no-store" },
        )
        const data = await response.json().catch(() => ({}))

        if (cancelled) return

        if (!response.ok || !data.ok) {
          setLoadError(String(data.error || "No se pudo cargar la encuesta"))
          return
        }

        setInfo({
          businessName: String(data.businessName || BRAND.name),
          displayNumber: String(data.displayNumber || ""),
          customerName: String(data.customerName || ""),
          aspects: Array.isArray(data.aspects) ? data.aspects : [],
          alreadyAnswered: data.alreadyAnswered === true,
        })
      } catch {
        if (!cancelled) setLoadError("No se pudo cargar la encuesta")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [cleanOrderId])

  async function submitSurvey() {
    if (isSubmitting) return

    const hasRating = Object.values(ratings).some((value) => value >= 1)

    if (!hasRating && !comment.trim()) {
      setSubmitError("Califica al menos un aspecto o escribe una sugerencia.")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      const response = await fetch("/api/public/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: cleanOrderId, ratings, comment }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.ok) {
        if (data.alreadyAnswered) {
          setIsDone(true)
          return
        }
        throw new Error(String(data.error || "No se pudo guardar tu respuesta"))
      }

      setIsDone(true)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo guardar tu respuesta",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const businessName = info?.businessName || BRAND.name

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
        <div className="h-5 bg-[linear-gradient(90deg,var(--brand-primary),var(--brand-accent))]" />

        <div className="px-6 py-6">
          <Image
            src={BRAND.logoUrl || "/logoremovebg.png"}
            alt={businessName}
            width={88}
            height={88}
            unoptimized
            className="mx-auto h-22 w-22 object-contain"
          />

          <p className="mt-4 text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">
            {businessName}
          </p>

          {isLoading ? (
            <p className="mt-8 flex items-center justify-center gap-2 pb-6 text-sm font-bold text-[var(--brand-ink-2)]/70">
              <Loader2 size={18} className="animate-spin" />
              Cargando encuesta…
            </p>
          ) : loadError ? (
            <p className="mt-6 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-4 text-center text-sm font-bold text-red-700">
              {loadError}
            </p>
          ) : isDone || info?.alreadyAnswered ? (
            <div className="mt-6 pb-2 text-center">
              <CheckCircle2 size={44} className="mx-auto text-green-600" />
              <h1 className="mt-3 text-2xl font-black uppercase leading-tight">
                ¡Gracias por tu opinión!
              </h1>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                {isDone && !info?.alreadyAnswered
                  ? "Tu respuesta quedó guardada. Nos ayuda muchísimo a mejorar."
                  : "Esta encuesta ya fue respondida. ¡Gracias de nuevo!"}
              </p>
            </div>
          ) : (
            <>
              <h1 className="mt-2 text-center text-2xl font-black uppercase leading-tight">
                ¿Qué tal estuvo tu pedido
                {info?.displayNumber ? ` ${info.displayNumber}` : ""}?
              </h1>

              <p className="mt-2 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                {info?.customerName ? `${info.customerName}, tu` : "Tu"} opinión
                nos ayuda a mejorar. Toma menos de un minuto.
              </p>

              <div className="mt-5 space-y-4">
                {(info?.aspects || []).map((aspect) => (
                  <div
                    key={aspect}
                    className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3"
                  >
                    <p className="text-sm font-black text-[var(--brand-ink-3)]">
                      {aspect}
                    </p>
                    <div className="mt-1.5">
                      <StarRating
                        value={ratings[aspect] || 0}
                        onChange={(value) =>
                          setRatings((current) => ({ ...current, [aspect]: value }))
                        }
                      />
                    </div>
                  </div>
                ))}

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                    Sugerencias u opiniones (opcional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="¿Qué podemos mejorar? ¿Qué te encantó?"
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/40 focus:border-[var(--brand-primary)]"
                  />
                </div>

                {submitError && (
                  <p className="rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {submitError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void submitSurvey()}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={19} className="animate-spin" />
                  ) : (
                    <Send size={19} />
                  )}
                  Enviar mi opinión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
