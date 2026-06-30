"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, MessageCircle, ShoppingBag } from "lucide-react";
import { BRAND } from "@/lib/brand";

type PublicFinalCtaConfig = {
  businessName: string;
  businessShortDescription: string;
  mainWhatsapp: string;
  deliveryWhatsapp: string;
  googleMapsUrl: string;
  locationButtonText: string;
  quickOrderTitle: string;
  quickOrderText: string;
  deliveryEnabled: boolean;
};

type PublicBusinessConfigResponse = {
  ok?: boolean;
  businessConfig?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

const DEFAULT_CONFIG: PublicFinalCtaConfig = {
  businessName: BRAND.name,
  businessShortDescription: BRAND.tagline,
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  googleMapsUrl: "",
  locationButtonText: "Ubicación",
  quickOrderTitle: "¿Listo para pedir?",
  quickOrderText:
    "Revisa el menú, arma tu carrito y confirma los detalles antes de enviar.",
  deliveryEnabled: true,
};

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return fallback;
}

function normalizeExternalUrl(value: unknown) {
  const text = cleanText(value);
  if (!text) return "";

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function buildWhatsappUrl(value: unknown) {
  const phone = normalizePhone(value);
  return phone ? `https://wa.me/${phone}` : "";
}

function getConfigPayload(value: PublicBusinessConfigResponse | null) {
  return value?.businessConfig || value?.config || {};
}

function normalizeConfig(value: unknown): PublicFinalCtaConfig {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    businessName: cleanText(source.businessName, DEFAULT_CONFIG.businessName),
    businessShortDescription: cleanText(
      source.businessShortDescription,
      DEFAULT_CONFIG.businessShortDescription,
    ),
    mainWhatsapp: normalizePhone(source.mainWhatsapp),
    deliveryWhatsapp: normalizePhone(source.deliveryWhatsapp),
    googleMapsUrl: normalizeExternalUrl(source.googleMapsUrl),
    locationButtonText: cleanText(
      source.locationButtonText,
      DEFAULT_CONFIG.locationButtonText,
    ),
    quickOrderTitle: cleanText(
      source.quickOrderTitle,
      DEFAULT_CONFIG.quickOrderTitle,
    ),
    quickOrderText: cleanText(
      source.quickOrderText,
      DEFAULT_CONFIG.quickOrderText,
    ),
    deliveryEnabled: normalizeBoolean(
      source.deliveryEnabled,
      DEFAULT_CONFIG.deliveryEnabled,
    ),
  };
}

export default function PublicFinalOrderCta() {
  const [config, setConfig] = useState<PublicFinalCtaConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/public/business-config", {
          cache: "no-store",
        });
        const data = (await response
          .json()
          .catch(() => null)) as PublicBusinessConfigResponse | null;

        if (!response.ok || !data?.ok || !isMounted) return;

        setConfig(normalizeConfig(getConfigPayload(data)));
      } catch {
        if (isMounted) setConfig(DEFAULT_CONFIG);
      }
    }

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const whatsappUrl = useMemo(
    () => buildWhatsappUrl(config.deliveryWhatsapp || config.mainWhatsapp),
    [config.deliveryWhatsapp, config.mainWhatsapp],
  );

  return (
    <section
      id="pedido-final"
      className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_14px_0_rgba(var(--brand-primary-rgb),0.18)]">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-6 sm:p-8">
            <p className="inline-flex rounded-full border-2 border-white/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-accent)]">
              Pedido rápido
            </p>
            <h2 className="mt-4 text-4xl font-black uppercase leading-none sm:text-5xl">
              {config.quickOrderTitle || "¿Listo para pedir?"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/80 sm:text-base">
              {config.quickOrderText || config.businessShortDescription}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#menu"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-accent)] bg-[var(--brand-accent)] px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
              >
                <ShoppingBag size={17} />
                Ver menú
              </a>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/35 bg-white/10 px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-white"
                >
                  <MessageCircle size={17} />
                  WhatsApp
                </a>
              ) : (
                <a
                  href="#como-pedir"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/35 bg-white/10 px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-white"
                >
                  <ArrowRight size={17} />
                  Cómo pedir
                </a>
              )}
              {config.googleMapsUrl ? (
                <a
                  href={config.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/35 bg-white/10 px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-white"
                >
                  <MapPin size={17} />
                  {config.locationButtonText}
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 bg-black/10 p-5 sm:grid-cols-3 lg:grid-cols-1 lg:p-6">
            {[
              ["1", "Elige", "Filtra, busca y selecciona productos."],
              ["2", "Personaliza", "Marca ingredientes o extras disponibles."],
              [
                "3",
                "Confirma",
                config.deliveryEnabled
                  ? "Escoge delivery, retiro o consumo local."
                  : "Revisa datos y confirma el pedido.",
              ],
            ].map(([number, title, text]) => (
              <div
                key={number}
                className="rounded-[1.4rem] border-2 border-white/20 bg-white/10 p-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-accent)] text-sm font-black text-[var(--brand-ink)]">
                  {number}
                </span>
                <p className="mt-3 text-sm font-black uppercase tracking-[0.12em] text-white">
                  {title}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-white/70">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
