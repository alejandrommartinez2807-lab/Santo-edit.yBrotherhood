"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { BRAND } from "@/lib/brand";
import {
  Check,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { formatUSD, formatVES } from "@/utils/formatCurrency";
import type { ProductToAdd } from "@/hooks/useCart";
import type { Product } from "@/data/products";
import {
  type SelectableOption,
  cleanNumber,
  getProductType,
  getSalesChannels,
  normalizeSelectionRules,
  formatSelectedOption,
  flattenVariationOptions,
  flattenAddonOptions,
  flattenIngredientOptions,
  hasRequiredVariation,
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
};

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
      className={`flex min-h-12 items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2 text-left text-xs font-black transition ${
        selected
          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.12)]"
          : disabled
            ? "cursor-not-allowed border-[var(--brand-primary)]/10 bg-white/60 text-[var(--brand-primary-dark)]/35"
            : "border-[var(--brand-primary)]/15 bg-white text-[var(--brand-ink)] hover:border-[var(--brand-primary)]/60"
      }`}
    >
      <span>
        <span className="block uppercase leading-tight">{label}</span>
        {detail ? (
          <span className="mt-0.5 block text-[0.68rem] font-bold uppercase tracking-normal text-[var(--brand-primary)]/70">
            {detail}
          </span>
        ) : null}
      </span>
      {selected ? <Check size={16} className="shrink-0" /> : null}
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
      className={`rounded-2xl border-2 p-3 transition ${
        selected
          ? "border-[var(--brand-primary)] bg-white shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.08)]"
          : disabled
            ? "border-[var(--brand-primary)]/10 bg-white/60 opacity-70"
            : "border-[var(--brand-primary)]/15 bg-white"
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
            <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-normal text-[var(--brand-primary)]/70">
              {option.detail}
            </span>
          ) : null}
        </span>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
            selected
              ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
              : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-transparent"
          }`}
        >
          <Check size={14} />
        </span>
      </button>

      {selected ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--brand-cream)] px-3 py-2">
          <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary-dark)]">
            Cantidad
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDecrease}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]"
              aria-label={`Bajar cantidad de ${option.name}`}
            >
              <Minus size={14} />
            </button>
            <span className="min-w-6 text-center text-sm font-black text-[var(--brand-ink)]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={onIncrease}
              disabled={!canIncrease}
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                canIncrease
                  ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                  : "cursor-not-allowed border-[var(--brand-primary)]/15 bg-white text-[var(--brand-primary)]/30"
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
}: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [selectedVariationKey, setSelectedVariationKey] = useState("");
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
  const selectableVariations = useMemo(
    () => flattenVariationOptions(variations),
    [variations],
  );
  const selectableAddons = useMemo(() => flattenAddonOptions(addons), [addons]);
  const selectableRemovableIngredients = useMemo(
    () => flattenIngredientOptions(removableIngredients),
    [removableIngredients],
  );
  const variationRequired = hasRequiredVariation(variations);
  const maxAddons = ruleSettings.maxAddons;
  const minAddons = ruleSettings.minAddons;
  const selectedVariation =
    selectableVariations.find(
      (option) => option.key === selectedVariationKey,
    ) || null;
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
  const optionsPrice =
    Number(selectedVariation?.priceDelta || 0) + selectedAddonTotalPrice;
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
    selectableVariations.length > 0 ||
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

    if (selectedVariation) {
      parts.push(`Variación: ${formatSelectedOption(selectedVariation)}`);
    }

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
    if (
      variationRequired &&
      selectableVariations.length > 0 &&
      !selectedVariation
    ) {
      setFormMessage("Elige una variación antes de agregar este producto.");
      return;
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

  return (
    <>
      <motion.article
        layout
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.96 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.2) }}
        whileHover={{ y: -6 }}
        className="group overflow-hidden rounded-[1.8rem] border-2 border-[var(--product-card-border)] bg-[var(--product-card-bg)] shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]"
      >
        <div className="relative h-64 overflow-hidden bg-[var(--brand-cream)] sm:h-72">
          <motion.img
            src={image || BRAND.logoUrl || "/logoremovebg.png"}
            alt={name}
            className="h-full w-full object-cover"
            whileHover={{ scale: 1.06 }}
            transition={{ duration: 0.45 }}
            onError={(event) => {
              event.currentTarget.src = "/logoremovebg.png";
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

          <span className="absolute left-4 top-4 rounded-full border-2 border-[var(--product-card-button)] bg-[var(--product-card-border)] px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white shadow-md">
            {category}
          </span>

          <div className="absolute right-4 top-4 flex max-w-[58%] flex-col items-end gap-2">
            {isFeatured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--product-card-border)] bg-[var(--product-card-button)] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--product-card-text)] shadow-md">
                <Sparkles size={14} />
                Destacado
              </span>
            ) : null}

            {isCombo ? (
              <span className="rounded-full border-2 border-[var(--product-card-border)] bg-[var(--product-card-button)] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--product-card-text)] shadow-md">
                Solo divisas
              </span>
            ) : null}
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <div className="max-w-[58%]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--brand-accent)]">
                {BRAND.name}
              </p>

              <h3 className="mt-1 text-[1.95rem] font-black uppercase leading-[0.95] tracking-[-0.05em] text-white drop-shadow-md sm:text-[2.2rem]">
                {name}
              </h3>
            </div>

            <div className="min-w-[112px] rounded-[1.4rem] border-2 border-[var(--product-card-border)] bg-[var(--product-card-button)] px-4 py-3 text-right text-[var(--product-card-text)] shadow-xl shadow-black/20">
              <p className="text-2xl font-black leading-none">
                {formatUSD(finalUnitPrice)}
              </p>

              {optionsPrice !== 0 ? (
                <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#6b2500]">
                  Base {formatUSD(price)}
                </p>
              ) : null}

              {isCombo ? (
                <div className="mt-2 border-t border-[#6b4a00]/20 pt-2">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#6b2500]">
                    Pago en divisas
                  </p>
                </div>
              ) : (
                <div className="mt-2 border-t border-[#6b4a00]/20 pt-2">
                  <p className="text-sm font-black leading-none sm:text-base">
                    Bs {formatVES(finalVES)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <p className="min-h-[56px] text-sm font-bold leading-relaxed text-[var(--product-card-text)] sm:text-base">
            {description}
          </p>

          {onToggleFavorite ? (
            <button
              type="button"
              onClick={() => onToggleFavorite(id)}
              className={`mt-4 inline-flex items-center gap-2 rounded-full border-2 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] transition ${
                isFavorite
                  ? "border-[var(--product-card-border)] bg-[var(--product-card-button)] text-[var(--product-card-text)] shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.12)]"
                  : "border-[var(--product-card-border)]/20 bg-[var(--brand-cream)] text-[var(--product-card-text)] hover:border-[var(--product-card-border)]/60"
              }`}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite
                  ? `Quitar ${name} de favoritos`
                  : `Guardar ${name} como favorito`
              }
            >
              <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
              {isFavorite ? "Favorito guardado" : "Guardar favorito"}
            </button>
          ) : null}



          {isCombo && (
            <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                Este combo se paga únicamente en dólares.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleMainAction}
            className={`mt-6 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-[var(--brand-primary)] px-4 py-4 font-black uppercase transition active:scale-[0.98] ${
              added
                ? "bg-green-500 text-white"
                : "bg-[var(--product-card-button)] text-[var(--product-card-text)] shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.14)] hover:brightness-105"
            }`}
          >
            {added ? (
              <>
                <ShoppingCart size={18} />
                Agregado
              </>
            ) : (
              <>
                {hasSelectableOptions ? (
                  <SlidersHorizontal size={18} />
                ) : (
                  <Plus size={18} />
                )}
                {hasSelectableOptions
                  ? customizeActionLabel
                  : `Agregar ${formatUSD(finalUnitPrice)}`}
              </>
            )}
          </button>
        </div>
      </motion.article>

      {hasSelectableOptions && isCustomizerOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#120000]/75 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border-2 border-[var(--product-card-border)] bg-[var(--brand-cream)] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--product-card-border)]/15 bg-[var(--product-card-bg)] px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--product-card-border)]">
                  {customizerTitle}
                </p>
                <h3 className="mt-1 text-2xl font-black uppercase leading-none text-[var(--product-card-text)] sm:text-3xl">
                  {name}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCustomizer}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--product-card-border)] bg-[var(--product-card-button)] text-[var(--product-card-text)] shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.12)]"
                aria-label="Cerrar personalización"
              >
                <X size={22} />
              </button>
            </div>

            <div className="grid overflow-y-auto lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="border-b-2 border-[var(--product-card-border)]/15 bg-[var(--product-card-bg)] p-5 lg:border-b-0 lg:border-r-2 sm:p-6">
                <div className="overflow-hidden rounded-[1.5rem] border-2 border-[var(--product-card-border)]/15 bg-[var(--brand-cream)]">
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
                    <span className="inline-flex rounded-full bg-[var(--product-card-border)] px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white">
                      {customizerTitle}
                    </span>
                    <p className="mt-3 text-sm font-bold leading-6 text-[var(--product-card-text)]/72">
                      {description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border-2 border-[var(--product-card-border)]/15 bg-[var(--brand-cream)] px-4 py-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--product-card-border)]">
                      Base
                    </p>
                    <p className="mt-1 text-2xl font-black text-[var(--product-card-text)]">
                      {formatUSD(price)}
                    </p>
                  </div>
                  <div className="rounded-2xl border-2 border-[var(--product-card-border)] bg-[var(--product-card-button)] px-4 py-3 text-right text-[var(--product-card-text)]">
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
                {selectableVariations.length > 0 && (
                  <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          Elige presentación
                        </p>
                        {variationRequired ? (
                          <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                            Esta selección es obligatoria.
                          </p>
                        ) : null}
                      </div>
                      {variationRequired ? (
                        <span className="rounded-full bg-[var(--brand-cream)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                          Obligatoria
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {!variationRequired ? (
                        <ChoiceButton
                          label="Base"
                          detail="Sin cambio"
                          selected={!selectedVariationKey}
                          onClick={() => {
                            resetMessage();
                            setSelectedVariationKey("");
                          }}
                        />
                      ) : null}
                      {selectableVariations.map((option) => (
                        <ChoiceButton
                          key={option.key}
                          label={option.name}
                          detail={option.detail}
                          selected={selectedVariationKey === option.key}
                          onClick={() => {
                            resetMessage();
                            setSelectedVariationKey(option.key);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {includedAddons.length > 0 && (
                  <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4">
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
                    <div className="grid gap-2 sm:grid-cols-2">
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
                  <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4">
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
                    <div className="grid gap-2 sm:grid-cols-2">
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
                  <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4">
                    <p className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                      Ingredientes que puedes quitar
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
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
                  <div className="space-y-2 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white px-4 py-3 text-sm font-black text-[var(--brand-ink)]">
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
                  <p className="rounded-xl border border-[var(--brand-primary)]/15 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                    {formMessage}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={`flex w-full items-center justify-center gap-3 rounded-xl border-2 border-[var(--brand-primary)] px-4 py-4 font-black uppercase transition active:scale-[0.98] ${
                    added
                      ? "bg-green-500 text-white"
                      : "bg-[var(--product-card-button)] text-[var(--product-card-text)] shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.14)] hover:brightness-105"
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
