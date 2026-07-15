"use client";

// Piezas visuales reutilizables del panel de cuentas abiertas.

import { CheckCircle2, Circle } from "lucide-react";
import type { OpenAccountOrderSummary, OrderItem } from "@/types/localOrders";

function MiniStat({
  label,
  value,
  small = false,
  tone = "default",
}: {
  label: string;
  value: string | number;
  small?: boolean;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]"
      : tone === "success"
        ? "border-green-600 bg-green-100 text-green-800"
        : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]";

  return (
    <div className={`rounded-2xl border-2 p-3 ${toneClass}`}>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] opacity-70">
        {label}
      </p>
      <p className={`${small ? "text-sm" : "text-xl"} mt-1 font-black`}>
        {value}
      </p>
    </div>
  );
}

function OrderPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success" | "muted";
}) {
  const toneClass =
    tone === "warning"
      ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]"
      : tone === "success"
        ? "border-green-600 bg-green-100 text-green-800"
        : tone === "muted"
          ? "border-zinc-300 bg-zinc-100 text-zinc-700"
          : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink-2)]";

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] opacity-70">
        {label}
      </p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function OrderItemsPreview({
  order,
  onToggleItemDelivered,
  isTogglingDelivered = false,
}: {
  order: OpenAccountOrderSummary;
  // Si llega el callback, cada producto muestra su check "entregado" para ir
  // marcando lo que ya se llevó a la mesa (columnas 0026).
  onToggleItemDelivered?: (item: OrderItem, delivered: boolean) => void;
  isTogglingDelivered?: boolean;
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const canToggleItems = Boolean(onToggleItemDelivered) && items.length > 0;

  const itemLines =
    items.length > 0
      ? items.map((item) => {
          const details = [
            item.selectionSummary,
            item.note ? `Nota: ${item.note}` : "",
          ]
            .filter(Boolean)
            .join(" · ");

          return `${item.quantity}x ${item.name}${details ? ` — ${details}` : ""}`;
        })
      : order.itemsText
        ? order.itemsText
            .split("|")
            .map((line) => line.trim())
            .filter(Boolean)
        : [];

  if (itemLines.length === 0) {
    return (
      <p className="mt-2 rounded-xl border border-dashed border-[var(--brand-primary)]/20 bg-white px-3 py-2 text-[0.7rem] font-bold text-[var(--brand-ink-2)]/55">
        Sin detalle de productos guardado en esta cuenta.
      </p>
    );
  }

  if (canToggleItems) {
    const deliveredCount = items.filter((item) => Boolean(item.deliveredAt)).length;

    return (
      <div className="mt-2 rounded-xl border border-[var(--brand-primary)]/15 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/75">
            Productos
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em] ${
              deliveredCount === items.length
                ? "bg-green-100 text-green-700"
                : "bg-[var(--brand-cream)] text-[var(--brand-ink-2)]/70"
            }`}
          >
            {deliveredCount}/{items.length} entregados
          </span>
        </div>
        <ul className="mt-1.5 space-y-1.5">
          {items.map((item, index) => {
            const delivered = Boolean(item.deliveredAt);
            const details = [
              item.selectionSummary,
              item.note ? `Nota: ${item.note}` : "",
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={`${order.id}-item-${item.cartLineId || index}`}>
                <button
                  type="button"
                  onClick={() => onToggleItemDelivered?.(item, !delivered)}
                  disabled={isTogglingDelivered}
                  title={
                    delivered
                      ? `Entregado${item.deliveredBy ? ` por ${item.deliveredBy}` : ""} · toca para desmarcar`
                      : "Toca cuando lo entregues al cliente"
                  }
                  className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[0.72rem] font-bold leading-5 transition disabled:opacity-50 ${
                    delivered
                      ? "border-green-600/40 bg-green-50 text-green-800"
                      : "border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] text-[var(--brand-ink-2)]/80 hover:border-[var(--brand-primary)]/40"
                  }`}
                >
                  {delivered ? (
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green-600" />
                  ) : (
                    <Circle size={15} className="mt-0.5 shrink-0 opacity-40" />
                  )}
                  <span className="min-w-0">
                    <span className={delivered ? "line-through decoration-green-600/50" : ""}>
                      {item.quantity}x {item.name}
                    </span>
                    {details ? (
                      <span className="block text-[0.66rem] opacity-70">{details}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-[var(--brand-primary)]/15 bg-white px-3 py-2">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/75">
        Productos
      </p>
      <ul className="mt-1 space-y-1 text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/75">
        {itemLines.slice(0, 6).map((line, index) => (
          <li key={`${order.id}-item-${index}`}>• {line}</li>
        ))}
      </ul>
    </div>
  );
}

function PaymentInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
      />
    </label>
  );
}

function PaymentSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  emptyLabel?: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
      >
        {options.map((option) => (
          <option key={option || "empty"} value={option}>
            {option || emptyLabel || "Sin registrar"}
          </option>
        ))}
      </select>
    </label>
  );
}

export { MiniStat, OrderPill, OrderItemsPreview, PaymentInput, PaymentSelect };
