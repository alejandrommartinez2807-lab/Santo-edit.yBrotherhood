"use client";

import { ArrowRight, CheckCircle2, ReceiptText, ShoppingCart, Sparkles } from "lucide-react";

type PublicOrderReadinessPanelProps = {
  totalItems: number;
  totalPrice: number;
  exchangeRate: number;
  onOpenCart: () => void;
};

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatVes(value: number) {
  return `Bs ${value.toFixed(2)}`;
}

export default function PublicOrderReadinessPanel({
  totalItems,
  totalPrice,
  exchangeRate,
  onOpenCart,
}: PublicOrderReadinessPanelProps) {
  const hasItems = totalItems > 0;
  const vesReference = totalPrice * exchangeRate;

  return (
    <section className="bg-[var(--brand-cream)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_9px_0_rgba(var(--brand-primary-rgb),0.10)]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
          <div className="p-5 sm:p-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              <Sparkles size={15} /> Pedido guiado
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] sm:text-4xl">
              {hasItems ? "Tu pedido va tomando forma" : "Arma tu pedido sin perderte"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
              {hasItems
                ? "Revisa cantidades, ingredientes y subtotal antes de confirmar. Puedes seguir explorando el menú sin perder lo agregado."
                : "Usa los filtros por categoría, precio, rapidez o personalización para llegar al producto correcto antes de abrir el carrito."}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["1", "Elige productos", "Filtra por recomendados, precio o rapidez."],
                ["2", "Personaliza", "Revisa ingredientes, extras y notas."],
                ["3", "Confirma", "Abre el carrito y registra el pedido."],
              ].map(([step, title, text]) => (
                <div
                  key={step}
                  className="rounded-[1.25rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-black text-white">
                    {step}
                  </span>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                    {title}
                  </p>
                  <p className="mt-1 text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t-2 border-[var(--brand-primary)]/15 bg-[var(--brand-primary)] p-5 text-white lg:border-l-2 lg:border-t-0">
            <div className="rounded-[1.5rem] border-2 border-white/25 bg-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--brand-primary)]">
                  <ShoppingCart size={22} />
                </span>
                <span className="rounded-full bg-[var(--brand-accent)] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]">
                  {hasItems ? "En progreso" : "Vacío"}
                </span>
              </div>

              <p className="mt-5 text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/70">
                Resumen rápido
              </p>
              <p className="mt-1 text-4xl font-black leading-none">
                {totalItems} producto{totalItems === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-sm font-bold text-white/75">
                Total estimado: {formatUsd(totalPrice)} · {formatVes(vesReference)} referencia
              </p>

              <button
                type="button"
                onClick={onOpenCart}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent)]"
              >
                {hasItems ? "Revisar carrito" : "Abrir carrito"}
                <ArrowRight size={16} />
              </button>

              <a
                href="#menu"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/45 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/10"
              >
                Seguir viendo menú
              </a>
            </div>

            <div className="mt-4 grid gap-2 text-[0.72rem] font-bold text-white/80">
              <p className="flex items-center gap-2">
                <CheckCircle2 size={15} /> Puedes editar cantidades antes de confirmar.
              </p>
              <p className="flex items-center gap-2">
                <ReceiptText size={15} /> El total final se revisa en el carrito.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
