"use client";

import { AlertTriangle, CheckCircle2, Clock, CreditCard, Link2, Table2 } from "lucide-react";
import { formatUSD } from "@/utils/formatCurrency";

export type LocalTableMapItem = {
  id?: string;
  name: string;
  area?: string;
  sortOrder?: number;
  isActive?: boolean;
  note?: string;
};

type LocalTableMapOrder = {
  rowNumber?: number;
  branchNumber?: number;
  branchCode?: string;
  id: string;
  createdAt?: string;
  customerName?: string;
  tableNumber?: string;
  orderType?: string;
  status?: string;
  deliveryAddress?: string;
  deliveryReference?: string;
  deliveryZone?: string;
  deliveryCostUSD?: number;
  totalUSD?: number;
  totalPrice?: number;
  paymentStatus?: string;
  paymentPendingUSD?: number;
  paymentReceivedEquivalentUSD?: number;
  openAccountId?: string;
  openAccountStatus?: string;
  staffConfirmationStatus?: string;
  staffConfirmationPendingCount?: number;
  payment?: {
    status?: string;
    totalOrderUSD?: number;
    pendingUSD?: number;
    receivedEquivalentUSD?: number;
  };
};

type LocalTableMapOpenAccount = {
  id: string;
  tableNumber: string;
  customerName?: string;
  status?: string;
  orderIds?: string[];
  orders?: Array<{
    id: string;
    totalUSD?: number;
    pendingUSD?: number;
    paymentStatus?: string;
  }>;
  totalEstimatedUSD?: number;
  totalCollectedUSD?: number;
  pendingUSD?: number;
};

type TableStatus = "free" | "openAccount" | "active" | "pendingReview" | "pendingPayment";

type LocalTablesMapProps = {
  tables: LocalTableMapItem[];
  orders: LocalTableMapOrder[];
  openAccounts?: LocalTableMapOpenAccount[];
  title?: string;
  description?: string;
  compact?: boolean;
  selectedTableName?: string;
  onSelectTable?: (tableName: string) => void;
  onClearSelection?: () => void;
  emptyMessage?: string;
  showOrderPreview?: boolean;
};

export const DEFAULT_LOCAL_TABLES: LocalTableMapItem[] = [
  { id: "mesa-1", name: "Mesa 1", area: "Principal", sortOrder: 1, isActive: true },
  { id: "mesa-2", name: "Mesa 2", area: "Principal", sortOrder: 2, isActive: true },
  { id: "mesa-3", name: "Mesa 3", area: "Principal", sortOrder: 3, isActive: true },
  { id: "mesa-4", name: "Mesa 4", area: "Principal", sortOrder: 4, isActive: true },
  { id: "barra", name: "Barra", area: "Barra", sortOrder: 5, isActive: true },
  { id: "afuera", name: "Afuera", area: "Exterior", sortOrder: 6, isActive: true },
];

