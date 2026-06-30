"use client";

import { useEffect, useMemo, useState } from "react";
import { Bike, MapPin, PackageCheck } from "lucide-react";
import { formatUSD } from "@/utils/formatCurrency";

type DeliveryZone = {
  name: string;
  costUSD: number;
  isActive?: boolean;
};

type PublicBusinessConfig = {
  deliveryEnabled?: boolean;
  deliveryModuleEnabled?: boolean;
  businessName?: string;
  productCardBackgroundColor?: string;
  productCardTextColor?: string;
  productCardBorderColor?: string;
  productCardButtonColor?: string;
};

type PublicBusinessConfigResponse = {
  businessConfig?: PublicBusinessConfig;
  config?: PublicBusinessConfig;
};

type DeliveryZonesResponse = {
  deliveryZones?: DeliveryZone[];
  module?: {
    effectiveEnabled?: boolean;
    lockedByPlan?: boolean;
    message?: string;
  };
};

const DEFAULT_STYLE_CONFIG: Required<
  Pick<
    PublicBusinessConfig,
    | "productCardBackgroundColor"
    | "productCardTextColor"
    | "productCardBorderColor"
    | "productCardButtonColor"
  >
> = {
  productCardBackgroundColor: "#ffffff",
  productCardTextColor: "#4a0000",
  productCardBorderColor: "#a00000",
  productCardButtonColor: "#ffd23c",
};

function getConfigPayload(value: PublicBusinessConfigResponse) {
  return value.businessConfig || value.config || {};
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const text = cleanText(value).toLowerCase();

  if (["false", "0", "no", "off", "disabled"].includes(text)) {
    return false;
  }

  if (["true", "1", "si", "sí", "on", "enabled"].includes(text)) {
    return true;
  }

  return fallback;
}

function normalizeConfig(value: PublicBusinessConfigResponse) {
  const source = getConfigPayload(value);

  return {
    deliveryEnabled: normalizeBoolean(source.deliveryEnabled, true),
    deliveryModuleEnabled: normalizeBoolean(source.deliveryModuleEnabled, true),
    businessName: cleanText(source.businessName),
    productCardBackgroundColor:
      cleanText(source.productCardBackgroundColor) ||
      DEFAULT_STYLE_CONFIG.productCardBackgroundColor,
    productCardTextColor:
      cleanText(source.productCardTextColor) ||
      DEFAULT_STYLE_CONFIG.productCardTextColor,
    productCardBorderColor:
      cleanText(source.productCardBorderColor) ||
      DEFAULT_STYLE_CONFIG.productCardBorderColor,
    productCardButtonColor:
      cleanText(source.productCardButtonColor) ||
      DEFAULT_STYLE_CONFIG.productCardButtonColor,
  };
}

function normalizeDeliveryZones(value: unknown): DeliveryZone[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();

  return value
    .map((zone) => ({
      name: cleanText(zone?.name),
      costUSD: Number(zone?.costUSD || 0),
      isActive: zone?.isActive !== false,
    }))
    .filter((zone) => {
      const key = zone.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (!zone.name || seen.has(key) || !Number.isFinite(zone.costUSD)) {
        return false;
      }

      seen.add(key);
      return zone.isActive !== false;
    })
    .sort((first, second) => first.costUSD - second.costUSD);
}

