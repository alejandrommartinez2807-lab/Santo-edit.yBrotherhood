"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { BRAND } from "@/lib/brand";
import {
  Check,
  Flame,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { formatPublicUSD as formatUSD, formatVES } from "@/utils/formatCurrency";
import { usePublicCurrencySymbol } from "@/hooks/usePublicCurrencySymbol";
import type { ProductToAdd } from "@/hooks/useCart";
import type { Product } from "@/data/products";
import {
  type SelectableOption,
  type VariationGroupView,
  cleanNumber,
  getProductType,
  getSalesChannels,
  normalizeSelectionRules,
  formatSelectedOption,
  flattenAddonOptions,
  flattenIngredientOptions,
  readVariationGroups,
} from "@/components/productCardHelpers";

type ProductCardPublicLabels = {
  customizeAction?: string;
  customizerTitle?: string;
};

type ProductCardProps = Product & {
  exchangeRate: number;
  index?: number;
  onAddToCart: (product: ProductToAdd) => void;
  publicLabels?: ProductCardPublicLabels;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: number) => void;
  // El enlace directo #producto-<id> abre la ficha SOLO en la tarjeta del
  // menú (los destacados repiten producto y abrirían la ficha dos veces).
  deepLinkEnabled?: boolean;
  // Tamaño elegido en Configuración: "grande" (original), "media" (2 por
  // fila en móvil) o "compacta" (3 por fila, estilo catálogo).
  cardSize?: string;
};

// Clases por tamaño: media y compacta encogen foto, textos y botón para que
// quepan más productos por fila sin romper el diseño. compactBadges apila
// todas las etiquetas en una sola columna pequeña (en tarjetas angostas las
// esquinas izquierda/derecha se montaban una sobre otra).
const CARD_SIZE_STYLES = {
  grande: {
    image: "h-56 sm:h-64",
    body: "p-5",
    title: "text-[1.6rem] leading-[0.95] sm:text-3xl",
    showDescription: true,
    description: "mt-2 min-h-[44px] text-sm",
    priceRow: "mt-4 pt-4",
    price: "text-[1.7rem]",
    reference: "text-xs sm:text-sm",
    button: "mt-4 gap-2.5 px-4 py-3.5 text-sm",
    buttonIcon: 18,
    showBadges: true,
    compactBadges: false,
    showPriceInButton: true,
    shortButtonLabels: false,
  },
  media: {
    image: "h-32 sm:h-44",
    body: "p-3",
    title: "text-base leading-tight sm:text-xl",
    showDescription: true,
    description: "mt-1.5 min-h-0 line-clamp-2 text-xs",
    priceRow: "mt-2.5 pt-2.5",
    price: "text-xl",
    reference: "text-[0.62rem] sm:text-xs",
    button: "mt-2.5 gap-1.5 px-2 py-2.5 text-[0.7rem]",
    buttonIcon: 15,
    showBadges: true,
    compactBadges: true,
    showPriceInButton: false,
    shortButtonLabels: false,
  },
  compacta: {
    image: "h-24 sm:h-32",
    body: "p-2",
    title: "text-[0.78rem] leading-tight sm:text-sm",
    showDescription: false,
    description: "",
    priceRow: "mt-1.5 pt-1.5",
    price: "text-sm sm:text-base",
    reference: "hidden",
    button: "mt-1.5 gap-1 px-1 py-2 text-[0.6rem]",
    buttonIcon: 13,
    showBadges: false,
    compactBadges: true,
    showPriceInButton: false,
    shortButtonLabels: true,
  },
} as const;

function getCardSizeStyles(cardSize: string | undefined) {
  if (cardSize === "media") return CARD_SIZE_STYLES.media;
  if (cardSize === "compacta") return CARD_SIZE_STYLES.compacta;
  return CARD_SIZE_STYLES.grande;
}

const DEFAULT_CUSTOMIZE_ACTION_LABEL = "Elige tus ingredientes";

