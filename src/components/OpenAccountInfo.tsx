"use client";

import { useEffect, useRef, useState } from "react";
import PublicBranchPicker, {
  usePublicBranchSelection,
} from "@/components/PublicBranchPicker";
import {
  Loader2,
  QrCode,
  Search,
  Table2,
  ListChecks,
  Wallet,
} from "lucide-react";
import { formatUSD } from "@/utils/formatCurrency";
import type {
  PublicLocalTable,
  PublicOpenAccountOrderSummary,
  PublicOpenAccountSummary,
} from "@/components/cartTypes";

const STEPS = [
  {
    icon: QrCode,
    title: "Escanea el QR de tu mesa",
    text: "Cada mesa tiene su propio código. Apunta con la cámara del teléfono y abre el menú.",
  },
  {
    icon: Table2,
    title: 'Toca "Abrir cuenta de la mesa"',
    text: "Si la mesa no tiene una cuenta activa, ábrela con un toque para empezar a pedir.",
  },
  {
    icon: ListChecks,
    title: "Pide lo que quieras",
    text: "Todo lo que pidas se va sumando a la cuenta de la mesa. Puedes pedir las veces que quieras.",
  },
  {
    icon: Wallet,
    title: "Paga al final",
    text: "Cuando termines, el personal cierra la cuenta y cobra el total. Cada mesa queda registrada por separado.",
  },
];

type AccountLookupState =
  | {
      status: "idle";
      tableName: string;
      account: null;
      message: string;
    }
  | {
      status: "free" | "unavailable" | "error";
      tableName: string;
      account: null;
      message: string;
    }
  | {
      status: "open";
      tableName: string;
      account: PublicOpenAccountSummary;
      message: string;
    };

type PublicConfigPayload = {
  openAccountsEnabled?: boolean;
  openAccountsModuleEnabled?: boolean;
  localTables?: PublicLocalTable[];
};

const EMPTY_LOOKUP: AccountLookupState = {
  status: "idle",
  tableName: "",
  account: null,
  message: "",
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function getPublicConfigPayload(value: unknown): PublicConfigPayload {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const config =
    source.businessConfig && typeof source.businessConfig === "object"
      ? source.businessConfig as Record<string, unknown>
      : source.config && typeof source.config === "object"
        ? source.config as Record<string, unknown>
        : source;

  return config as PublicConfigPayload;
}

function normalizePublicTables(value: unknown): PublicLocalTable[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const name = cleanText(source.name);

    if (!name || source.isActive === false) return [];

    const table: PublicLocalTable = {
      id: cleanText(source.id) || undefined,
      name,
      area: cleanText(source.area) || undefined,
      sortOrder: Number(source.sortOrder || 0) || undefined,
      isActive: true,
    };

    return [table];
  });
}

function getRequestedTableFromUrl() {
  if (typeof window === "undefined") return "";

  try {
    const params = new URLSearchParams(window.location.search);

    return (
      cleanText(params.get("mesa")) ||
      cleanText(params.get("table")) ||
      cleanText(params.get("ubicacion")) ||
      cleanText(params.get("ubicación"))
    );
  } catch {
    return "";
  }
}

function formatAccountDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(date);
  } catch {
    return "";
  }
}

function getOrderStatusLabel(status: string) {
  if (status === "Entregado") return "Entregado";
  if (status === "Listo") return "Listo";
  if (status === "Preparando") return "Preparando";
  if (status === "Cancelado") return "Cancelado";

  return "Recibido";
}