export function normalizeLocalTableText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const normalized = normalizeLocalTableText(value);

  if (["true", "1", "si", "sí", "activo", "activa", "enabled", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "inactivo", "inactiva", "disabled", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function createTableId(name: string, index: number) {
  const cleanName = normalizeLocalTableText(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return cleanName || `mesa-${index + 1}`;
}

export function normalizeLocalTablesForMap(value: unknown, fallback = DEFAULT_LOCAL_TABLES) {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? (() => {
          try {
            const parsedValue = JSON.parse(value);
            return Array.isArray(parsedValue) ? parsedValue : value.split(/[;,|\n]/g);
          } catch {
            return value.split(/[;,|\n]/g);
          }
        })()
      : [];
  const seen = new Set<string>();
  const tables: LocalTableMapItem[] = [];

  rawList.forEach((item, index) => {
    const rawItem = item && typeof item === "object"
      ? (item as Partial<LocalTableMapItem>)
      : { name: String(item || "") };
    const name = String(rawItem.name || "").trim();
    const key = normalizeLocalTableText(name);

    if (!name || !key || seen.has(key)) return;

    seen.add(key);

    const sortOrder = Number(rawItem.sortOrder || index + 1);

    tables.push({
      id: String(rawItem.id || "").trim() || createTableId(name, index),
      name,
      area: String(rawItem.area || "Principal").trim() || "Principal",
      sortOrder: Number.isFinite(sortOrder) && sortOrder > 0 ? Math.round(sortOrder) : index + 1,
      isActive: normalizeBoolean(rawItem.isActive, true),
      note: String(rawItem.note || "").trim(),
    });
  });

  const result = tables.length ? tables : fallback;

  return [...result].sort((first, second) => {
    const firstOrder = Number(first.sortOrder || 9999);
    const secondOrder = Number(second.sortOrder || 9999);

    if (firstOrder !== secondOrder) return firstOrder - secondOrder;

    return String(first.name || "").localeCompare(String(second.name || ""));
  });
}

export function getActiveLocalTableNamesForMap(tables: LocalTableMapItem[]) {
  const names = normalizeLocalTablesForMap(tables)
    .filter((table) => table.isActive !== false)
    .map((table) => String(table.name || "").trim())
    .filter(Boolean);

  return names.length ? names : DEFAULT_LOCAL_TABLES.map((table) => table.name);
}

function isDeliveryOrder(order: LocalTableMapOrder) {
  return (
    order.orderType === "Delivery" ||
    normalizeLocalTableText(order.tableNumber).startsWith("delivery") ||
    Boolean(order.deliveryAddress || order.deliveryReference || order.deliveryZone || Number(order.deliveryCostUSD || 0) > 0)
  );
}

function getOrderTotalUSD(order: LocalTableMapOrder) {
  const total = Number(
    order.totalUSD ||
      order.totalPrice ||
      order.payment?.totalOrderUSD ||
      0,
  );

  return Number.isFinite(total) ? total : 0;
}

function getOrderPaymentStatus(order: LocalTableMapOrder) {
  return String(order.payment?.status || order.paymentStatus || "Pendiente").trim() || "Pendiente";
}

function hasPendingStaffConfirmation(order: LocalTableMapOrder) {
  return (
    String(order.staffConfirmationStatus || "").trim() === "pending" ||
    String(order.staffConfirmationStatus || "").trim() === "partial" ||
    Number(order.staffConfirmationPendingCount || 0) > 0
  );
}

function getOrderPendingUSD(order: LocalTableMapOrder) {
  const pending = Number(
    order.payment?.pendingUSD ??
      order.paymentPendingUSD ??
      Math.max(getOrderTotalUSD(order) - Number(order.payment?.receivedEquivalentUSD || order.paymentReceivedEquivalentUSD || 0), 0),
  );

  return Number.isFinite(pending) && pending > 0 ? pending : 0;
}

function getDisplayOrderNumber(order: LocalTableMapOrder) {
  if (order.branchNumber && order.branchNumber > 0) {
    return `#${String(order.branchNumber).padStart(2, "0")}${
      order.branchCode ? `-${order.branchCode}` : ""
    }`;
  }

  if (order.rowNumber && order.rowNumber > 1) {
    return `#${order.rowNumber - 1}`;
  }

  const orderId = String(order.id || "").trim();
  const parts = orderId.split("-");
  const lastPart = parts[parts.length - 1] || orderId;

  return `#${lastPart.slice(-3)}`;
}

function isOpenAccountActive(account: LocalTableMapOpenAccount) {
  return String(account.status || "Abierta").trim() === "Abierta";
}

function getAccountPendingUSD(account: LocalTableMapOpenAccount) {
  const pending = Number(account.pendingUSD || 0);

  if (Number.isFinite(pending) && pending > 0) {
    return pending;
  }

  const total = Number(account.totalEstimatedUSD || 0);
  const collected = Number(account.totalCollectedUSD || 0);
  const calculatedPending = total - collected;

  return Number.isFinite(calculatedPending) && calculatedPending > 0 ? calculatedPending : 0;
}

function getAccountOrdersCount(account: LocalTableMapOpenAccount) {
  if (Array.isArray(account.orders) && account.orders.length) return account.orders.length;
  if (Array.isArray(account.orderIds) && account.orderIds.length) return account.orderIds.length;
  return 0;
}

function getTableSummary(
  tableName: string,
  orders: LocalTableMapOrder[],
  openAccounts: LocalTableMapOpenAccount[] = [],
) {
  const normalizedTable = normalizeLocalTableText(tableName);
  const activeOpenAccounts = openAccounts.filter((account) => {
    return (
      isOpenAccountActive(account) &&
      normalizeLocalTableText(account.tableNumber) === normalizedTable
    );
  });
  const tableOrders = orders.filter((order) => {
    return (
      order.orderType === "Comer aquí" &&
      !isDeliveryOrder(order) &&
      normalizeLocalTableText(order.tableNumber) === normalizedTable &&
      order.status !== "Cancelado"
    );
  });
  const activeOrders = tableOrders.filter((order) => order.status !== "Entregado");
  const pendingStaffReviewOrders = tableOrders.filter(hasPendingStaffConfirmation);
  const pendingPaymentOrders = tableOrders.filter((order) => getOrderPaymentStatus(order) !== "Pagado");
  const ordersTotalUSD = tableOrders.reduce((total, order) => total + getOrderTotalUSD(order), 0);
  const ordersPendingUSD = pendingPaymentOrders.reduce((total, order) => total + getOrderPendingUSD(order), 0);
  const accountsTotalUSD = activeOpenAccounts.reduce(
    (total, account) => total + Number(account.totalEstimatedUSD || 0),
    0,
  );
  const accountsPendingUSD = activeOpenAccounts.reduce(
    (total, account) => total + getAccountPendingUSD(account),
    0,
  );
  const accountOrdersCount = activeOpenAccounts.reduce(
    (total, account) => total + getAccountOrdersCount(account),
    0,
  );
  const hasOpenAccount =
    activeOpenAccounts.length > 0 ||
    tableOrders.some(
      (order) => String(order.openAccountId || "").trim() && order.openAccountStatus === "Abierta",
    );
  const totalUSD = Math.max(ordersTotalUSD, accountsTotalUSD);
  const pendingUSD = Math.max(ordersPendingUSD, accountsPendingUSD);
  const status: TableStatus = pendingStaffReviewOrders.length
    ? "pendingReview"
    : pendingPaymentOrders.length || accountsPendingUSD > 0
      ? "pendingPayment"
      : activeOrders.length
        ? "active"
        : activeOpenAccounts.length
          ? "openAccount"
          : "free";

  return {
    status,
    tableOrders,
    activeOrders,
    pendingPaymentOrders,
    pendingStaffReviewOrders,
    totalUSD,
    pendingUSD,
    hasOpenAccount,
    activeOpenAccounts,
    accountOrdersCount,
  };
}

function getStatusLabel(status: TableStatus) {
  if (status === "pendingReview") return "Por revisar";
  if (status === "pendingPayment") return "Por cobrar";
  if (status === "active") return "Con pedidos";
  if (status === "openAccount") return "Cuenta abierta";
  return "Libre";
}

function getStatusIcon(status: TableStatus) {
  if (status === "pendingReview") return <AlertTriangle size={15} />;
  if (status === "pendingPayment") return <CreditCard size={15} />;
  if (status === "active" || status === "openAccount") return <Clock size={15} />;
  return <CheckCircle2 size={15} />;
}

function getCardClass(status: TableStatus, selected: boolean) {
  const selectedClass = selected ? "ring-4 ring-[var(--brand-accent)]" : "";

  if (status === "pendingReview") {
    return `border-orange-500 bg-orange-50 text-[var(--brand-ink)] ${selectedClass}`;
  }

  if (status === "pendingPayment") {
    return `border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)] ${selectedClass}`;
  }

  if (status === "active") {
    return `border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-ink)] ${selectedClass}`;
  }

  if (status === "openAccount") {
    return `border-blue-600 bg-blue-50 text-[#17324d] ${selectedClass}`;
  }

  return `border-green-700 bg-green-50 text-green-800 ${selectedClass}`;
}

function groupTablesByArea(tables: LocalTableMapItem[]) {
  return normalizeLocalTablesForMap(tables)
    .filter((table) => table.isActive !== false)
    .reduce<Record<string, LocalTableMapItem[]>>((groups, table) => {
      const area = String(table.area || "Principal").trim() || "Principal";

      if (!groups[area]) groups[area] = [];

      groups[area].push(table);
      return groups;
    }, {});
}

export function LocalTablesMap({
  tables,
  orders,
  openAccounts = [],
  title = "Mapa de mesas",
  description = "Vista rápida del consumo en local por mesa. El estado se calcula con pedidos activos, cuentas abiertas y cobros pendientes.",
  compact = false,
  selectedTableName = "",
  onSelectTable,
  onClearSelection,
  emptyMessage = "No hay mesas activas configuradas.",
  showOrderPreview = true,
}: LocalTablesMapProps) {
  const groupedTables = groupTablesByArea(tables);
  const areaNames = Object.keys(groupedTables);
  const selectedKey = normalizeLocalTableText(selectedTableName);

  return (
    <section className={`rounded-[1.5rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)] ${compact ? "p-4" : "p-4 sm:p-5"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            <Table2 size={18} />
            {title}
          </p>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            {description}
          </p>
        </div>

        {selectedTableName && onClearSelection && (
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50"
          >
            Ver todas
          </button>
        )}
      </div>

      {areaNames.length === 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] p-5 text-sm font-bold text-[var(--brand-ink-2)]/70">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {areaNames.map((area) => (
            <div key={area}>
              <p className="mb-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]/70">
                {area}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {groupedTables[area].map((table) => {
                  const summary = getTableSummary(table.name, orders, openAccounts);
                  const isSelected = selectedKey === normalizeLocalTableText(table.name);
                  const totalOrdersCount = Math.max(
                    summary.tableOrders.length,
                    summary.accountOrdersCount,
                  );
                  // Tarjeta compacta: nombre + estado + lo esencial en una
                  // línea. El detalle (cuentas y pedidos) aparece solo al
                  // tocar la mesa, para que el mapa no sature la pantalla.
                  const cardContent = (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-base font-black uppercase text-[var(--brand-ink-3)]">{table.name}</p>
                        <p className="inline-flex shrink-0 items-center gap-1 text-[0.65rem] font-black uppercase tracking-[0.1em] opacity-80">
                          {getStatusIcon(summary.status)}
                          {getStatusLabel(summary.status)}
                        </p>
                      </div>

                      {summary.status !== "free" && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] font-black">
                          <span>{totalOrdersCount} pedido(s)</span>
                          {summary.pendingUSD > 0 && (
                            <span>Pendiente {formatUSD(summary.pendingUSD)}</span>
                          )}
                          {summary.hasOpenAccount && (
                            <span className="inline-flex items-center gap-1">
                              <Link2 size={12} />
                              Cuenta abierta
                            </span>
                          )}
                          {summary.pendingStaffReviewOrders.length > 0 && (
                            <span>{summary.pendingStaffReviewOrders.length} por revisar</span>
                          )}
                        </div>
                      )}

                      {/* Detalle solo de la mesa seleccionada. */}
                      {isSelected && summary.status !== "free" && (
                        <div className="mt-3 space-y-1">
                          <p className="rounded-xl bg-white/80 px-3 py-2 text-[0.68rem] font-black text-[#1a1a1a]">
                            Total mesa/cuenta: {formatUSD(summary.totalUSD)} · Activos: {summary.activeOrders.length}
                          </p>

                          {summary.activeOpenAccounts.slice(0, 2).map((account) => (
                            <p key={account.id} className="rounded-xl bg-white/80 px-3 py-2 text-[0.68rem] font-bold text-[#1a1a1a]">
                              Cuenta abierta · {account.customerName || account.tableNumber || "Mesa"} · Pendiente {formatUSD(getAccountPendingUSD(account))}
                            </p>
                          ))}

                          {showOrderPreview &&
                            summary.tableOrders.slice(0, 3).map((order) => (
                              <p key={order.id} className="rounded-xl bg-white/80 px-3 py-2 text-[0.68rem] font-bold text-[#1a1a1a]">
                                {getDisplayOrderNumber(order)} · {order.customerName || "Cliente"} · {hasPendingStaffConfirmation(order) ? "Por revisar" : getOrderPaymentStatus(order)}
                              </p>
                            ))}

                          {showOrderPreview && summary.tableOrders.length > 3 && (
                            <p className="rounded-xl bg-white/80 px-3 py-2 text-[0.68rem] font-black text-[#1a1a1a]/70">
                              +{summary.tableOrders.length - 3} pedido(s) más
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );

                  if (!onSelectTable) {
                    return (
                      <article key={table.id || table.name} className={`rounded-2xl border-2 p-3 ${getCardClass(summary.status, isSelected)}`}>
                        {cardContent}
                      </article>
                    );
                  }

                  return (
                    <button
                      key={table.id || table.name}
                      type="button"
                      onClick={() => onSelectTable(table.name)}
                      className={`rounded-2xl border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.10)] ${getCardClass(summary.status, isSelected)}`}
                    >
                      {cardContent}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