function cleanPublicLabel(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

function ChoiceButton({
  label,
  detail,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-black transition ${
        selected
          ? "border-[var(--brand-primary)] bg-[rgba(var(--brand-primary-rgb),0.14)] text-[var(--brand-ink-3)]"
          : disabled
            ? "cursor-not-allowed border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink-2)]/40"
            : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[rgba(var(--brand-primary-rgb),0.6)]"
      }`}
    >
      <span>
        <span className="block uppercase leading-tight">{label}</span>
        {detail ? (
          <span className="mt-0.5 block text-[0.68rem] font-bold uppercase tracking-normal text-[var(--brand-primary)]">
            {detail}
          </span>
        ) : null}
      </span>
      {selected ? (
        <Check size={16} className="shrink-0 text-[var(--brand-primary)]" />
      ) : null}
    </button>
  );
}

function AddonChoice({
  option,
  selected,
  quantity,
  disabled,
  onToggle,
  onIncrease,
  onDecrease,
}: {
  option: SelectableOption;
  selected: boolean;
  quantity: number;
  disabled: boolean;
  onToggle: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const maxQuantity = Math.max(1, option.maxQuantity || 1);
  const canIncrease = selected && quantity < maxQuantity && !disabled;

  return (
    <div
      className={`rounded-2xl border p-3 transition ${
        selected
          ? "border-[var(--brand-primary)] bg-[rgba(var(--brand-primary-rgb),0.1)]"
          : disabled
            ? "border-[var(--brand-border)] bg-[var(--brand-surface-2)] opacity-50"
            : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] hover:border-[rgba(var(--brand-primary-rgb),0.6)]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!selected && disabled}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-xs font-black uppercase leading-tight text-[var(--brand-ink)]">
            {option.name}
          </span>
          {option.detail ? (
            <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-normal text-[var(--brand-primary)]">
              {option.detail}
            </span>
          ) : null}
        </span>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            selected
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-black"
              : "border-[var(--brand-border)] bg-black/40 text-transparent"
          }`}
        >
          <Check size={14} />
        </span>
      </button>

      {selected ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-black/40 px-3 py-2">
          <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]">
            Cantidad
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDecrease}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)] transition hover:border-[var(--brand-primary)]"
              aria-label={`Bajar cantidad de ${option.name}`}
            >
              <Minus size={14} />
            </button>
            <span className="min-w-6 text-center text-sm font-black text-[var(--brand-ink-3)]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={onIncrease}
              disabled={!canIncrease}
              className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                canIncrease
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-black"
                  : "cursor-not-allowed border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink-2)]/30"
              }`}
              aria-label={`Subir cantidad de ${option.name}`}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ProductCard({
  id,
  name,
  category,
  description,
  price,
  image,
  isFeatured,
  exchangeRate,
  index = 0,
  onAddToCart,
  paymentMode,
  productType: productTypeValue,
  salesChannels,
  variations,
  addons,
  removableIngredients,
  selectionRules,
  requiresWaiterConfirmation,
  ivaRate,
  publicLabels,
  isFavorite = false,
  onToggleFavorite,
  deepLinkEnabled = true,
  cardSize,
}: ProductCardProps) {
  usePublicCurrencySymbol();
  const sizeStyles = getCardSizeStyles(cardSize);
  const [added, setAdded] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  // Ficha del producto: se abre al tocar la foto o el título (imagen grande +
  // descripción completa + botón de elegir ingredientes). Pedido del cliente.
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  // Selección por grupo de variaciones (estilo BOMBASTYC: burger, tipo de
  // molla, refresco…). key del grupo → keys de opciones elegidas.
  const [selectedVariationKeys, setSelectedVariationKeys] = useState<
    Record<string, string[]>
  >({});
  const [selectedAddonKeys, setSelectedAddonKeys] = useState<string[]>([]);
  const [addonQuantities, setAddonQuantities] = useState<
    Record<string, number>
  >({});
  const [removedIngredientKeys, setRemovedIngredientKeys] = useState<string[]>(
    [],
  );

  const customizeActionLabel = cleanPublicLabel(
    publicLabels?.customizeAction,
    DEFAULT_CUSTOMIZE_ACTION_LABEL,
  );
  const customizerTitle = cleanPublicLabel(
    publicLabels?.customizerTitle,
    customizeActionLabel,
  );
  const productType = getProductType(productTypeValue, category);
  const normalizedChannels = getSalesChannels(salesChannels);
  const ruleSettings = useMemo(
    () => normalizeSelectionRules(selectionRules),
    [selectionRules],
  );
  const isCombo =
    paymentMode === "divisa" ||
    productType === "combo" ||
    category === "Combos";
  const variationGroups = useMemo(
    () => readVariationGroups(variations),
    [variations],
  );
  const selectableAddons = useMemo(() => flattenAddonOptions(addons), [addons]);
  const selectableRemovableIngredients = useMemo(
    () => flattenIngredientOptions(removableIngredients),
    [removableIngredients],
  );
  const maxAddons = ruleSettings.maxAddons;
  const minAddons = ruleSettings.minAddons;
  const selectedVariationOptions = variationGroups.flatMap((group) =>
    group.options.filter((option) =>
      (selectedVariationKeys[group.key] || []).includes(option.key),
    ),
  );
  const variationsPrice = selectedVariationOptions.reduce(
    (sum, option) => sum + Number(option.priceDelta || 0),
    0,
  );
  // Compatibilidad con el carrito/pedidos: una sola "variación" que resume
  // todas las secciones elegidas (el detalle por grupo va en selectionSummary).
  const selectedVariation =
    selectedVariationOptions.length === 0
      ? null
      : selectedVariationOptions.length === 1
        ? selectedVariationOptions[0]
        : {
            name: selectedVariationOptions
              .map((option) => option.name)
              .join(" · "),
            priceDelta: variationsPrice,
          };
  const selectedAddons = selectableAddons
    .filter((option) => selectedAddonKeys.includes(option.key))
    .map((option) => ({
      ...option,
      quantity: Math.max(
        1,
        Math.round(cleanNumber(addonQuantities[option.key]) || 1),
      ),
    }));
  const removedIngredientsForCart = selectableRemovableIngredients.filter(
    (option) => removedIngredientKeys.includes(option.key),
  );
  const selectedAddonUnitCount = selectedAddons.reduce(
    (sum, option) => sum + Math.max(1, Number(option.quantity || 1)),
    0,
  );
  const selectedAddonTotalPrice = selectedAddons.reduce(
    (sum, option) =>
      sum +
      Number(option.priceDelta || 0) *
        Math.max(1, Number(option.quantity || 1)),
    0,
  );
  const optionsPrice = variationsPrice + selectedAddonTotalPrice;
  const finalUnitPrice = Math.max(0, price + optionsPrice);
  const finalVES = finalUnitPrice * exchangeRate;
  const hasAddonLimit = maxAddons > 0;
  const reachedAddonLimit =
    hasAddonLimit && selectedAddonUnitCount >= maxAddons;
  const selectedExtrasLabel =
    selectedAddonUnitCount === 1
      ? "1 adicional"
      : `${selectedAddonUnitCount} adicionales`;
  // Modelo de dos niveles (estilo Pizzería 007): los ingredientes sin costo
  // (priceDelta <= 0) se manejan como "incluidos", y los que suman al precio
  // como "adicionales con costo". El límite y los toggles son los mismos.
  const includedAddons = selectableAddons.filter(
    (option) => Number(option.priceDelta || 0) <= 0,
  );
  const paidAddons = selectableAddons.filter(
    (option) => Number(option.priceDelta || 0) > 0,
  );
  const remainingAddonChoices = hasAddonLimit
    ? Math.max(0, maxAddons - selectedAddonUnitCount)
    : 0;
  const hasSelectableOptions =
    variationGroups.length > 0 ||
    selectableAddons.length > 0 ||
    selectableRemovableIngredients.length > 0;

  function resetMessage() {
    if (formMessage) setFormMessage("");
  }

  function getAddonQuantity(key: string) {
    return Math.max(1, Math.round(cleanNumber(addonQuantities[key]) || 1));
  }

  function canAddAddonUnits(unitsToAdd: number) {
    return !hasAddonLimit || selectedAddonUnitCount + unitsToAdd <= maxAddons;
  }

  function toggleAddon(option: SelectableOption) {
    resetMessage();

    setSelectedAddonKeys((currentKeys) => {
      const exists = currentKeys.includes(option.key);

      if (exists) {
        setAddonQuantities((currentQuantities) => {
          const nextQuantities = { ...currentQuantities };
          delete nextQuantities[option.key];
          return nextQuantities;
        });

        return currentKeys.filter((item) => item !== option.key);
      }

      if (!canAddAddonUnits(1)) {
        setFormMessage(
          `Puedes escoger máximo ${maxAddons} adicionales en este producto.`,
        );
        return currentKeys;
      }

      setAddonQuantities((currentQuantities) => ({
        ...currentQuantities,
        [option.key]: 1,
      }));

      return [...currentKeys, option.key];
    });
  }

  function increaseAddon(option: SelectableOption) {
    resetMessage();

    if (!selectedAddonKeys.includes(option.key)) return;

    const currentQuantity = getAddonQuantity(option.key);
    const maxQuantity = Math.max(1, option.maxQuantity || 1);

    if (currentQuantity >= maxQuantity) {
      setFormMessage(
        `${option.name} permite máximo ${maxQuantity} por producto.`,
      );
      return;
    }

    if (!canAddAddonUnits(1)) {
      setFormMessage(
        `Puedes escoger máximo ${maxAddons} adicionales en este producto.`,
      );
      return;
    }

    setAddonQuantities((currentQuantities) => ({
      ...currentQuantities,
      [option.key]: currentQuantity + 1,
    }));
  }

  function decreaseAddon(option: SelectableOption) {
    resetMessage();

    const currentQuantity = getAddonQuantity(option.key);

    if (currentQuantity <= 1) {
      setSelectedAddonKeys((currentKeys) =>
        currentKeys.filter((item) => item !== option.key),
      );
      setAddonQuantities((currentQuantities) => {
        const nextQuantities = { ...currentQuantities };
        delete nextQuantities[option.key];
        return nextQuantities;
      });
      return;
    }

    setAddonQuantities((currentQuantities) => ({
      ...currentQuantities,
      [option.key]: currentQuantity - 1,
    }));
  }

  function toggleVariationOption(
    group: VariationGroupView,
    option: SelectableOption,
  ) {
    resetMessage();

    setSelectedVariationKeys((current) => {
      const keys = current[group.key] || [];
      const isSelected = keys.includes(option.key);

      if (group.multiple) {
        if (isSelected) {
          return {
            ...current,
            [group.key]: keys.filter((key) => key !== option.key),
          };
        }

        if (group.maxSelections > 0 && keys.length >= group.maxSelections) {
          return current;
        }

        return { ...current, [group.key]: [...keys, option.key] };
      }

      if (isSelected) {
        // En grupos obligatorios de una sola opción no se permite quedar vacío.
        return group.required
          ? current
          : { ...current, [group.key]: [] };
      }

      return { ...current, [group.key]: [option.key] };
    });
  }

  function clearVariationGroup(group: VariationGroupView) {
    resetMessage();
    setSelectedVariationKeys((current) => ({ ...current, [group.key]: [] }));
  }

  function toggleRemovedIngredient(key: string) {
    resetMessage();

    setRemovedIngredientKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function buildSelectionSummary() {
    const parts: string[] = [];

    variationGroups.forEach((group) => {
      const chosen = group.options.filter((option) =>
        (selectedVariationKeys[group.key] || []).includes(option.key),
      );

      if (chosen.length > 0) {
        parts.push(
          `${group.name || "Variación"}: ${chosen
            .map(formatSelectedOption)
            .join(", ")}`,
        );
      }
    });

    if (selectedAddons.length > 0) {
      parts.push(
        `Adicionales: ${selectedAddons.map(formatSelectedOption).join(", ")}`,
      );
    }

    if (removedIngredientsForCart.length > 0) {
      parts.push(
        `Sin: ${removedIngredientsForCart.map((option) => option.name).join(", ")}`,
      );
    }

    if (requiresWaiterConfirmation || ruleSettings.requiresStaffReview) {
      parts.push("Requiere confirmación del personal");
    }

    return parts.join(" · ");
  }

  function handleAddToCart() {
    for (const group of variationGroups) {
      const selectedCount = (selectedVariationKeys[group.key] || []).length;
      const requiredCount = group.required
        ? Math.max(1, group.minSelections)
        : 0;

      if (selectedCount < requiredCount) {
        setFormMessage(
          group.name
            ? `Elige ${group.name} antes de agregar este producto.`
            : "Elige una variación antes de agregar este producto.",
        );
        return;
      }
    }

    if (minAddons > 0 && selectedAddonUnitCount < minAddons) {
      setFormMessage(
        `Escoge al menos ${minAddons} adicionales para este producto.`,
      );
      return;
    }

    onAddToCart({
      id,
      name,
      category,
      price: finalUnitPrice,
      basePrice: price,
      unitOptionsPrice: Math.max(0, finalUnitPrice - price),
      image,
      paymentMode: isCombo ? "divisa" : paymentMode || "mixto",
      productType,
      selectedVariation,
      selectedAddons,
      removedIngredients: removedIngredientsForCart,
      selectionSummary: buildSelectionSummary(),
      requiresWaiterConfirmation: Boolean(
        requiresWaiterConfirmation || ruleSettings.requiresStaffReview,
      ),
      salesChannels: normalizedChannels,
      ivaRate: ivaRate ?? null,
    });

    setFormMessage("");
    setIsCustomizerOpen(false);
    setAdded(true);

    setTimeout(() => {
      setAdded(false);
    }, 900);
  }

  function handleMainAction() {
    if (hasSelectableOptions) {
      setFormMessage("");
      setIsCustomizerOpen(true);
      return;
    }

    handleAddToCart();
  }

  function closeCustomizer() {
    setFormMessage("");
    setIsCustomizerOpen(false);
  }

  function openDetail() {
    setIsDetailOpen(true);
  }

  function closeDetail() {
    setIsDetailOpen(false);
  }

  // Enlace directo al producto: #producto-<id> abre esta ficha (sirve para
  // compartir un producto por WhatsApp o redes).
  useEffect(() => {
    if (!deepLinkEnabled) return;

    function checkHash() {
      if (window.location.hash === `#producto-${id}`) {
        setIsDetailOpen(true);
      }
    }

    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, [id, deepLinkEnabled]);


  return (
    <>
      <motion.article
        id={deepLinkEnabled ? `producto-${id}` : undefined}
        layout
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.96 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.2) }}
        whileHover={{ y: -6 }}
        className="group relative flex flex-col overflow-hidden rounded-[1.6rem] border border-[var(--product-card-border)] bg-[var(--product-card-bg)] transition-colors duration-300 hover:border-[rgba(var(--brand-primary-rgb),0.6)] hover:shadow-[0_24px_60px_-30px_rgba(var(--brand-primary-rgb),0.5)]"
      >
        <div
          className={`relative overflow-hidden bg-black ${sizeStyles.image}`}
        >
          {/* Tocar la foto abre la ficha completa del producto. */}
          <motion.img
            src={image || BRAND.logoUrl || "/logoremovebg.png"}
            alt={name}
            className="h-full w-full cursor-pointer object-cover"
            whileHover={{ scale: 1.06 }}
            transition={{ duration: 0.45 }}
            onClick={openDetail}
            onError={(event) => {
              event.currentTarget.src = "/logoremovebg.png";
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

          {/* Destello que recorre la foto al pasar el mouse (solo decorativo). */}
          <span className="pointer-events-none absolute inset-y-0 left-[-60%] w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:left-[120%] group-hover:opacity-100" />

          {sizeStyles.showBadges && sizeStyles.compactBadges ? (
            // En tarjetas angostas solo se muestra "Top ventas": la categoría
            // ya se ve en los filtros del menú y "Solo divisas" repite el
            // "Pago en divisas" que va junto al precio. Menos ruido en la foto.
            isFeatured ? (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--product-card-button)] px-2 py-1 text-[0.52rem] font-black uppercase tracking-[0.08em] text-black shadow-lg shadow-black/40">
                <Flame size={10} />
                Top ventas
              </span>
            ) : null
          ) : sizeStyles.showBadges ? (
            <>
              <span className="absolute left-4 top-4 rounded-full border border-[rgba(var(--brand-primary-rgb),0.5)] bg-black/70 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--product-card-button)] backdrop-blur-sm">
                {category}
              </span>

              <div className="absolute right-4 top-4 flex max-w-[58%] flex-col items-end gap-2">
                {isFeatured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--product-card-button)] px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-black shadow-lg shadow-black/40">
                    <Flame size={13} />
                    Top ventas
                  </span>
                ) : null}

                {isCombo ? (
                  <span className="rounded-full border border-[rgba(var(--brand-primary-rgb),0.5)] bg-black/70 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--product-card-button)] backdrop-blur-sm">
                    Solo divisas
                  </span>
                ) : null}
              </div>
            </>
          ) : null}

          {onToggleFavorite && sizeStyles.showBadges ? (
            <button
              type="button"
              onClick={() => onToggleFavorite(id)}
              className={`absolute flex items-center justify-center rounded-full border backdrop-blur-sm transition active:scale-90 ${
                sizeStyles.compactBadges
                  ? "bottom-2 right-2 h-8 w-8"
                  : "bottom-3 right-4 h-10 w-10"
              } ${
                isFavorite
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-black"
                  : "border-white/25 bg-black/60 text-white hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              }`}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite
                  ? `Quitar ${name} de favoritos`
                  : `Guardar ${name} como favorito`
              }
            >
              <Heart
                size={sizeStyles.compactBadges ? 14 : 17}
                fill={isFavorite ? "currentColor" : "none"}
              />
            </button>
          ) : null}
        </div>

        <div className={`flex flex-1 flex-col ${sizeStyles.body}`}>
          {/* Tocar el título también abre la ficha completa. */}
          <h3
            className={`font-display uppercase text-[var(--product-card-text)] ${sizeStyles.title}`}
          >
            <button
              type="button"
              onClick={openDetail}
              className="text-left uppercase transition hover:text-[var(--product-card-button)]"
            >
              {name}
            </button>
          </h3>

          {sizeStyles.showDescription && (
            <div className="flex-1">
              <p
                className={`font-medium leading-relaxed text-[var(--product-card-text)] opacity-65 ${sizeStyles.description}`}
              >
                {description}
              </p>
              {String(description || "").trim().length > 80 ? (
                <button
                  type="button"
                  onClick={openDetail}
                  className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--product-card-button)] transition hover:brightness-110"
                >
                  Leer más
                </button>
              ) : null}
            </div>
          )}

          <div
            className={`flex items-end justify-between gap-3 border-t border-[var(--product-card-border)] ${sizeStyles.priceRow}`}
          >
            <div>
              <p
                className={`font-black leading-none text-[var(--product-card-button)] ${sizeStyles.price}`}
              >
                {formatUSD(finalUnitPrice)}
              </p>
              {optionsPrice !== 0 ? (
                <p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--product-card-text)] opacity-55">
                  Base {formatUSD(price)}
                </p>
              ) : null}
            </div>

            <p
              className={`pb-0.5 text-right font-black uppercase tracking-[0.08em] text-[var(--product-card-text)] opacity-55 ${sizeStyles.reference}`}
            >
              {isCombo ? "Pago en divisas" : `Bs ${formatVES(finalVES)}`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleMainAction}
            className={`flex w-full items-center justify-center rounded-xl font-black uppercase tracking-[0.06em] transition active:scale-[0.98] ${sizeStyles.button} ${
              added
                ? "bg-green-500 text-white"
                : "bg-[var(--product-card-button)] text-black shadow-[0_12px_30px_-12px_rgba(var(--brand-primary-rgb),0.7)] hover:brightness-110"
            }`}
          >
            {added ? (
              <>
                <ShoppingCart size={sizeStyles.buttonIcon} />
                Agregado
              </>
            ) : (
              <>
                {hasSelectableOptions ? (
                  <SlidersHorizontal size={sizeStyles.buttonIcon} />
                ) : (
                  <ShoppingCart size={sizeStyles.buttonIcon} />
                )}
                {hasSelectableOptions
                  ? sizeStyles.shortButtonLabels
                    ? "Elegir"
                    : customizeActionLabel
                  : sizeStyles.showPriceInButton
                    ? `Agregar · ${formatUSD(finalUnitPrice)}`
                    : "Agregar"}
              </>
            )}
          </button>
        </div>
      </motion.article>

      {isDetailOpen ? (
        // Ficha del producto: imagen grande + descripción completa + acción.
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/80 px-3 py-4 backdrop-blur-sm sm:items-center"
          onClick={closeDetail}
        >
          <div
            className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.8rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDetail}
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              aria-label="Cerrar ficha del producto"
            >
              <X size={22} />
            </button>

            <div className="overflow-y-auto">
              <div className="relative bg-black">
                <Image
                  src={image || BRAND.logoUrl || "/logoremovebg.png"}
                  alt={name}
                  width={960}
                  height={640}
                  unoptimized
                  className="h-64 w-full object-cover sm:h-96"
                  onError={(event) => {
                    event.currentTarget.src = "/logoremovebg.png";
                  }}
                />
                <span className="absolute left-4 top-4 rounded-full border border-[rgba(var(--brand-primary-rgb),0.5)] bg-black/70 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)] backdrop-blur-sm">
                  {category}
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <h3 className="font-display text-3xl uppercase leading-[0.95] text-[var(--brand-ink-3)] sm:text-4xl">
                  {name}
                </h3>

                {String(description || "").trim() ? (
                  <p className="mt-3 text-sm font-medium leading-7 text-[var(--brand-ink-2)] sm:text-base">
                    {description}
                  </p>
                ) : null}

                <div className="mt-5 flex items-end justify-between gap-3 border-t border-[var(--brand-border)] pt-4">
                  <p className="text-3xl font-black leading-none text-[var(--brand-primary)]">
                    {formatUSD(finalUnitPrice)}
                  </p>
                  <p className="pb-0.5 text-right text-sm font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)]/60">
                    {isCombo ? "Pago en divisas" : `Bs ${formatVES(finalVES)}`}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeDetail();
                      handleMainAction();
                    }}
                    className="flex flex-1 items-center justify-center gap-2.5 rounded-xl bg-[var(--brand-primary)] px-4 py-3.5 text-sm font-black uppercase tracking-[0.06em] text-black shadow-[0_12px_30px_-12px_rgba(var(--brand-primary-rgb),0.7)] transition hover:brightness-110 active:scale-[0.98]"
                  >
                    {hasSelectableOptions ? (
                      <>
                        <SlidersHorizontal size={18} />
                        {customizeActionLabel}
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={18} />
                        Agregar · {formatUSD(finalUnitPrice)}
                      </>
                    )}
                  </button>

                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {hasSelectableOptions && isCustomizerOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.8rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--brand-border)] bg-black/40 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
                  {customizerTitle}
                </p>
                <h3 className="font-display mt-1 text-2xl uppercase leading-none text-[var(--brand-ink-3)] sm:text-3xl">
                  {name}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCustomizer}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                aria-label="Cerrar personalización"
              >
                <X size={22} />
              </button>
            </div>

            <div className="grid overflow-y-auto lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="border-b border-[var(--brand-border)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
                <div className="overflow-hidden rounded-[1.4rem] border border-[var(--brand-border)] bg-black">
                  <Image
                    src={image || BRAND.logoUrl || "/logoremovebg.png"}
                    alt={name}
                    width={640}
                    height={288}
                    unoptimized
                    className="h-56 w-full object-cover sm:h-72"
                    onError={(event) => {
                      event.currentTarget.src = "/logoremovebg.png";
                    }}
                  />
                  <div className="p-4">
                    <span className="inline-flex rounded-full border border-[rgba(var(--brand-primary-rgb),0.5)] bg-black/60 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      {customizerTitle}
                    </span>
                    <p className="mt-3 text-sm font-medium leading-6 text-[var(--brand-ink-2)]">
                      {description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]">
                      Base
                    </p>
                    <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">
                      {formatUSD(price)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--brand-primary)] px-4 py-3 text-right text-black">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em]">
                      Final
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {formatUSD(finalUnitPrice)}
                    </p>
                    {!isCombo ? (
                      <p className="text-xs font-black">
                        Bs {formatVES(finalVES)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                {variationGroups.map((group) => {
                  const groupKeys = selectedVariationKeys[group.key] || [];

                  return (
                    <div
                      key={group.key}
                      className="rounded-[1.4rem] border border-[var(--brand-border)] bg-black/30 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                            {group.name || "Elige presentación"}
                          </p>
                          {group.required ? (
                            <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                              {group.multiple && group.minSelections > 1
                                ? `Elige al menos ${group.minSelections}.`
                                : "Esta selección es obligatoria."}
                            </p>
                          ) : null}
                          {group.multiple && group.maxSelections > 0 ? (
                            <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                              Elegidos: {groupKeys.length}/{group.maxSelections}
                            </p>
                          ) : null}
                        </div>
                        {group.required ? (
                          <span className="rounded-full bg-[var(--brand-cream)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                            Obligatoria
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {!group.required && !group.multiple ? (
                          <ChoiceButton
                            label="Base"
                            detail="Sin cambio"
                            selected={groupKeys.length === 0}
                            onClick={() => clearVariationGroup(group)}
                          />
                        ) : null}
                        {group.options.map((option) => (
                          <ChoiceButton
                            key={option.key}
                            label={option.name}
                            detail={option.detail}
                            selected={groupKeys.includes(option.key)}
                            onClick={() => toggleVariationOption(group, option)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {includedAddons.length > 0 && (
                  <div className="rounded-[1.4rem] border border-[var(--brand-border)] bg-black/30 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          Ingredientes incluidos
                        </p>
                        <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                          {hasAddonLimit
                            ? `Seleccionados: ${selectedAddonUnitCount}/${maxAddons}${
                                remainingAddonChoices > 0
                                  ? ` · Puedes elegir ${remainingAddonChoices} más`
                                  : " · Llegaste al máximo"
                              }`
                            : "Elige los que quieras al gusto."}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--brand-cream)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                        Sin costo extra
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {includedAddons.map((option) => {
                        const selected = selectedAddonKeys.includes(option.key);
                        const quantity = getAddonQuantity(option.key);
                        const disabled = reachedAddonLimit;

                        return (
                          <AddonChoice
                            key={option.key}
                            option={option}
                            selected={selected}
                            quantity={quantity}
                            disabled={disabled}
                            onToggle={() => toggleAddon(option)}
                            onIncrease={() => increaseAddon(option)}
                            onDecrease={() => decreaseAddon(option)}
                          />
                        );
                      })}
                    </div>
                    {reachedAddonLimit ? (
                      <p className="mt-3 rounded-xl bg-[var(--brand-cream)] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                        Llegaste al máximo de ingredientes incluidos. Usa los
                        adicionales con costo para sumar más.
                      </p>
                    ) : null}
                  </div>
                )}

                {paidAddons.length > 0 && (
                  <div className="rounded-[1.4rem] border border-[var(--brand-border)] bg-black/30 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          Adicionales con costo
                        </p>
                        <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                          Para sumar más ingredientes o doble porción. Cada uno
                          suma al precio final.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {paidAddons.map((option) => {
                        const selected = selectedAddonKeys.includes(option.key);
                        const quantity = getAddonQuantity(option.key);
                        const disabled = reachedAddonLimit;

                        return (
                          <AddonChoice
                            key={option.key}
                            option={option}
                            selected={selected}
                            quantity={quantity}
                            disabled={disabled}
                            onToggle={() => toggleAddon(option)}
                            onIncrease={() => increaseAddon(option)}
                            onDecrease={() => decreaseAddon(option)}
                          />
                        );
                      })}
                    </div>
                    {reachedAddonLimit ? (
                      <p className="mt-3 rounded-xl bg-[var(--brand-cream)] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                        Llegaste al máximo de adicionales permitidos para este
                        producto.
                      </p>
                    ) : null}
                  </div>
                )}

                {selectableRemovableIngredients.length > 0 && (
                  <div className="rounded-[1.4rem] border border-[var(--brand-border)] bg-black/30 p-4">
                    <p className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                      Ingredientes que puedes quitar
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectableRemovableIngredients.map((option) => (
                        <ChoiceButton
                          key={option.key}
                          label={`Sin ${option.name}`}
                          selected={removedIngredientKeys.includes(option.key)}
                          onClick={() => toggleRemovedIngredient(option.key)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {(selectedVariation ||
                  selectedAddons.length > 0 ||
                  removedIngredientsForCart.length > 0 ||
                  optionsPrice !== 0) && (
                  <div className="space-y-2 rounded-2xl border border-[rgba(var(--brand-primary-rgb),0.4)] bg-black/30 px-4 py-3 text-sm font-black text-[var(--brand-ink-3)]">
                    <div className="flex items-center justify-between gap-3">
                      <span>Resumen</span>
                      <span>{formatUSD(finalUnitPrice)}</span>
                    </div>
                    {selectedVariation ? (
                      <p className="text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                        {formatSelectedOption(selectedVariation)}
                      </p>
                    ) : null}
                    {selectedAddons.length > 0 ? (
                      <p className="text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                        {selectedExtrasLabel}:{" "}
                        {selectedAddons.map(formatSelectedOption).join(" · ")}
                      </p>
                    ) : null}
                    {removedIngredientsForCart.length > 0 ? (
                      <p className="text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                        Sin:{" "}
                        {removedIngredientsForCart
                          .map((option) => option.name)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                )}

                {formMessage ? (
                  <p className="rounded-xl border border-[rgba(var(--brand-primary-rgb),0.4)] bg-[rgba(var(--brand-primary-rgb),0.08)] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                    {formMessage}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={`flex w-full items-center justify-center gap-3 rounded-xl px-4 py-4 font-black uppercase transition active:scale-[0.98] ${
                    added
                      ? "bg-green-500 text-white"
                      : "bg-[var(--brand-primary)] text-black shadow-[0_12px_30px_-12px_rgba(var(--brand-primary-rgb),0.7)] hover:brightness-110"
                  }`}
                >
                  {added ? (
                    <>
                      <ShoppingCart size={18} />
                      Agregado
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Agregar al pedido {formatUSD(finalUnitPrice)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
