"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  HelpCircle,
  Home,
  MapPin,
  MessageCircle,
  Sparkles,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

type NavigatorConfig = {
  businessName?: string;
  mainWhatsapp?: string;
  deliveryEnabled?: boolean;
  deliveryModuleEnabled?: boolean;
  googleMapsUrl?: string;
  scheduleTitle?: string;
};

type PublicBusinessConfigResponse = {
  businessConfig?: NavigatorConfig;
  config?: NavigatorConfig;
};

const DEFAULT_NAVIGATOR_CONFIG: Required<NavigatorConfig> = {
  businessName: "",
  mainWhatsapp: "",
  deliveryEnabled: true,
  deliveryModuleEnabled: true,
  googleMapsUrl: "",
  scheduleTitle: "Horario",
};

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeNavigatorConfig(value: unknown): Required<NavigatorConfig> {
  const source =
    value && typeof value === "object" ? (value as NavigatorConfig) : {};

  return {
    businessName: cleanText(source.businessName),
    mainWhatsapp: cleanText(source.mainWhatsapp),
    deliveryEnabled: source.deliveryEnabled !== false,
    deliveryModuleEnabled: source.deliveryModuleEnabled !== false,
    googleMapsUrl: cleanText(source.googleMapsUrl),
    scheduleTitle: cleanText(source.scheduleTitle, "Horario"),
  };
}

function getBusinessConfigPayload(
  value: PublicBusinessConfigResponse,
): NavigatorConfig {
  return value.businessConfig || value.config || {};
}

function scrollToSection(targetId: string) {
  if (typeof window === "undefined") return;

  const element = document.getElementById(targetId);
  if (!element) return;

  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function PublicSectionNavigator() {
  const [config, setConfig] = useState(DEFAULT_NAVIGATOR_CONFIG);

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/public/business-config", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as PublicBusinessConfigResponse;
        const nextConfig = normalizeNavigatorConfig(
          getBusinessConfigPayload(data),
        );

        if (isMounted) setConfig(nextConfig);
      } catch {
        if (isMounted) setConfig(DEFAULT_NAVIGATOR_CONFIG);
      }
    }

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const items = useMemo(() => {
    const deliveryIsVisible =
      config.deliveryEnabled && config.deliveryModuleEnabled;

    return [
      {
        id: "inicio",
        label: "Inicio",
        detail: cleanText(config.businessName, "Portada"),
        icon: Home,
        visible: true,
      },
      {
        id: "atajos-menu",
        label: "Atajos",
        detail: "Lo más pedido",
        icon: Sparkles,
        visible: true,
      },
      {
        id: "menu",
        label: "Menú",
        detail: "Productos",
        icon: UtensilsCrossed,
        visible: true,
      },
      {
        id: "favoritos",
        label: "Favoritos",
        detail: "Guardados",
        icon: Heart,
        visible: true,
      },
      {
        id: "zonas-delivery",
        label: "Delivery",
        detail: "Costo por distancia",
        icon: Truck,
        visible: deliveryIsVisible,
      },
      {
        id: "ubicacion",
        label: "Ubicación",
        detail: config.googleMapsUrl ? "Cómo llegar" : config.scheduleTitle,
        icon: MapPin,
        visible: true,
      },
      {
        id: "preguntas",
        label: "Ayuda",
        detail: "Dudas rápidas",
        icon: HelpCircle,
        visible: true,
      },
      {
        id: "pedido-final",
        label: "Pedir",
        detail: config.mainWhatsapp ? "WhatsApp" : "Carrito",
        icon: MessageCircle,
        visible: true,
      },
    ].filter((item) => item.visible);
  }, [config]);

  return (
    <section className="sticky top-0 z-40 border-y-2 border-[var(--brand-primary)]/10 bg-[var(--brand-cream)]/95 px-3 py-3 shadow-[0_8px_22px_rgba(var(--brand-primary-rgb),0.08)] backdrop-blur md:top-0 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="group flex min-w-[132px] shrink-0 items-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white px-3 py-2.5 text-left text-[var(--brand-primary)] transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-current bg-[var(--brand-accent)] text-[var(--brand-ink)]">
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.68rem] font-black uppercase tracking-[0.12em]">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.64rem] font-bold text-[var(--brand-ink-2)]/55">
                    {item.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
