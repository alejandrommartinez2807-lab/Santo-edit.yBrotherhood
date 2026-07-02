"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Clock,
  Flame,
  MessageCircle,
  PackageCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import {
  products as fallbackProducts,
  type Product,
  type ProductSalesChannel,
} from "@/data/products";
import { normalizePublicProducts } from "@/lib/publicProductNormalization";

type MenuCollectionFilter =
  | "all"
  | "featured"
  | "combo"
  | "customizable"
  | "fast"
  | "delivery";

type PublicProductsResponse = {
  products?: Product[];
  fallback?: boolean;
  warning?: string;
};

type PublicMenuCollectionsConfig = {
  businessName?: string;
  publicMenuEyebrow?: string;
  publicMenuTitle?: string;
  mainWhatsapp?: string;
  deliveryWhatsapp?: string;
  deliveryEnabled?: boolean;
  deliveryModuleEnabled?: boolean;
  productCardBackgroundColor?: string;
  productCardTextColor?: string;
  productCardBorderColor?: string;
  productCardButtonColor?: string;
};

type PublicBusinessConfigResponse = {
  ok?: boolean;
  businessConfig?: PublicMenuCollectionsConfig;
  config?: PublicMenuCollectionsConfig;
};

const DEFAULT_CONFIG: Required<
  Pick<
    PublicMenuCollectionsConfig,
    | "businessName"
    | "publicMenuEyebrow"
    | "publicMenuTitle"
    | "productCardBackgroundColor"
    | "productCardTextColor"
    | "productCardBorderColor"
    | "productCardButtonColor"
  >
> &
  Pick<
    PublicMenuCollectionsConfig,
    "mainWhatsapp" | "deliveryWhatsapp" | "deliveryEnabled" | "deliveryModuleEnabled"
  > = {
  businessName: BRAND.name,
  publicMenuEyebrow: `Menú ${BRAND.name}`,
  publicMenuTitle: "Elige tu pedido",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  deliveryEnabled: true,
  deliveryModuleEnabled: true,
  productCardBackgroundColor: "#ffffff",
  productCardTextColor: "#4a0000",
  productCardBorderColor: "#a00000",
  productCardButtonColor: "#ffd23c",
};

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function buildWhatsAppUrl(phone: string) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) return "";

  return `https://wa.me/${normalizedPhone}`;
}

function getBusinessConfigPayload(
  value: PublicBusinessConfigResponse,
): PublicMenuCollectionsConfig {
  return value.businessConfig || value.config || {};
}

function normalizeConfig(value: unknown): typeof DEFAULT_CONFIG {
  const source =
    value && typeof value === "object"
      ? (value as PublicMenuCollectionsConfig)
      : {};

  return {
    businessName: cleanText(source.businessName, DEFAULT_CONFIG.businessName),
    publicMenuEyebrow: cleanText(
      source.publicMenuEyebrow,
      DEFAULT_CONFIG.publicMenuEyebrow,
    ),
    publicMenuTitle: cleanText(
      source.publicMenuTitle,
      DEFAULT_CONFIG.publicMenuTitle,
    ),
    mainWhatsapp: normalizePhone(source.mainWhatsapp),
    deliveryWhatsapp: normalizePhone(source.deliveryWhatsapp),
    deliveryEnabled: source.deliveryEnabled !== false,
    deliveryModuleEnabled: source.deliveryModuleEnabled !== false,
    productCardBackgroundColor: cleanText(
      source.productCardBackgroundColor,
      DEFAULT_CONFIG.productCardBackgroundColor,
    ),
    productCardTextColor: cleanText(
      source.productCardTextColor,
      DEFAULT_CONFIG.productCardTextColor,
    ),
    productCardBorderColor: cleanText(
      source.productCardBorderColor,
      DEFAULT_CONFIG.productCardBorderColor,
    ),
    productCardButtonColor: cleanText(
      source.productCardButtonColor,
      DEFAULT_CONFIG.productCardButtonColor,
    ),
  };
}

function hasSelectablePublicOptions(product: Product) {
  return Boolean(
    (product.variations || []).length > 0 ||
      (product.addons || []).length > 0 ||
      (product.includedIngredients || []).length > 0 ||
      (product.removableIngredients || []).length > 0,
  );
}

function isComboPublicProduct(product: Product) {
  return product.category === "Combos" || product.productType === "combo";
}

function isFastPublicProduct(product: Product) {
  const minutes = Number(product.preparationMinutes || 0);

  return Number.isFinite(minutes) && minutes > 0 && minutes <= 15;
}

function hasSalesChannel(product: Product, channel: ProductSalesChannel) {
  return (product.salesChannels || []).includes(channel);
}

function dispatchMenuFilter(filter: MenuCollectionFilter) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("santo:menu-filter", {
      detail: { quickFilter: filter, category: "Todos" },
    }),
  );

  window.setTimeout(() => {
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
  }, 20);
}

