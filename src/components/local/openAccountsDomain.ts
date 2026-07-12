// Lógica pura de cuentas abiertas: tipos, formularios vacíos y cálculos.
// Sin React ni fetch, para poder probarla con vitest. La UI vive en
// OpenAccountsPanel.tsx y openAccountsComponents.tsx.

import type {
  LocalOrder,
  OpenAccount,
  OpenAccountOrderSummary,
} from "@/types/localOrders";
import {
  getDisplayOrderNumber,
  isDeliveryOrder,
  normalizeComparableText,
} from "@/lib/localOrderHelpers";
import { getOrderPayment, getOrderTotals } from "@/lib/localOrderMoney";

type CreateAccountForm = {
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  note: string;
};

type AccountPaymentForm = {
  amountReceivedUSD: string;
  amountReceivedVES: string;
  paymentMethodUSD: string;
  paymentMethodVES: string;
  deliveryPaymentIn: "Divisas" | "Bolívares" | "Mixto" | "Sin registrar";
  paymentNote: string;
};

type AccountViewMode = "open" | "all";

const EMPTY_CREATE_FORM: CreateAccountForm = {
  tableNumber: "",
  customerName: "",
  customerPhone: "",
  note: "",
};

const EMPTY_ACCOUNT_PAYMENT_FORM: AccountPaymentForm = {
  amountReceivedUSD: "",
  amountReceivedVES: "",
  paymentMethodUSD: "",
  paymentMethodVES: "",
  deliveryPaymentIn: "Sin registrar",
  paymentNote: "",
};

async function readApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || "Respuesta inválida" };
  }
}

function isEligibleOrderForOpenAccount(order: LocalOrder) {
  return (
    order.orderType === "Comer aquí" &&
    !isDeliveryOrder(order) &&
    order.status !== "Cancelado"
  );
}

function getOrderAccountId(order: LocalOrder) {
  return String(order.openAccountId || "").trim();
}

function getNormalizedTable(value: string) {
  return normalizeComparableText(value).replace(/\s+/g, " ");
}

function isSameTable(account: OpenAccount, order: LocalOrder) {
  const accountTable = getNormalizedTable(account.tableNumber);
  const orderTable = getNormalizedTable(order.tableNumber);

  return Boolean(accountTable && orderTable && accountTable === orderTable);
}

function buildOrderSummaryFromLocalOrder(
  order: LocalOrder,
): OpenAccountOrderSummary {
  const payment = getOrderPayment(order);
  const totals = getOrderTotals(order);

  return {
    id: order.id,
    displayNumber: getDisplayOrderNumber(order),
    customerName: order.customerName,
    tableNumber: order.tableNumber,
    orderType: order.orderType,
    status: order.status,
    paymentStatus: payment.status,
    totalUSD: totals.totalUSD,
    exchangeRate: Number(order.exchangeRate || 0),
    receivedEquivalentUSD: payment.receivedEquivalentUSD,
    pendingUSD: payment.pendingUSD,
    createdAt: order.createdAt,
    itemsText: order.itemsText,
    items: order.items,
  };
}

function mergeAccountOrders(account: OpenAccount, orders: LocalOrder[]) {
  const linkedIds = new Set(account.orderIds || []);

  orders.forEach((order) => {
    if (getOrderAccountId(order) === account.id) {
      linkedIds.add(order.id);
    }
  });

  const localOrders = orders
    .filter((order) => linkedIds.has(order.id))
    .map(buildOrderSummaryFromLocalOrder);

  const localOrderIds = new Set(localOrders.map((order) => order.id));
  const savedOrders = (account.orders || []).filter(
    (order) => !localOrderIds.has(order.id),
  );

  return [...localOrders, ...savedOrders].sort((a, b) => {
    const firstDate = String(a.createdAt || "");
    const secondDate = String(b.createdAt || "");

    return firstDate.localeCompare(secondDate);
  });
}

function getComputedAccountTotals(
  account: OpenAccount,
  accountOrders: OpenAccountOrderSummary[],
) {
  const totalEstimatedUSD = accountOrders.length
    ? accountOrders.reduce(
        (total, order) => total + Number(order.totalUSD || 0),
        0,
      )
    : Number(account.totalEstimatedUSD || 0);
  const totalCollectedUSD = accountOrders.length
    ? accountOrders.reduce(
        (total, order) => total + Number(order.receivedEquivalentUSD || 0),
        0,
      )
    : Number(account.totalCollectedUSD || 0);
  const pendingUSD = accountOrders.length
    ? accountOrders.reduce(
        (total, order) => total + Number(order.pendingUSD || 0),
        0,
      )
    : Number(account.pendingUSD || 0);

  return {
    totalEstimatedUSD,
    totalCollectedUSD,
    pendingUSD,
  };
}

function formatAccountStatusLabel(status: OpenAccount["status"]) {
  if (status === "Cerrada") return "Cuenta cerrada";
  if (status === "Cancelada") return "Cuenta cancelada";
  return "Cuenta abierta";
}

