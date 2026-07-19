"use client";

import Image from "next/image";
import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  MessageCircle,
  Minus,
  Plus,
  Store,
  Trash2,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { formatUSD, formatVES } from "@/utils/formatCurrency";
import type { CartItem, OrderType, PublicBusinessConfig } from "@/components/cartTypes";
import FiscalBreakdown from "@/components/FiscalBreakdown";
import { getSelectionSummary } from "@/components/cartSelection";
import {
  formatItemSalesChannels,
  getCartLineId,
  isComboItem,
  itemSupportsOrderType,
} from "@/components/cartItemHelpers";

type PickerOption = {
  label: string;
  value: string;
  helper?: string;
};

type OptionPickerProps = {
  label: React.ReactNode;
  value: string;
  placeholder: string;
  options: PickerOption[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
};

export function OptionPicker({
  label,
  value,
  placeholder,
  options,
  isOpen,
  onToggle,
  onSelect,
}: OptionPickerProps) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>

      <button
        type="button"
        onClick={onToggle}
        className={`mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-4 text-left text-sm font-black outline-none transition ${
          isOpen
            ? "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.12)]"
            : "border-[var(--brand-border)] bg-[var(--brand-cream)] hover:border-[var(--brand-primary)]/60"
        }`}
      >
        <span
          className={selectedOption ? "text-[var(--brand-ink)]" : "text-[var(--brand-ink)]/50"}
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-[var(--brand-primary)] transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-[180] overflow-hidden rounded-[1.25rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] shadow-[0_16px_34px_rgba(22,50,79,0.22)]">
          <div className="max-h-72 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => onSelect("")}
              className={`flex w-full flex-col rounded-2xl px-4 py-3 text-left transition ${
                !value
                  ? "bg-[var(--brand-accent)] text-black"
                  : "text-[var(--brand-ink)] hover:bg-[var(--brand-cream)]"
              }`}
            >
              <span className="text-sm font-black uppercase">
                {placeholder}
              </span>
              <span className="mt-0.5 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/60">
                Toca una opción para continuar
              </span>
            </button>

            {options.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelect(option.value)}
                  className={`mt-1 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ${
                    selected
                      ? "bg-[var(--brand-accent)] text-black"
                      : "text-[var(--brand-ink)] hover:bg-[var(--brand-cream)]"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-black uppercase leading-tight">
                      {option.label}
                    </span>
                    {option.helper && (
                      <span className="mt-0.5 block text-[0.68rem] font-bold text-[var(--brand-ink-2)]/60">
                        {option.helper}
                      </span>
                    )}
                  </span>

                  {selected && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[0.68rem] font-black text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type EmptyCartStateProps = {
  businessName: string;
  onClose: () => void;
  title?: string;
  text?: string;
  buttonText?: string;
  onRestoreLastOrder?: () => void;
};

export function EmptyCartState({
  businessName,
  onClose,
  title,
  text,
  buttonText,
  onRestoreLastOrder,
}: EmptyCartStateProps) {
  return (
    <div className="flex min-h-[calc(100vh-210px)] flex-col items-center justify-center rounded-[2rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-6 py-12 text-center shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
      <Image
        src={BRAND.logoUrl || "/logoremovebg.png"}
        alt={businessName}
        width={208}
        height={208}
        unoptimized
        className="mb-6 h-44 w-44 object-contain drop-shadow-[0_16px_18px_rgba(var(--brand-primary-rgb),0.16)] sm:h-52 sm:w-52"
      />

      <h3 className="text-3xl font-black uppercase leading-tight text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
        {title || "Tu carrito está vacío"}
      </h3>

      <p className="mt-4 max-w-sm text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
        {text || "Agrega productos del menú para preparar tu pedido."}
      </p>

      <a
        href="#menu"
        onClick={onClose}
        className="mt-7 inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-105"
      >
        {buttonText || "Ver menú"}
      </a>

      {onRestoreLastOrder ? (
        <button
          type="button"
          onClick={onRestoreLastOrder}
          className="mt-3 inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-transparent px-7 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-black"
        >
          Repetir mi último pedido
        </button>
      ) : null}
    </div>
  );
}

type CartLineItemProps = {
  item: CartItem;
  orderType: OrderType;
  exchangeRate: number;
  removeItem: (cartLineId: string) => void;
  increaseQuantity: (cartLineId: string) => void;
  decreaseQuantity: (cartLineId: string) => void;
  updateItemNote?: (cartLineId: string, note: string) => void;
  updateItemNoteEnabled?: (cartLineId: string, enabled: boolean) => void;
  availabilityLabel?: string;
  divisaOnlyBadge?: string;
};

export function CartLineItem({
  item,
  orderType,
  exchangeRate,
  removeItem,
  increaseQuantity,
  decreaseQuantity,
  updateItemNote,
  updateItemNoteEnabled,
  availabilityLabel,
  divisaOnlyBadge,
}: CartLineItemProps) {
  const itemSubtotal = item.price * item.quantity;
  const itemSubtotalVES = itemSubtotal * exchangeRate;
  const isCombo = isComboItem(item);
  const canUseNotes = item.category !== "Bebidas";
  const cartLineId = getCartLineId(item);
  const selectionSummary = getSelectionSummary(item);

  return (
    <article className="overflow-hidden rounded-[1.6rem] border-2 border-[var(--product-card-border)] bg-[var(--product-card-bg)] text-[var(--product-card-text)] shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.12)]">
      <div className="grid grid-cols-[96px_1fr] gap-4 p-4">
        <div className="h-24 w-24 overflow-hidden rounded-[1.2rem] border-2 border-[var(--product-card-border)]/35 bg-[var(--brand-cream)]">
          <Image
            src={item.image || (BRAND.logoUrl || "/logoremovebg.png")}
            alt={item.name}
            width={96}
            height={96}
            unoptimized
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = "/logoremovebg.png";
            }}
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-[var(--product-card-border)]">
                {item.category}
              </p>

              <h3 className="mt-1 text-xl font-black uppercase leading-tight text-[var(--product-card-text)]">
                {item.name}
              </h3>

              {selectionSummary ? (
                <p className="mt-2 rounded-2xl border border-[var(--product-card-border)]/15 bg-[var(--brand-cream)] px-3 py-2 text-xs font-black leading-5 text-[var(--product-card-text)]">
                  {selectionSummary}
                </p>
              ) : null}

              <p
                className={`mt-2 rounded-2xl px-3 py-2 text-[0.68rem] font-black uppercase leading-4 tracking-[0.1em] ${
                  itemSupportsOrderType(item, orderType)
                    ? "bg-[var(--brand-surface-2)]/75 text-[var(--product-card-text)]/70"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                {availabilityLabel || "Disponible"}: {formatItemSalesChannels(item)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeItem(cartLineId)}
              aria-label={`Eliminar ${item.name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--product-card-border)] bg-[var(--brand-surface-2)] text-[var(--product-card-border)] transition hover:bg-[var(--product-card-border)] hover:text-white"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center rounded-full border-2 border-[var(--product-card-border)] bg-[var(--brand-cream)] p-1">
              <button
                type="button"
                onClick={() => decreaseQuantity(cartLineId)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--product-card-border)] text-white transition hover:scale-105"
                aria-label="Disminuir cantidad"
              >
                <Minus size={17} />
              </button>

              <span className="min-w-10 text-center text-base font-black text-[var(--product-card-text)]">
                {item.quantity}
              </span>

              <button
                type="button"
                onClick={() => increaseQuantity(cartLineId)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--product-card-button)] text-[var(--product-card-text)] transition hover:scale-105"
                aria-label="Aumentar cantidad"
              >
                <Plus size={17} />
              </button>
            </div>

            <div className="text-right">
              <p className="text-xl font-black text-[var(--product-card-border)]">
                {formatUSD(itemSubtotal)}
              </p>

              {item.unitOptionsPrice && item.unitOptionsPrice > 0 ? (
                <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--product-card-text)]/70">
                  Base {formatUSD(Number(item.basePrice || item.price || 0))} + extras
                </p>
              ) : null}

              {isCombo ? (
                <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--product-card-border)]">
                  {divisaOnlyBadge || "Solo divisas"}
                </p>
              ) : (
                <p className="mt-1 text-xs font-black text-[var(--product-card-text)]/65">
                  Bs {formatVES(itemSubtotalVES)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {canUseNotes && updateItemNote && updateItemNoteEnabled && (
        <div className="border-t-2 border-[var(--product-card-border)]/15 bg-[var(--brand-cream)] px-4 py-4">
          <label className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.08em] text-[var(--product-card-border)]">
            <input
              type="checkbox"
              checked={Boolean(item.noteEnabled)}
              onChange={(event) =>
                updateItemNoteEnabled(cartLineId, event.target.checked)
              }
              className="h-5 w-5 accent-[var(--product-card-border)]"
            />
            Agregar nota
          </label>

          {item.noteEnabled && (
            <textarea
              value={item.note || ""}
              onChange={(event) => updateItemNote(cartLineId, event.target.value)}
              placeholder="Ejemplo: sin cebolla, extra salsa, sin picante..."
              className="mt-3 min-h-20 w-full resize-none rounded-2xl border-2 border-[var(--product-card-border)]/25 bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-bold text-[var(--product-card-text)] outline-none placeholder:text-[var(--product-card-text)]/45 focus:border-[var(--product-card-border)]"
            />
          )}
        </div>
      )}
    </article>
  );
}

type CartSummaryFooterProps = {
  items: CartItem[];
  publicConfig: PublicBusinessConfig;
  totalUSD: number;
  hasCombos: boolean;
  hasRegularProducts: boolean;
  comboTotalPrice: number;
  regularTotalPrice: number;
  regularTotalVES: number;
  totalVES: number;
  isOfficialBcv: boolean;
  sourceLabel: string;
  exchangeValueDate?: string;
  exchangeRate: number;
  exchangeWarning?: string;
  canRegisterOrdersInPanel: boolean;
  onOpenOrderModal: () => void;
  whatsappHref: string;
  whatsappButtonLabel: string;
};

export function CartSummaryFooter({
  items,
  publicConfig,
  totalUSD,
  hasCombos,
  hasRegularProducts,
  comboTotalPrice,
  regularTotalPrice,
  regularTotalVES,
  totalVES,
  isOfficialBcv,
  sourceLabel,
  exchangeValueDate,
  exchangeRate,
  exchangeWarning,
  canRegisterOrdersInPanel,
  onOpenOrderModal,
  whatsappHref,
  whatsappButtonLabel,
}: CartSummaryFooterProps) {
  // En el teléfono el desglose (combos/normales/tasa) hacía muy alto el pie:
  // por defecto solo se ve el total y los botones; el detalle se expande con
  // "Ver detalle". En pantallas sm+ el detalle siempre está visible.
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const detailsVisibilityClass = showMobileDetails ? "block" : "hidden sm:block";

  return (
    <div className="shrink-0 border-t-4 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-2.5 sm:px-6">
      {publicConfig.fiscalEnabled && (
        <div className="mb-2.5">
          <FiscalBreakdown items={items} config={publicConfig} />
        </div>
      )}
      <div className="rounded-[1.05rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-3.5 py-2.5 shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.12)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.64rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              {publicConfig.publicCartTotalLabel || "Total a cobrar"}
            </p>
            <p className="hidden text-[0.68rem] font-black leading-4 text-[var(--brand-ink-2)]/60 sm:block">
              {publicConfig.publicCartTotalHint || "Total general en divisas"}
            </p>
          </div>

          <p className="shrink-0 text-2xl font-black leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-[1.75rem]">
            {formatUSD(totalUSD)}
          </p>
        </div>

        {exchangeRate > 0 && (
          <p className="mt-1 text-right text-xs font-black text-[var(--brand-ink-2)]/75">
            ≈ Bs {formatVES(totalVES)}
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowMobileDetails((current) => !current)}
          className="mt-1 inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/55 underline underline-offset-2 sm:hidden"
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${showMobileDetails ? "rotate-180" : ""}`}
          />
          {showMobileDetails ? "Ocultar detalle" : "Ver detalle de precios"}
        </button>

        <div className={detailsVisibilityClass}>
        {hasCombos && hasRegularProducts ? (
          <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-[1rem] border border-[var(--brand-border)] bg-[var(--brand-surface-2)]">
            <div className="border-r border-[var(--brand-border)] px-3 py-2">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                {publicConfig.publicDivisaGroupTitle || "Combos"}
              </p>

              <strong className="block text-sm font-black leading-5 text-[var(--brand-ink-3)]">
                {formatUSD(comboTotalPrice)}
              </strong>

              <p className="text-[0.6rem] font-bold leading-3 text-[var(--brand-ink-2)]/55">
                {publicConfig.publicDivisaOnlyBadge || "Solo divisas"}
              </p>
            </div>

            <div className="px-3 py-2">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                {publicConfig.publicRegularGroupTitle || "Normales"}
              </p>

              <strong className="block text-sm font-black leading-5 text-[var(--brand-ink-3)]">
                {formatUSD(regularTotalPrice)}
              </strong>

              <p className="text-[0.6rem] font-bold leading-3 text-[var(--brand-ink-2)]/55">
                Bs {formatVES(regularTotalVES)}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-[1rem] border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2">
            {hasCombos && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                    {publicConfig.publicDivisaGroupTitle || "Combos"}
                  </p>

                  <p className="text-[0.62rem] font-bold text-[var(--brand-ink-2)]/55">
                    {publicConfig.publicDivisaOnlyNote || "Pago solo en divisas"}
                  </p>
                </div>

                <strong className="shrink-0 text-sm font-black text-[var(--brand-ink-3)]">
                  {formatUSD(comboTotalPrice)}
                </strong>
              </div>
            )}

            {hasRegularProducts && (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                    {publicConfig.publicRegularGroupTitle || "Productos normales"}
                  </p>

                  <p className="text-[0.62rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
                    {formatUSD(regularTotalPrice)} · Ref. Bs {formatVES(regularTotalVES)}
                  </p>
                </div>

                <strong className="shrink-0 text-sm font-black text-[var(--brand-ink-3)]">
                  {formatUSD(regularTotalPrice)}
                </strong>
              </div>
            )}
          </div>
        )}

        {exchangeRate > 0 && (
          <div className="mt-1.5 flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--brand-border)] bg-[var(--brand-surface-2)]/70 px-3 py-1.5">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1 text-[0.58rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                {isOfficialBcv ? (
                  <BadgeCheck size={11} />
                ) : (
                  <AlertTriangle size={11} />
                )}
                {sourceLabel}
              </p>

              {exchangeValueDate && (
                <p className="text-[0.58rem] font-bold leading-3 text-[var(--brand-ink-2)]/55">
                  {exchangeValueDate}
                </p>
              )}
            </div>

            <strong className="shrink-0 text-sm font-black text-[var(--brand-ink-3)]">
              Bs {formatVES(exchangeRate)}
            </strong>
          </div>
        )}
        </div>

        {exchangeWarning && (
          <div className="mt-1.5 rounded-xl border border-orange-400/35 bg-orange-100 px-3 py-1.5">
            <p className="text-[0.62rem] font-bold leading-4 text-[#7a2e00]">
              {exchangeWarning}
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 grid gap-2">
        {canRegisterOrdersInPanel && (
          <button
            type="button"
            onClick={onOpenOrderModal}
            className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.2)] active:translate-y-1 active:shadow-none"
          >
            <Store size={17} />
            {publicConfig.publicCartLocalOrderButtonText || "Registrar pedido local"}
          </button>
        )}

        {/* WhatsApp solo queda como respaldo cuando el negocio no registra
            pedidos en el panel; con registro activo el único camino es
            "Registrar pedido". */}
        {!canRegisterOrdersInPanel && (
          <a
            href={whatsappHref || "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!whatsappHref}
            onClick={(event) => {
              if (!whatsappHref) event.preventDefault();
            }}
            className={`flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none ${
              whatsappHref
                ? "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-accent)] hover:text-black"
                : "cursor-not-allowed bg-[#ddd3c4] text-[var(--brand-ink-2)]/45"
            }`}
          >
            <MessageCircle size={17} />
            {whatsappButtonLabel}
          </a>
        )}
      </div>
    </div>
  );
}