export default function PublicMenuCollections() {
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [config, setConfig] = useState<typeof DEFAULT_CONFIG>(DEFAULT_CONFIG);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicCollections() {
      try {
        const [productsResponse, configResponse] = await Promise.all([
          fetch("/api/public/products", { cache: "no-store" }),
          fetch("/api/public/business-config", { cache: "no-store" }),
        ]);

        if (productsResponse.ok) {
          const productsData =
            (await productsResponse.json()) as PublicProductsResponse;
          const cleanProducts = normalizePublicProducts(productsData.products);

          if (isMounted && cleanProducts.length > 0) {
            setProducts(cleanProducts);
          }
        }

        if (configResponse.ok) {
          const configData =
            (await configResponse.json()) as PublicBusinessConfigResponse;

          if (isMounted) {
            setConfig(normalizeConfig(getBusinessConfigPayload(configData)));
          }
        }
      } catch {
        if (!isMounted) return;

        setProducts(fallbackProducts);
        setConfig(DEFAULT_CONFIG);
      }
    }

    loadPublicCollections();

    return () => {
      isMounted = false;
    };
  }, []);

  const whatsappUrl = buildWhatsAppUrl(
    config.deliveryWhatsapp || config.mainWhatsapp || "",
  );

  const collections = useMemo(() => {
    const featuredCount = products.filter((product) => product.isFeatured).length;
    const comboCount = products.filter(isComboPublicProduct).length;
    const customizableCount = products.filter(hasSelectablePublicOptions).length;
    const fastCount = products.filter(isFastPublicProduct).length;
    const deliveryCount = products.filter((product) =>
      hasSalesChannel(product, "delivery"),
    ).length;

    return [
      {
        key: "featured" as MenuCollectionFilter,
        title: "Destacados",
        detail: "Lo que quieres vender primero",
        count: featuredCount,
        icon: Flame,
      },
      {
        key: "combo" as MenuCollectionFilter,
        title: "Combos",
        detail: "Pedidos fáciles para grupos",
        count: comboCount,
        icon: PackageCheck,
      },
      {
        key: "customizable" as MenuCollectionFilter,
        title: "Elige ingredientes",
        detail: "Productos con opciones",
        count: customizableCount,
        icon: SlidersHorizontal,
      },
      {
        key: "fast" as MenuCollectionFilter,
        title: "Rápidos",
        detail: "Hasta 15 minutos aprox.",
        count: fastCount,
        icon: Clock,
      },
      {
        key: "delivery" as MenuCollectionFilter,
        title: "Para delivery",
        detail: "Disponibles para enviar",
        count: config.deliveryEnabled && config.deliveryModuleEnabled ? deliveryCount : 0,
        icon: Truck,
      },
    ].filter((collection) => collection.count > 0);
  }, [config.deliveryEnabled, config.deliveryModuleEnabled, products]);

  if (collections.length === 0) return null;

  const sectionStyle = {
    "--collection-card-bg": config.productCardBackgroundColor,
    "--collection-card-text": config.productCardTextColor,
    "--collection-card-border": config.productCardBorderColor,
    "--collection-card-button": config.productCardButtonColor,
  } as CSSProperties;

  return (
    <section
      id="atajos-menu"
      className="bg-[var(--brand-cream)] px-4 py-10 sm:px-6 lg:px-8"
      style={sectionStyle}
    >
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border-2 border-[var(--collection-card-border)] bg-[var(--collection-card-bg)] p-4 shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.10)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--collection-card-border)] bg-[var(--collection-card-button)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--collection-card-text)]">
              <Sparkles size={15} />
              Atajos del menú
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase leading-none text-[var(--collection-card-text)] sm:text-4xl">
              Encuentra rápido lo que quieres pedir
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[var(--collection-card-text)]/70">
              Usa estos accesos para saltar directo a destacados, combos, productos con ingredientes o delivery dentro del menú público.
            </p>
          </div>

          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full border-2 border-[var(--collection-card-border)] bg-[var(--collection-card-button)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--collection-card-text)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.12)] transition hover:brightness-105"
            >
              <MessageCircle size={17} />
              Preguntar por WhatsApp
            </a>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {collections.map((collection, index) => {
            const Icon = collection.icon;
            const featured = index === 0;

            return (
              <button
                key={collection.key}
                type="button"
                onClick={() => dispatchMenuFilter(collection.key)}
                className={`group rounded-[1.35rem] border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)] ${
                  featured
                    ? "border-[var(--collection-card-border)] bg-[var(--collection-card-button)] text-[var(--collection-card-text)]"
                    : "border-[var(--collection-card-border)]/25 bg-white/80 text-[var(--collection-card-text)] hover:border-[var(--collection-card-border)]"
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-current bg-white/70">
                  <Icon size={18} />
                </span>
                <span className="mt-4 block text-sm font-black uppercase tracking-[0.12em]">
                  {collection.title}
                </span>
                <span className="mt-1 block text-xs font-bold leading-5 opacity-70">
                  {collection.count} producto{collection.count === 1 ? "" : "s"} · {collection.detail}
                </span>
                <span className="mt-4 inline-flex rounded-full bg-white/75 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Ver en menú
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-[1.25rem] border-2 border-[var(--collection-card-border)]/20 bg-[var(--brand-cream)] px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--collection-card-text)]/75">
            Consejo: revisa el precio y las opciones antes de agregar al carrito. Los combos mantienen pago en divisas y los productos normales muestran referencia en Bs.
          </p>
        </div>
      </div>
    </section>
  );
}