export default function PublicDeliveryZones() {
  const [config, setConfig] = useState(() =>
    normalizeConfig({ businessConfig: DEFAULT_STYLE_CONFIG }),
  );
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [moduleEnabled, setModuleEnabled] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadDeliveryPreview() {
      try {
        setIsLoading(true);

        const [configResponse, zonesResponse] = await Promise.all([
          fetch("/api/public/business-config", { cache: "no-store" }),
          fetch("/api/delivery-zones", { cache: "no-store" }),
        ]);

        const configData = configResponse.ok
          ? ((await configResponse.json()) as PublicBusinessConfigResponse)
          : ({
              businessConfig: DEFAULT_STYLE_CONFIG,
            } as PublicBusinessConfigResponse);
        const zonesData = zonesResponse.ok
          ? ((await zonesResponse.json()) as DeliveryZonesResponse)
          : ({ deliveryZones: [] } as DeliveryZonesResponse);

        if (ignore) return;

        const cleanConfig = normalizeConfig(configData);
        setConfig(cleanConfig);
        setModuleEnabled(zonesData.module?.effectiveEnabled !== false);
        setDeliveryZones(normalizeDeliveryZones(zonesData.deliveryZones));
      } catch {
        if (!ignore) {
          setDeliveryZones([]);
          setModuleEnabled(false);
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadDeliveryPreview();

    return () => {
      ignore = true;
    };
  }, []);

  const isDeliveryVisible =
    config.deliveryEnabled && config.deliveryModuleEnabled && moduleEnabled;

  const cheapestZone = useMemo(() => {
    return deliveryZones.length ? deliveryZones[0] : null;
  }, [deliveryZones]);

  if (!isDeliveryVisible && !isLoading) return null;
  if (!isLoading && deliveryZones.length === 0) return null;

  return (
    <section
      id="zonas-delivery"
      className="bg-[var(--brand-cream)] px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div
          className="overflow-hidden rounded-[2rem] border-2 shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.08)]"
          style={{
            backgroundColor: config.productCardBackgroundColor,
            borderColor: `${config.productCardBorderColor}55`,
            color: config.productCardTextColor,
          }}
        >
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="p-5 sm:p-7">
              <span
                className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em]"
                style={{
                  backgroundColor: config.productCardButtonColor,
                  borderColor: config.productCardBorderColor,
                  color: config.productCardTextColor,
                }}
              >
                <Bike size={15} />
                Delivery
              </span>

              <h2
                className="mt-4 text-3xl font-black uppercase leading-none sm:text-4xl"
                style={{ color: config.productCardBorderColor }}
              >
                Zonas y costos antes de pedir
              </h2>

              <p className="mt-3 max-w-xl text-sm font-bold leading-6 opacity-75 sm:text-base">
                Revisa las zonas activas de delivery. El costo se suma al total
                cuando eliges delivery en el carrito.
              </p>

              {cheapestZone ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] border-2 border-current/10 bg-white/70 px-4 py-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] opacity-65">
                      Desde
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {formatUSD(cheapestZone.costUSD)}
                    </p>
                  </div>
                  <a
                    href="#menu"
                    className="flex items-center justify-center rounded-[1.25rem] border-2 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] transition hover:brightness-105"
                    style={{
                      backgroundColor: config.productCardButtonColor,
                      borderColor: config.productCardBorderColor,
                      color: config.productCardTextColor,
                    }}
                  >
                    Ver menú
                  </a>
                </div>
              ) : null}
            </div>

            <div className="border-t-2 border-[var(--brand-primary)]/10 bg-[var(--brand-cream)] p-4 sm:p-5 lg:border-l-2 lg:border-t-0">
              {isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    "Cargando zonas",
                    "Calculando costos",
                    "Preparando delivery",
                    "Revisando cobertura",
                  ].map((label) => (
                    <div
                      key={label}
                      className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/10 bg-white px-4 py-4"
                    >
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                        {label}
                      </p>
                      <div className="mt-3 h-3 w-2/3 rounded-full bg-[var(--brand-primary)]/10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {deliveryZones.slice(0, 8).map((zone) => (
                    <div
                      key={zone.name}
                      className="flex items-center justify-between gap-3 rounded-[1.2rem] border-2 bg-white px-4 py-4"
                      style={{
                        borderColor: `${config.productCardBorderColor}22`,
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2"
                          style={{
                            backgroundColor: config.productCardButtonColor,
                            borderColor: config.productCardBorderColor,
                            color: config.productCardTextColor,
                          }}
                        >
                          <MapPin size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black uppercase">
                            {zone.name}
                          </span>
                          <span className="mt-0.5 block text-[0.68rem] font-bold uppercase tracking-[0.1em] opacity-60">
                            Zona activa
                          </span>
                        </span>
                      </span>
                      <span
                        className="shrink-0 rounded-full border-2 px-3 py-1.5 text-xs font-black"
                        style={{
                          borderColor: config.productCardBorderColor,
                          color: config.productCardBorderColor,
                        }}
                      >
                        {formatUSD(zone.costUSD)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && deliveryZones.length > 8 ? (
                <p className="mt-3 rounded-full bg-white px-4 py-2 text-center text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                  +{deliveryZones.length - 8} zona
                  {deliveryZones.length - 8 === 1 ? "" : "s"} más disponible
                  {deliveryZones.length - 8 === 1 ? "" : "s"} en el carrito
                </p>
              ) : null}

              {!isLoading && deliveryZones.length > 0 ? (
                <p className="mt-4 flex items-center gap-2 text-xs font-bold leading-5 opacity-70">
                  <PackageCheck size={15} className="shrink-0" />
                  El delivery se confirma con la dirección y referencia al
                  cerrar el pedido.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
