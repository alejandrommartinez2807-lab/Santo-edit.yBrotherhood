import Link from "next/link"
import { XCircle } from "lucide-react"

export default function PagoCanceladoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <section className="w-full max-w-md rounded-[2rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] p-8 text-center shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)]">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-cream)] text-[var(--brand-primary)]">
          <XCircle size={34} />
        </span>
        <h1 className="mt-4 text-2xl font-black uppercase text-[var(--brand-ink-3)]">Pago cancelado</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
          No se completó el pago. Puedes intentarlo de nuevo o pagar en el local.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-black"
        >
          Volver al menú
        </Link>
      </section>
    </main>
  )
}
