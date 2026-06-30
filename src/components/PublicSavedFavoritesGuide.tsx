"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Heart, ListChecks, Trash2 } from "lucide-react";

const PUBLIC_MENU_FAVORITES_STORAGE_KEY = "santo-public-menu-favorites";

type FavoritesChangedEvent = CustomEvent<{ favoriteProductIds?: number[] }>;

function readFavoriteIds() {
  if (typeof window === "undefined") return [] as number[];

  try {
    const rawFavorites = window.localStorage.getItem(
      PUBLIC_MENU_FAVORITES_STORAGE_KEY,
    );
    const parsedFavorites = rawFavorites ? JSON.parse(rawFavorites) : [];

    if (!Array.isArray(parsedFavorites)) return [];

    return parsedFavorites
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0);
  } catch {
    return [];
  }
}

function dispatchFavoritesFilter() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("santo:menu-filter", {
      detail: { quickFilter: "favorites", category: "Todos" },
    }),
  );

  window.setTimeout(() => {
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
  }, 20);
}

function clearFavorites() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(PUBLIC_MENU_FAVORITES_STORAGE_KEY);
  } catch {
    // Si el navegador bloquea localStorage, no detenemos la página pública.
  }

  window.dispatchEvent(
    new CustomEvent("santo:favorites-changed", {
      detail: { favoriteProductIds: [] },
    }),
  );
}

export default function PublicSavedFavoritesGuide() {
  const [favoriteCount, setFavoriteCount] = useState(0);

  useEffect(() => {
    function syncFavorites() {
      setFavoriteCount(readFavoriteIds().length);
    }

    function handleFavoritesChanged(event: Event) {
      const detail = (event as FavoritesChangedEvent).detail;

      if (Array.isArray(detail?.favoriteProductIds)) {
        setFavoriteCount(detail.favoriteProductIds.length);
        return;
      }

      syncFavorites();
    }

    syncFavorites();
    window.addEventListener("storage", syncFavorites);
    window.addEventListener("santo:favorites-changed", handleFavoritesChanged);

    return () => {
      window.removeEventListener("storage", syncFavorites);
      window.removeEventListener(
        "santo:favorites-changed",
        handleFavoritesChanged,
      );
    };
  }, []);

  return (
    <section
      id="favoritos"
      className="bg-[var(--brand-cream)] px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.45fr)]">
        <div className="rounded-[2rem] border-2 border-[var(--brand-primary)] bg-white p-5 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)] sm:p-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
            <Heart size={15} /> Favoritos del cliente
          </p>
          <h2 className="mt-3 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] sm:text-4xl">
            Guarda lo que quieres pedir otra vez
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
            Cada cliente puede marcar productos como favoritos desde este navegador.
            Es útil para repetir pedidos, comparar opciones y volver rápido a lo
            que más le gustó sin tocar datos internos del negocio.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Marca favoritos", "Usa el botón de la tarjeta del producto."],
              ["2", "Filtra el menú", "Abre solo lo guardado cuando quieras."],
              ["3", "Confirma normal", "El carrito y el pedido siguen igual."],
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

        <div className="rounded-[2rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] p-5 text-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)] sm:p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-ink)]">
            <ListChecks size={22} />
          </span>
          <p className="mt-5 text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/70">
            Guardados en este navegador
          </p>
          <p className="mt-1 text-5xl font-black leading-none">
            {favoriteCount}
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-white/75">
            {favoriteCount > 0
              ? "Puedes ver solo tus favoritos o limpiar esta selección local."
              : "Aún no hay favoritos. Marca uno desde el menú para activar esta vista."}
          </p>

          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={dispatchFavoritesFilter}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent)]"
            >
              Ver favoritos
              <ArrowRight size={16} />
            </button>
            {favoriteCount > 0 ? (
              <button
                type="button"
                onClick={clearFavorites}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/45 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/10"
              >
                Limpiar favoritos
                <Trash2 size={15} />
              </button>
            ) : (
              <a
                href="#menu"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/45 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/10"
              >
                Ir al menú
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
