"use client";

import { ArrowUpRight, ShoppingCart } from "lucide-react";
import { formatPublicUSD as formatUSD, formatVES } from "@/utils/formatCurrency";
import { usePublicCurrencySymbol } from "@/hooks/usePublicCurrencySymbol";

type PublicFloatingCartSummaryProps = {
  totalItems: number;
  totalPrice: number;
  exchangeRate: number;
  onOpenCart: () => void;
};

function scrollToMenu() {
  if (typeof window === "undefined") return;

  const element = document.getElementById("menu");
  if (!element) return;

  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function PublicFloatingCartSummary({
  totalItems,
  totalPrice,
  exchangeRate,
  onOpenCart,
}: PublicFloatingCartSummaryProps) {
  usePublicCurrencySymbol();

  if (totalItems <= 0) return null;

  const totalVES = totalPrice * exchangeRate;

  return (
    <div className="fixed inset-x-3 bottom-[5.7rem] z-[80] md:bottom-5 md:left-auto md:right-5 md:w-[390px]">
      <div className="overflow-hidden rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.16)]">
        <div className="flex items-center justify-between gap-3 bg-[var(--brand-primary)] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-accent)] text-black">
              <ShoppingCart size={17} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em]">
                Pedido en curso
              </p>
              <p className="text-[0.68rem] font-bold opacity-80">
                {totalItems} producto{totalItems === 1 ? "" : "s"} en el carrito
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={scrollToMenu}
            className="hidden rounded-full border border-white/30 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/90 transition hover:bg-white/10 sm:inline-flex"
          >
            Seguir viendo
          </button>
        </div>

        <div className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-2xl font-black leading-none text-[var(--brand-primary)]">
              {formatUSD(totalPrice)}
            </p>
            {exchangeRate > 0 ? (
              <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60">
                Ref. Bs {formatVES(totalVES)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.14)] transition active:translate-y-0.5"
          >
            Ver carrito
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
