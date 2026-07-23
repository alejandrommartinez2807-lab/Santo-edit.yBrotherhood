"use client";

// Calculador aislado para "Separar cuenta": ayuda a repartir el total de una
// cuenta entre varias personas (partes iguales o montos personalizados). Es una
// herramienta de cálculo: no registra cobros. El "Usar" opcional pasa el monto
// de una parte al formulario de cobro para cobrarla parte por parte con el
// flujo de pago que ya existe (pagos parciales sobre la cuenta).

import { useMemo, useState } from "react";
import { X, Users, SlidersHorizontal, Plus, Minus } from "lucide-react";
import { formatUSD } from "@/utils/formatCurrency";

type SplitMode = "equal" | "custom";

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function SepararCuentaModal({
  open,
  onClose,
  totalUSD,
  label,
  onUseAmount,
}: {
  open: boolean;
  onClose: () => void;
  totalUSD: number;
  label?: string;
  onUseAmount?: (usd: number) => void;
}) {
  const [mode, setMode] = useState<SplitMode>("equal");
  const [people, setPeople] = useState(2);
  const [customAmounts, setCustomAmounts] = useState<string[]>(["", ""]);

  const total = Math.max(0, round2(Number(totalUSD) || 0));

  // Partes iguales, repartiendo los centavos sobrantes en las primeras partes
  // para que la suma cuadre exactamente con el total.
  const equalParts = useMemo(() => {
    const count = Math.max(1, Math.min(50, Math.floor(people) || 1));
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / count);
    const extra = cents - base * count;
    return Array.from(
      { length: count },
      (_, index) => (base + (index < extra ? 1 : 0)) / 100,
    );
  }, [people, total]);

  const customParsed = customAmounts.map((value) =>
    Math.max(0, round2(Number(value) || 0)),
  );
  const customSum = round2(customParsed.reduce((sum, value) => sum + value, 0));
  const remaining = round2(total - customSum);

  if (!open) return null;

  function setCustomAmount(index: number, value: string) {
    setCustomAmounts((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }

  function applyAmount(amount: number) {
    if (!onUseAmount || !(amount > 0)) return;
    onUseAmount(round2(amount));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[1.4rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              <Users size={16} /> Separar cuenta
            </p>
            <p className="mt-0.5 text-sm font-black text-[var(--brand-ink-3)]">
              {label ? `${label} · ` : ""}Total {formatUSD(total)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white p-1.5 text-[var(--brand-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4">
          {/* Modo */}
          <div className="inline-flex rounded-full border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-1">
            <button
              type="button"
              onClick={() => setMode("equal")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.66rem] font-black uppercase tracking-[0.08em] transition ${
                mode === "equal"
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-[var(--brand-primary)]"
              }`}
            >
              <Users size={13} /> Partes iguales
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.66rem] font-black uppercase tracking-[0.08em] transition ${
                mode === "custom"
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-[var(--brand-primary)]"
              }`}
            >
              <SlidersHorizontal size={13} /> Montos personalizados
            </button>
          </div>

          {mode === "equal" ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60">
                  ¿Entre cuántas personas?
                </span>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPeople((n) => Math.max(1, n - 1))}
                    className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white p-1.5 text-[var(--brand-primary)]"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-8 text-center text-lg font-black text-[var(--brand-ink-3)]">
                    {Math.max(1, Math.min(50, Math.floor(people) || 1))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPeople((n) => Math.min(50, n + 1))}
                    className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white p-1.5 text-[var(--brand-primary)]"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {equalParts.map((amount, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-2 rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-3 py-2"
                  >
                    <span className="text-sm font-bold text-[var(--brand-ink-2)]/75">
                      Persona {index + 1}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-sm font-black text-[var(--brand-ink-3)]">
                        {formatUSD(amount)}
                      </span>
                      {onUseAmount && (
                        <button
                          type="button"
                          onClick={() => applyAmount(amount)}
                          className="rounded-lg border-2 border-emerald-300 bg-white px-2 py-1 text-[0.6rem] font-black uppercase text-emerald-700"
                        >
                          Usar
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4">
              <ul className="space-y-2">
                {customAmounts.map((value, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs font-bold text-[var(--brand-ink-2)]/70">
                      Persona {index + 1}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={value}
                      onChange={(event) =>
                        setCustomAmount(index, event.target.value)
                      }
                      placeholder="0.00"
                      className="min-w-0 flex-1 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold text-[#1a1a1a] outline-none focus:border-[var(--brand-primary)]"
                    />
                    {onUseAmount && (
                      <button
                        type="button"
                        onClick={() => applyAmount(customParsed[index])}
                        disabled={!(customParsed[index] > 0)}
                        className="rounded-lg border-2 border-emerald-300 bg-white px-2 py-1.5 text-[0.6rem] font-black uppercase text-emerald-700 disabled:opacity-40"
                      >
                        Usar
                      </button>
                    )}
                    {customAmounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setCustomAmounts((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        className="rounded-lg border-2 border-red-200 bg-white p-1.5 text-red-600"
                        title="Quitar persona"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() =>
                  setCustomAmounts((current) => [...current, ""])
                }
                className="mt-2 inline-flex items-center gap-1 rounded-lg border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-[0.66rem] font-black uppercase text-[var(--brand-primary)]"
              >
                <Plus size={13} /> Agregar persona
              </button>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-3 py-2 text-sm font-black">
                <span className="text-[var(--brand-ink-2)]/70">
                  Asignado {formatUSD(customSum)}
                </span>
                <span
                  className={
                    Math.abs(remaining) <= 0.01
                      ? "text-emerald-700"
                      : remaining > 0
                        ? "text-amber-700"
                        : "text-red-600"
                  }
                >
                  {Math.abs(remaining) <= 0.01
                    ? "Cuadra ✓"
                    : remaining > 0
                      ? `Falta ${formatUSD(remaining)}`
                      : `Sobra ${formatUSD(Math.abs(remaining))}`}
                </span>
              </div>
            </div>
          )}

          <p className="mt-4 text-[0.66rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
            Esto solo divide el monto como guía. El cobro se registra con el
            botón de cobro de la cuenta{onUseAmount ? ' (usa "Usar" para cobrar cada parte)' : ""}.
          </p>
        </div>
      </div>
    </div>
  );
}
