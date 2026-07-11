"use client";

import { ArrowRight, Clock, DollarSign, Heart, MapPin, SlidersHorizontal, Sparkles } from "lucide-react";

type MenuFilterDetail = {
  quickFilter?: "favorites" | "featured" | "customizable" | "fast" | "delivery";
  priceFilter?: "budget" | "mid" | "premium";
};

function applyMenuFilter(detail: MenuFilterDetail) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent("santo:menu-filter", { detail }));
  window.location.hash = "menu";
}

const DECISION_CARDS = [
  {
    title: "Ya tengo favoritos",
    text: "Muestra solo los productos guardados en este navegador.",
    action: "Ver favoritos",
    icon: Heart,
    detail: { quickFilter: "favorites" },
  },
  {
    title: "No sé qué pedir",
    text: "Muestra primero lo recomendado para decidir rápido.",
    action: "Ver recomendados",
    icon: Sparkles,
    detail: { quickFilter: "featured" },
  },
  {
    title: "Quiero algo rápido",
    text: "Filtra productos con preparación aproximada de hasta 15 minutos.",
    action: "Ver rápidos",
    icon: Clock,
    detail: { quickFilter: "fast" },
  },
  {
    title: "Busco algo económico",
    text: "Ordena la vista hacia opciones de menor precio sin perder el carrito.",
    action: "Ver económicos",
    icon: DollarSign,
    detail: { priceFilter: "budget" },
  },
  {
    title: "Quiero personalizar",
    text: "Abre productos con ingredientes, extras o variaciones disponibles.",
    action: "Elige ingredientes",
    icon: SlidersHorizontal,
    detail: { quickFilter: "customizable" },
  },
  {
    title: "Necesito delivery",
    text: "Revisa productos disponibles para enviar y comparte tu ubicación.",
    action: "Ver delivery",
    icon: MapPin,
    detail: { quickFilter: "delivery" },
  },
] as const;

export default function PublicMenuDecisionHelp() {
  return (
    <section
      id="decidir-pedido"
      className="bg-[var(--brand-cream)] px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl rounded-[2rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              Ayuda para decidir
            </p>
            <h2 className="mt-3 text-2xl font-black uppercase leading-none text-[var(--brand-primary)] sm:text-3xl">
              Encuentra tu pedido más rápido
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
              Estos accesos solo cambian la vista del menú público. El carrito se mantiene igual y puedes limpiar filtros cuando quieras.
            </p>
          </div>
          <a
            href="#menu"
            className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white"
          >
            Ir al menú <ArrowRight size={16} />
          </a>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {DECISION_CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <button
                key={card.title}
                type="button"
                onClick={() => applyMenuFilter(card.detail)}
                className="rounded-[1.35rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4 text-left text-[var(--brand-primary)] transition hover:border-[var(--brand-primary)]/60 hover:bg-[var(--brand-accent-100)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-current bg-white">
                  <Icon size={18} />
                </span>
                <span className="mt-3 block text-xs font-black uppercase tracking-[0.12em]">
                  {card.title}
                </span>
                <span className="mt-1 block text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/65">
                  {card.text}
                </span>
                <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                  {card.action}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
