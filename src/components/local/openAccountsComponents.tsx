"use client";

// Piezas visuales reutilizables del panel de cuentas abiertas.

import type { OpenAccountOrderSummary } from "@/types/localOrders";

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

function OrderItemsPreview({ order }: { order: OpenAccountOrderSummary }) {
  const itemLines =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items.map((item) => {
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
