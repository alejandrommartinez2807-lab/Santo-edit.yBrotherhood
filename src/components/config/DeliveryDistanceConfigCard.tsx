"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, Route, Save, Trash2 } from "lucide-react";
import {
  DEFAULT_DELIVERY_DISTANCE_SETTINGS,
  type DeliveryDistanceSettings,
  type DeliveryDistanceTier,
} from "@/lib/deliveryDistance";

// Tarjeta "Envío por distancia" dentro de Configuración → Zonas de delivery.
// Es autónoma (carga y guarda contra /api/delivery-distance con la clave del
// dueño) para no engordar el monolito de la página de configuración.

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session";

type TierDraft = { upToKm: string; costUSD: string };

function readStoredPassword() {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(ADMIN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function tiersToDrafts(tiers: DeliveryDistanceTier[]): TierDraft[] {
  if (!tiers.length) {
    return DEFAULT_DELIVERY_DISTANCE_SETTINGS.tiers.map((tier) => ({
      upToKm: String(tier.upToKm),
      costUSD: String(tier.costUSD),
    }));
  }

  return tiers.map((tier) => ({
    upToKm: String(tier.upToKm),
    costUSD: String(tier.costUSD),
  }));
}

function draftsToTiers(drafts: TierDraft[]) {
  return drafts
    .map((draft) => ({
      upToKm: Number(String(draft.upToKm).replace(",", ".")),
      costUSD: Number(String(draft.costUSD).replace(",", ".")),
    }))
    .filter(
      (tier) =>
        Number.isFinite(tier.upToKm) &&
        tier.upToKm > 0 &&
        Number.isFinite(tier.costUSD) &&
        tier.costUSD >= 0,
    );
}

export default function DeliveryDistanceConfigCard({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [originMapsUrl, setOriginMapsUrl] = useState("");
  const [hasOrigin, setHasOrigin] = useState(false);
  const [roadFactor, setRoadFactor] = useState(
    String(DEFAULT_DELIVERY_DISTANCE_SETTINGS.roadFactor),
  );
  const [tierDrafts, setTierDrafts] = useState<TierDraft[]>(() =>
    tiersToDrafts([]),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadSettings() {
      try {
        setIsLoading(true);

        const response = await fetch("/api/delivery-distance", {
          cache: "no-store",
          headers: { "x-admin-password": readStoredPassword() },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "No se pudo cargar el envío por distancia");
        }

        if (ignore) return;

        const settings = (data.settings || {}) as DeliveryDistanceSettings;
        setEnabled(settings.enabled === true);
        setOriginMapsUrl(String(settings.originMapsUrl || ""));
        setHasOrigin(settings.originLat !== null && settings.originLng !== null);
        setRoadFactor(
          String(settings.roadFactor || DEFAULT_DELIVERY_DISTANCE_SETTINGS.roadFactor),
        );
        setTierDrafts(tiersToDrafts(Array.isArray(settings.tiers) ? settings.tiers : []));
      } catch (error) {
        if (!ignore) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el envío por distancia",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadSettings();

    return () => {
      ignore = true;
    };
  }, []);

  async function saveSettings(nextEnabled = enabled) {
    try {
      setIsSaving(true);
      setMessage(null);
      setErrorMessage(null);

      const response = await fetch("/api/delivery-distance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": readStoredPassword(),
        },
        body: JSON.stringify({
          settings: {
            enabled: nextEnabled,
            originMapsUrl: originMapsUrl.trim(),
            // Las coordenadas las resuelve el servidor desde el link: si el
            // dueño cambió el link, se recalculan al guardar.
            originLat: null,
            originLng: null,
            roadFactor: Number(String(roadFactor).replace(",", ".")),
            tiers: draftsToTiers(tierDrafts),
          },
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar el envío por distancia");
      }

      const settings = (data.settings || {}) as DeliveryDistanceSettings;
      setEnabled(settings.enabled === true);
      setHasOrigin(settings.originLat !== null && settings.originLng !== null);
      setTierDrafts(tiersToDrafts(Array.isArray(settings.tiers) ? settings.tiers : []));
      setMessage(
        settings.enabled
          ? "Envío por distancia guardado. El carrito ya cotiza con el link del cliente."
          : "Envío por distancia guardado (desactivado).",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el envío por distancia",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updateTierDraft(index: number, patch: Partial<TierDraft>) {
    setTierDrafts((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, ...patch } : tier,
      ),
    );
  }

  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/20 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          <Route size={16} />
          Envío por distancia (km)
        </p>

        <label className="flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-2">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canEdit || isLoading || isSaving}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-5 w-5 accent-[var(--brand-primary)] disabled:cursor-not-allowed"
          />
          <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
            {enabled ? "Activo" : "Inactivo"}
          </span>
        </label>
      </div>

      <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
        El cliente pega el link de Google Maps de su casa en el carrito y el
        costo se calcula solo por kilómetros (por ejemplo: hasta 10 km → $6).
        Las zonas de arriba quedan como respaldo si el cliente no tiene link.
      </p>

      {isLoading ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-ink-2)]/60">
          <Loader2 size={16} className="animate-spin" />
          Cargando envío por distancia…
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Link de Google Maps de tu local
            </label>
            <input
              value={originMapsUrl}
              onChange={(event) => setOriginMapsUrl(event.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              disabled={!canEdit || isSaving}
              className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-2 inline-flex items-center gap-1.5 text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/60">
              <MapPin size={13} className="shrink-0" />
              {hasOrigin
                ? "Ubicación del local detectada. Si te mudas, pega el link nuevo y guarda."
                : "Abre Google Maps, busca tu local, toca Compartir y pega aquí el link."}
            </p>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Rangos de precio
            </p>

            {tierDrafts.map((tier, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
              >
                <label className="flex items-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-2.5">
                  <span className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60">
                    Hasta
                  </span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={tier.upToKm}
                    disabled={!canEdit || isSaving}
                    onChange={(event) =>
                      updateTierDraft(index, { upToKm: event.target.value })
                    }
                    className="w-full bg-transparent text-sm font-black text-[var(--brand-ink)] outline-none disabled:cursor-not-allowed"
                  />
                  <span className="text-[0.62rem] font-black uppercase text-[var(--brand-ink-2)]/60">
                    km
                  </span>
                </label>

                <label className="flex items-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-2.5">
                  <span className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={tier.costUSD}
                    disabled={!canEdit || isSaving}
                    onChange={(event) =>
                      updateTierDraft(index, { costUSD: event.target.value })
                    }
                    className="w-full bg-transparent text-sm font-black text-[var(--brand-ink)] outline-none disabled:cursor-not-allowed"
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setTierDrafts((current) =>
                      current.filter((_, tierIndex) => tierIndex !== index),
                    )
                  }
                  disabled={!canEdit || isSaving || tierDrafts.length <= 1}
                  className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)]/30 bg-white p-2.5 text-[var(--brand-primary)] transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Quitar rango"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setTierDrafts((current) => [...current, { upToKm: "", costUSD: "" }])
              }
              disabled={!canEdit || isSaving || tierDrafts.length >= 12}
              className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} />
              Agregar rango
            </button>

            <p className="text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
              Más allá del último rango no se cotiza: el cliente ve que está
              fuera de cobertura y se le invita a coordinar por WhatsApp.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
            <label className="flex items-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-2.5">
              <span className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60">
                Factor de ruta
              </span>
              <input
                type="number"
                min="1"
                max="2"
                step="0.05"
                value={roadFactor}
                disabled={!canEdit || isSaving}
                onChange={(event) => setRoadFactor(event.target.value)}
                className="w-full bg-transparent text-sm font-black text-[var(--brand-ink)] outline-none disabled:cursor-not-allowed"
              />
            </label>
            <p className="text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
              La distancia se mide en línea recta; este factor la ajusta a la
              ruta real del repartidor. 1.3 funciona bien en ciudad.
            </p>
          </div>

          {message && (
            <p className="rounded-2xl border-2 border-emerald-600/40 bg-emerald-50 px-4 py-3 text-sm font-black leading-5 text-emerald-700">
              {message}
            </p>
          )}

          {errorMessage && (
            <p className="rounded-2xl border-2 border-red-500/40 bg-red-50 px-4 py-3 text-sm font-black leading-5 text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={() => saveSettings()}
            disabled={!canEdit || isSaving || isLoading}
            className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Guardar envío por distancia
          </button>
        </div>
      )}
    </div>
  );
}