function formatPublicSelectionSummary(value: unknown) {
  const cleanValue = cleanText(value)
    .replace(/Opciones del producto:/gi, "Variación:")
    .replace(/Requiere confirmación del (personal|mesonero)/gi, "")
    .replace(/Confirmación del (personal|mesonero)/gi, "")
    .replace(/\s+·\s+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleanValue;
}

function getOrderLines(order: PublicOpenAccountOrderSummary) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.map((item) => {
      const details = [
        formatPublicSelectionSummary(item.selectionSummary),
        cleanText(item.note) ? `Nota: ${cleanText(item.note)}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      return `${item.quantity}x ${item.name}${details ? ` — ${details}` : ""}`;
    });
  }

  return cleanText(order.itemsText)
    .split("|")
    .map((line) => formatPublicSelectionSummary(line.trim()))
    .filter(Boolean);
}

function normalizeLookupResponse(value: unknown): AccountLookupState {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const tableName = cleanText(source.tableName);
  const openAccountsAvailable = source.openAccountsAvailable === true;
  const hasOpenAccount = source.hasOpenAccount === true;
  const accountSource =
    source.openAccount && typeof source.openAccount === "object"
      ? source.openAccount as Record<string, unknown>
      : null;

  if (!openAccountsAvailable) {
    return {
      status: "unavailable",
      tableName,
      account: null,
      message: "Las cuentas por mesa no están disponibles en este momento.",
    };
  }

  if (!hasOpenAccount || !accountSource) {
    return {
      status: "free",
      tableName,
      account: null,
      message: tableName
        ? `${tableName} no tiene una cuenta abierta todavía.`
        : "Esta mesa no tiene una cuenta abierta todavía.",
    };
  }

  const orders = Array.isArray(accountSource.orders)
    ? accountSource.orders.map((rawOrder) => {
        const order = rawOrder && typeof rawOrder === "object" ? rawOrder as Record<string, unknown> : {};
        const items = Array.isArray(order.items)
          ? order.items.map((rawItem) => {
              const item = rawItem && typeof rawItem === "object" ? rawItem as Record<string, unknown> : {};
              const name = cleanText(item.name);
              const quantity = Number(item.quantity || 0);

              if (!name || !Number.isFinite(quantity) || quantity <= 0) return null;

              return {
                id: Number(item.id || 0) || undefined,
                name,
                category: cleanText(item.category) || undefined,
                quantity,
                selectionSummary: cleanText(item.selectionSummary) || undefined,
                note: cleanText(item.note) || undefined,
              };
            }).filter(Boolean)
          : [];

        return {
          id: cleanText(order.id),
          displayNumber: cleanText(order.displayNumber) || undefined,
          status: cleanText(order.status) || "Nuevo",
          paymentStatus: cleanText(order.paymentStatus) || "Pendiente",
          totalUSD: Number(order.totalUSD || 0) || 0,
          receivedEquivalentUSD: Number(order.receivedEquivalentUSD || 0) || 0,
          pendingUSD: Number(order.pendingUSD || 0) || 0,
          createdAt: cleanText(order.createdAt) || undefined,
          itemsText: cleanText(order.itemsText) || undefined,
          items: items as PublicOpenAccountOrderSummary["items"],
        } satisfies PublicOpenAccountOrderSummary;
      }).filter((order) => Boolean(order.id))
    : [];

  const account: PublicOpenAccountSummary = {
    id: cleanText(accountSource.id),
    tableNumber: cleanText(accountSource.tableNumber) || tableName,
    customerName: cleanText(accountSource.customerName) || undefined,
    status: cleanText(accountSource.status) || "Abierta",
    totalEstimatedUSD: Number(accountSource.totalEstimatedUSD || 0) || 0,
    totalCollectedUSD: Number(accountSource.totalCollectedUSD || 0) || 0,
    pendingUSD: Number(accountSource.pendingUSD || 0) || 0,
    createdAt: cleanText(accountSource.createdAt) || undefined,
    updatedAt: cleanText(accountSource.updatedAt) || undefined,
    orders,
  };

  return {
    status: "open",
    tableName: tableName || account.tableNumber,
    account,
    message: "Cuenta abierta encontrada.",
  };
}

export default function OpenAccountInfo() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [tables, setTables] = useState<PublicLocalTable[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [lookupState, setLookupState] = useState<AccountLookupState>(EMPTY_LOOKUP);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  // Sede elegida por el cliente (Fase 3): las mesas y sus cuentas son por sede.
  const branchSelection = usePublicBranchSelection();
  const needsBranchSelection = branchSelection.needsSelection;

  // Al cambiar de sede se limpia la consulta anterior: esa mesa/cuenta
  // pertenecía a otra sucursal.
  const previousBranchIdRef = useRef(branchSelection.selectedBranchId);
  useEffect(() => {
    const previousBranchId = previousBranchIdRef.current;
    previousBranchIdRef.current = branchSelection.selectedBranchId;

    if (!previousBranchId || previousBranchId === branchSelection.selectedBranchId) {
      return;
    }

    setSelectedTable("");
    setLookupState(EMPTY_LOOKUP);
  }, [branchSelection.selectedBranchId]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const response = await fetch("/api/public/business-config", {
          cache: "no-store",
        });
        const data = await response.json();
        const config = getPublicConfigPayload(data);
        const activeTables = normalizePublicTables(config.localTables);
        const enabled =
          (config.openAccountsEnabled === true ||
            config.openAccountsModuleEnabled === true) &&
          activeTables.length > 0;

        if (!ignore) {
          setIsEnabled(enabled);
          setTables(activeTables);

          const requestedTable = getRequestedTableFromUrl();
          if (requestedTable) setSelectedTable(requestedTable);
        }
      } catch {
        if (!ignore) setIsEnabled(false);
      }
    })();

    return () => {
      ignore = true;
    };
    // Se recarga al cambiar la sede: cada sucursal tiene sus propias mesas
    // (AuthBridge adjunta x-branch-id al fetch de configuración pública).
  }, [branchSelection.selectedBranchId]);

  async function handleLookupAccount() {
    const cleanTable = selectedTable.trim();

    if (!cleanTable || isLookupLoading) return;

    try {
      setIsLookupLoading(true);
      setLookupState(EMPTY_LOOKUP);

      const response = await fetch(
        `/api/public/table-account-status?mesa=${encodeURIComponent(cleanTable)}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "No se pudo consultar esta mesa.");
      }

      setLookupState(normalizeLookupResponse(data));
    } catch (error) {
      setLookupState({
        status: "error",
        tableName: cleanTable,
        account: null,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo consultar esta mesa.",
      });
    } finally {
      setIsLookupLoading(false);
    }
  }

  if (!isEnabled) return null;

  return (
    <section id="abrir-cuenta" className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white p-6 shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)] sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <QrCode size={28} />
          </span>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Cuenta por mesa
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase text-[var(--brand-ink-3)] sm:text-3xl">
            Abrir o ver cuenta
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            Escanea el QR de tu mesa para abrir la cuenta. Desde aquí también
            puedes consultar lo que se ha agregado a esa mesa antes de pedir o pagar.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <article
                key={step.title}
                className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white text-sm font-black text-[var(--brand-primary)]">
                    {index + 1}
                  </span>
                  <Icon size={18} className="text-[var(--brand-primary)]" />
                </div>
                <p className="mt-3 text-sm font-black uppercase tracking-[0.04em] text-[var(--brand-ink-3)]">
                  {step.title}
                </p>
                <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
                  {step.text}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-6">
          <PublicBranchPicker
            selection={branchSelection}
            label="¿En qué sede está tu mesa?"
          />
        </div>

        <div className="mt-4 rounded-[1.5rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
          {needsBranchSelection ? (
            <p className="mb-3 rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-yellow-50 px-4 py-3 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
              Elige arriba la sede donde estás para ver sus mesas y consultar
              cuentas.
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                Ver cuenta de mesa
              </span>
              <input
                value={selectedTable}
                onChange={(event) => {
                  setSelectedTable(event.target.value);
                  setLookupState(EMPTY_LOOKUP);
                }}
                list="public-open-account-tables"
                disabled={needsBranchSelection}
                placeholder="Ejemplo: Mesa 1"
                className="mt-2 h-12 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 text-sm font-black text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/40 focus:border-[var(--brand-primary)] disabled:opacity-50"
              />
              <datalist id="public-open-account-tables">
                {tables.map((table) => (
                  <option key={table.id || table.name} value={table.name} />
                ))}
              </datalist>
            </label>

            <button
              type="button"
              onClick={handleLookupAccount}
              disabled={
                !selectedTable.trim() || isLookupLoading || needsBranchSelection
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLookupLoading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Search size={17} />
              )}
              {lookupState.status === "open" ? "Actualizar cuenta" : "Ver cuenta"}
            </button>
          </div>

          {lookupState.status !== "idle" ? (
            <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                {lookupState.tableName || selectedTable}
              </p>
              <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                {lookupState.message}
              </p>

              {lookupState.status === "open" ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-2 text-xs font-black uppercase text-[var(--brand-primary)] sm:grid-cols-3">
                    <span className="rounded-2xl bg-[var(--brand-cream)] px-3 py-2">
                      Total {formatUSD(lookupState.account.totalEstimatedUSD)}
                    </span>
                    <span className="rounded-2xl bg-[var(--brand-cream)] px-3 py-2">
                      Cobrado {formatUSD(lookupState.account.totalCollectedUSD)}
                    </span>
                    <span className="rounded-2xl bg-[var(--brand-accent-100)] px-3 py-2 text-[var(--brand-ink)]">
                      Pendiente {formatUSD(lookupState.account.pendingUSD)}
                    </span>
                  </div>

                  {lookupState.account.orders.length > 0 ? (
                    <div className="space-y-2">
                      {lookupState.account.orders.map((order) => {
                        const lines = getOrderLines(order);

                        return (
                          <article
                            key={order.id}
                            className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-3 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                                  {order.displayNumber || order.id}
                                </p>
                                <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                                  {formatAccountDate(order.createdAt)}
                                </p>
                              </div>
                              <p className="text-xs font-black text-[var(--brand-ink)]">
                                {formatUSD(order.totalUSD)} · {getOrderStatusLabel(order.status)}
                              </p>
                            </div>

                            {lines.length > 0 ? (
                              <ul className="mt-2 space-y-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/75">
                                {lines.map((line, index) => (
                                  <li key={`${order.id}-${index}`}>• {line}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                                El detalle de productos aparecerá cuando el local actualice la cuenta.
                              </p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-3 py-3 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
                      Todavía no hay pedidos asociados a esta cuenta.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mt-5 text-center text-[0.72rem] font-bold text-[var(--brand-ink-2)]/55">
          ¿No ves el QR en tu mesa? Pídeselo al personal: pueden generar el código
          de cualquier mesa al instante.
        </p>
      </div>
    </section>
  );
}
