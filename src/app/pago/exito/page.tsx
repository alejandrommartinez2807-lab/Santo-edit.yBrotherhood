import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

export default function PagoExitoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <section className="w-full max-w-md rounded-[2rem] border-4 border-emerald-600 bg-[var(--brand-surface-2)] p-8 text-center shadow-[0_12px_0_rgba(5,150,105,0.12)]">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={34} />
        </span>
        <h1 className="mt-4 text-2xl font-black uppercase text-[var(--brand-ink-3)]">¡Pago recibido!</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
          Tu pago se procesó correctamente. El negocio ya verá tu pedido como pagado.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
        >
          Volver al menú
        </Link>
      </section>
    </main>
  )
}