function getAccountStatusClasses(status: OpenAccount["status"]) {
  if (status === "Cerrada")
    return "border-green-700 bg-green-100 text-green-800";
  if (status === "Cancelada")
    return "border-zinc-500 bg-zinc-100 text-zinc-700";
  return "border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-primary)]";
}

function formatAccountDate(value?: string) {
  if (!value) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getAccountPendingOrdersCount(
  accountOrders: OpenAccountOrderSummary[],
) {
  return accountOrders.filter((order) => Number(order.pendingUSD || 0) > 0.01)
    .length;
}

function getAccountDeliveryStats(accountOrders: OpenAccountOrderSummary[]) {
  return accountOrders.reduce(
    (summary, order) => {
      if (order.status === "Cancelado") {
        summary.cancelled += 1;
      } else if (order.status === "Entregado") {
        summary.delivered += 1;
      } else if (order.status === "Listo") {
        summary.ready += 1;
      } else {
        summary.inProgress += 1;
      }

      return summary;
    },
    { delivered: 0, ready: 0, inProgress: 0, cancelled: 0 },
  );
}

function getAccountDeliveryTone(accountOrders: OpenAccountOrderSummary[]) {
  const stats = getAccountDeliveryStats(accountOrders);
  const activeOrders = accountOrders.length - stats.cancelled;

  if (activeOrders <= 0) {
    return {
      label: "Sin entregas activas",
      className:
        "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]",
      text: "La cuenta todavía no tiene pedidos activos para entregar.",
    };
  }

  if (stats.delivered >= activeOrders) {
    return {
      label: "Todo entregado",
      className: "border-green-700 bg-green-100 text-green-800",
      text: "Todos los pedidos activos de esta cuenta están marcados como entregados.",
    };
  }

  if (stats.ready > 0) {
    return {
      label: "Listo para entregar",
      className:
        "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]",
      text: `${stats.ready} pedido(s) listos esperan entrega en mesa.`,
    };
  }

  return {
    label: "En preparación",
    className: "border-orange-400 bg-orange-50 text-orange-900",
    text: `${stats.inProgress} pedido(s) todavía en preparación o recién registrados.`,
  };
}

function getOrderDeliveryLabel(status: OpenAccountOrderSummary["status"]) {
  if (status === "Entregado") return "Entregado";
  if (status === "Listo") return "Listo para entregar";
  if (status === "Preparando") return "En preparación";
  if (status === "Cancelado") return "Cancelado";
  return "Pendiente cocina";
}

function getOrderDeliveryTone(status: OpenAccountOrderSummary["status"]) {
  if (status === "Entregado") return "success";
  if (status === "Listo") return "warning";
  if (status === "Cancelado") return "muted";
  return "default";
}

function getAccountOperationalTone(
  totals: { pendingUSD: number },
  accountOrders: OpenAccountOrderSummary[],
) {
  const pendingOrders = getAccountPendingOrdersCount(accountOrders);

  if (pendingOrders > 0 || totals.pendingUSD > 0.01) {
    return {
      label: "Por cobrar",
      className:
        "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]",
      text: `${pendingOrders || accountOrders.length} pedido(s) con saldo pendiente. Caja debe registrar cobros por pedido antes o después de cerrar administrativamente.`,
    };
  }

  if (accountOrders.length > 0) {
    return {
      label: "Sin pendiente",
      className: "border-green-700 bg-green-100 text-green-800",
      text: "Los pedidos asociados no muestran pendiente. Cerrar cuenta solo la saca de operación activa.",
    };
  }

  return {
    label: "Sin pedidos",
    className:
      "border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] text-[var(--brand-ink)]",
    text: "La cuenta está abierta para la mesa, pero todavía no tiene pedidos asociados.",
  };
}


function getAccountRepresentativeExchangeRate(
  accountOrders: OpenAccountOrderSummary[],
) {
  const orderWithRate = accountOrders.find(
    (order) => Number(order.exchangeRate || 0) > 0,
  );
  return Number(orderWithRate?.exchangeRate || 0);
}

export type { CreateAccountForm, AccountPaymentForm, AccountViewMode };
export {
  EMPTY_CREATE_FORM,
  EMPTY_ACCOUNT_PAYMENT_FORM,
  readApiResponse,
  isEligibleOrderForOpenAccount,
  getOrderAccountId,
  getNormalizedTable,
  isSameTable,
  buildOrderSummaryFromLocalOrder,
  mergeAccountOrders,
  getComputedAccountTotals,
  formatAccountStatusLabel,
  getAccountStatusClasses,
  formatAccountDate,
  getAccountPendingOrdersCount,
  getAccountDeliveryStats,
  getAccountDeliveryTone,
  getOrderDeliveryLabel,
  getOrderDeliveryTone,
  getAccountOperationalTone,
  getAccountRepresentativeExchangeRate,
};
