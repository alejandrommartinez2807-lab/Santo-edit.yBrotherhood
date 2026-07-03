"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Store,
} from "lucide-react";
import { formatUSD } from "@/utils/formatCurrency";
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

type OpenAccountsPanelProps = {
  adminPassword: string;
  orders: LocalOrder[];
  canManage?: boolean;
  canCloseAccounts?: boolean;
  canRegisterPayments?: boolean;
  compact?: boolean;
  title?: string;
  description?: string;
  closeRoleLabel?: string;
  tableOptions?: string[];
  preferredTableName?: string;
  onOrdersShouldRefresh?: () => void;
};

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

const PAYMENT_METHOD_USD_OPTIONS = [
  "",
  "Efectivo divisas",
  "Zelle",
  "Binance",
  "USDT",
  "Transferencia internacional",
  "Otro",
];

const PAYMENT_METHOD_VES_OPTIONS = [
  "",
  "Pago móvil",
  "Punto",
  "Transferencia",
  "Efectivo Bs",
  "Biopago",
  "Otro",
];

const DELIVERY_PAYMENT_OPTIONS: AccountPaymentForm["deliveryPaymentIn"][] = [
  "Sin registrar",
  "Divisas",
  "Bolívares",
  "Mixto",
];

async function readApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || "Respuesta inválida" };
  }
}

function roundMoney(value: unknown) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

function parseMoneyInput(value: string) {
  const rawValue = String(value || "")
    .trim()
    .replace(/\s/g, "");
  if (!rawValue) return 0;

  const hasComma = rawValue.includes(",");
  const hasDot = rawValue.includes(".");
  const lastCommaIndex = rawValue.lastIndexOf(",");
  const lastDotIndex = rawValue.lastIndexOf(".");
  let normalizedValue = rawValue;

  if (hasComma && hasDot) {
    if (lastCommaIndex > lastDotIndex) {
      normalizedValue = rawValue.replace(/\./g, "").replace(",", ".");
    } else {
      normalizedValue = rawValue.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalizedValue = rawValue.replace(",", ".");
  }

  const numberValue = Number(normalizedValue);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0;
  return roundMoney(numberValue);
}

function formatMoneyForInput(value: number) {
  const moneyValue = roundMoney(value);
  if (moneyValue <= 0) return "";
  return moneyValue.toFixed(2);
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

export function OpenAccountsPanel({
  adminPassword,
  orders,
  canManage = true,
  canCloseAccounts = canManage,
  canRegisterPayments = canCloseAccounts,
  compact = false,
  title = "Cuentas abiertas",
  description = "Abre una cuenta para una mesa o ubicación, asocia pedidos de consumo local y ciérrala desde caja. Cerrar una cuenta no registra cobro ni cambia estados de pago.",
  closeRoleLabel = "Caja",
  tableOptions = [],
  preferredTableName = "",
  onOrdersShouldRefresh,
}: OpenAccountsPanelProps) {
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<CreateAccountForm>(EMPTY_CREATE_FORM);
  const [selectedOrderByAccount, setSelectedOrderByAccount] = useState<
    Record<string, string>
  >({});
  const [viewMode, setViewMode] = useState<AccountViewMode>("open");
  const [expandedAccounts, setExpandedAccounts] = useState<
    Record<string, boolean>
  >({});
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [accountPaymentForm, setAccountPaymentForm] =
    useState<AccountPaymentForm>(EMPTY_ACCOUNT_PAYMENT_FORM);
  const [closeAfterAccountPayment, setCloseAfterAccountPayment] =
    useState(false);

  const activeAccounts = useMemo(
    () => openAccounts.filter((account) => account.status === "Abierta"),
    [openAccounts],
  );

  const visibleAccounts = useMemo(
    () => (viewMode === "all" ? openAccounts : activeAccounts),
    [activeAccounts, openAccounts, viewMode],
  );

  const eligibleOrders = useMemo(
    () => orders.filter(isEligibleOrderForOpenAccount),
    [orders],
  );

  const unlinkedEligibleOrders = useMemo(
    () => eligibleOrders.filter((order) => !getOrderAccountId(order)),
    [eligibleOrders],
  );
  const knownTableOptions = useMemo(() => {
    const options = [
      ...tableOptions,
      ...eligibleOrders.map((order) => order.tableNumber),
    ];
    const seen = new Set<string>();

    return options
      .map((option) => String(option || "").trim())
      .filter(Boolean)
      .filter((option) => {
        const key = getNormalizedTable(option);

        if (!key || seen.has(key)) return false;

        seen.add(key);
        return true;
      });
  }, [eligibleOrders, tableOptions]);

  const activeTotals = useMemo(() => {
    return activeAccounts.reduce(
      (summary, account) => {
        const accountOrders = mergeAccountOrders(account, orders);
        const totals = getComputedAccountTotals(account, accountOrders);

        summary.totalEstimatedUSD += totals.totalEstimatedUSD;
        summary.totalCollectedUSD += totals.totalCollectedUSD;
        summary.pendingUSD += totals.pendingUSD;
        summary.ordersCount += accountOrders.length;

        return summary;
      },
      {
        totalEstimatedUSD: 0,
        totalCollectedUSD: 0,
        pendingUSD: 0,
        ordersCount: 0,
      },
    );
  }, [activeAccounts, orders]);

  const cleanPreferredTableName = preferredTableName.trim();

  function applyTableToForm(tableName: string) {
    const cleanTableName = tableName.trim();

    if (!cleanTableName) return;

    setForm((current) => ({
      ...current,
      tableNumber: cleanTableName,
      customerName: current.customerName.trim() || cleanTableName,
    }));
  }

  useEffect(() => {
    if (!canManage || !cleanPreferredTableName) return;

    // Difiere el setState un tick para no hacerlo síncrono en el efecto.
    const timer = setTimeout(() => syncFormWithPreferredTable(), 0);
    return () => clearTimeout(timer);

    function syncFormWithPreferredTable() {
      setForm((current) => {
      if (
        getNormalizedTable(current.tableNumber) ===
        getNormalizedTable(cleanPreferredTableName)
      ) {
        return current;
      }

        return {
          ...current,
          tableNumber: cleanPreferredTableName,
          customerName: current.customerName.trim() || cleanPreferredTableName,
        };
      });
    }
  }, [canManage, cleanPreferredTableName]);

  async function loadOpenAccounts(
    silent = false,
    requestedViewMode: AccountViewMode = viewMode,
  ) {
    if (!adminPassword) return;

    if (!silent) setIsLoading(true);
    setMessage(null);

    try {
      const statusParam = requestedViewMode === "all" ? "all" : "Abierta";
      const response = await fetch(
        `/api/open-accounts?status=${encodeURIComponent(statusParam)}`,
        {
          headers: { "x-admin-password": adminPassword },
          cache: "no-store",
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        setOpenAccounts([]);
        throw new Error(
          data.error ||
            data.message ||
            "No se pudieron cargar las cuentas abiertas",
        );
      }

      setOpenAccounts(
        Array.isArray(data.openAccounts) ? data.openAccounts : [],
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las cuentas abiertas",
      );
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function changeViewMode(nextViewMode: AccountViewMode) {
    setViewMode(nextViewMode);
    await loadOpenAccounts(false, nextViewMode);
  }

  async function createOpenAccount() {
    if (!canManage || isSaving) return;

    const tableNumber = form.tableNumber.trim();
    const customerName = form.customerName.trim() || tableNumber;

    if (!tableNumber) {
      setMessage("Indica la mesa o ubicación para abrir la cuenta.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/open-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          tableNumber,
          customerName,
          customerPhone: form.customerPhone.trim(),
          note: form.note.trim(),
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo abrir la cuenta",
        );
      }

      setForm(EMPTY_CREATE_FORM);
      setExpandedAccounts((current) => ({
        ...current,
        [data.openAccount?.id || ""]: true,
      }));
      setMessage("Cuenta abierta correctamente.");
      await loadOpenAccounts(true);
      onOrdersShouldRefresh?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo abrir la cuenta",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function attachOrder(accountId: string) {
    if (!canManage || isSaving) return;

    const orderId = selectedOrderByAccount[accountId];

    if (!orderId) {
      setMessage("Selecciona un pedido local para asociar a la cuenta.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(accountId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({ action: "attachOrder", orderId }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo asociar el pedido",
        );
      }

      setSelectedOrderByAccount((current) => ({ ...current, [accountId]: "" }));
      setExpandedAccounts((current) => ({ ...current, [accountId]: true }));
      setMessage("Pedido asociado a la cuenta abierta.");
      await loadOpenAccounts(true);
      onOrdersShouldRefresh?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo asociar el pedido",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateAccountOrderStatus(
    accountId: string,
    orderId: string,
    status: "Listo" | "Entregado",
  ) {
    if (!canManage || isSaving) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(accountId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({
            action: "updateOrderStatus",
            orderId,
            status,
          }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo actualizar la entrega",
        );
      }

      setExpandedAccounts((current) => ({ ...current, [accountId]: true }));
      setMessage(
        status === "Entregado"
          ? "Pedido marcado como entregado en la cuenta."
          : "Pedido reabierto como listo/no entregado.",
      );
      await loadOpenAccounts(true);
      onOrdersShouldRefresh?.();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la entrega",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function closeAccount(
    account: OpenAccount,
    accountOrders: OpenAccountOrderSummary[],
  ) {
    if (
      !canManage ||
      !canCloseAccounts ||
      isSaving ||
      account.status !== "Abierta"
    )
      return;

    const totals = getComputedAccountTotals(account, accountOrders);
    const hasPending = Number(totals.pendingUSD || 0) > 0.01;
    const confirmed = window.confirm(
      hasPending
        ? `Esta cuenta todavía tiene ${formatUSD(totals.pendingUSD)} pendiente. Cerrar la cuenta no registra cobro ni cambia estados de pago. ¿Quieres cerrarla igualmente?`
        : "Cerrar la cuenta no registra cobro adicional. ¿Confirmas el cierre?",
    );

    if (!confirmed) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(account.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({ action: "close", closedBy: closeRoleLabel }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo cerrar la cuenta",
        );
      }

      setMessage(
        "Cuenta cerrada correctamente. Los cobros reales no fueron modificados.",
      );
      await loadOpenAccounts(true);
      onOrdersShouldRefresh?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo cerrar la cuenta",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openAccountPayment(
    account: OpenAccount,
    accountOrders: OpenAccountOrderSummary[],
  ) {
    const totals = getComputedAccountTotals(account, accountOrders);

    setPaymentAccountId(account.id);
    setCloseAfterAccountPayment(false);
    setAccountPaymentForm({
      ...EMPTY_ACCOUNT_PAYMENT_FORM,
      amountReceivedUSD: formatMoneyForInput(totals.pendingUSD),
      paymentNote: `Cobro de cuenta abierta ${account.tableNumber}`.trim(),
    });
    setExpandedAccounts((current) => ({ ...current, [account.id]: true }));
    setMessage(null);
  }

  function updateAccountPaymentForm<K extends keyof AccountPaymentForm>(
    field: K,
    value: AccountPaymentForm[K],
  ) {
    setAccountPaymentForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
  }

  function getAccountRepresentativeExchangeRate(
    accountOrders: OpenAccountOrderSummary[],
  ) {
    const orderWithRate = accountOrders.find(
      (order) => Number(order.exchangeRate || 0) > 0,
    );
    return Number(orderWithRate?.exchangeRate || 0);
  }

  async function saveAccountPayment(account: OpenAccount) {
    if (!canRegisterPayments || isSaving) return;

    const amountReceivedUSD = parseMoneyInput(
      accountPaymentForm.amountReceivedUSD,
    );
    const amountReceivedVES = parseMoneyInput(
      accountPaymentForm.amountReceivedVES,
    );

    if (amountReceivedUSD <= 0 && amountReceivedVES <= 0) {
      setMessage("Indica el monto recibido para cobrar la cuenta.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(account.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({
            action: "payAccount",
            amountReceivedUSD,
            amountReceivedVES,
            paymentMethodUSD: accountPaymentForm.paymentMethodUSD,
            paymentMethodVES: accountPaymentForm.paymentMethodVES,
            deliveryPaymentIn: accountPaymentForm.deliveryPaymentIn,
            paymentNote: accountPaymentForm.paymentNote,
            closeIfPaid: closeAfterAccountPayment,
            closedBy: closeRoleLabel,
          }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo cobrar la cuenta",
        );
      }

      const unusedUSD = Number(data.unusedAmountUSD || 0);
      const unusedVES = Number(data.unusedAmountVES || 0);
      const unusedMessage =
        unusedUSD > 0.01 || unusedVES > 0.01
          ? ` Quedó un excedente no aplicado: ${formatUSD(unusedUSD)}${unusedVES > 0.01 ? ` / Bs ${unusedVES.toFixed(2)}` : ""}.`
          : "";

      setPaymentAccountId("");
      setAccountPaymentForm(EMPTY_ACCOUNT_PAYMENT_FORM);
      setCloseAfterAccountPayment(false);
      setMessage(
        `Cobro aplicado a la cuenta de ${account.tableNumber}.${unusedMessage}`,
      );
      await loadOpenAccounts(true);
      onOrdersShouldRefresh?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo cobrar la cuenta",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function toggleAccountDetails(accountId: string) {
    setExpandedAccounts((current) => ({
      ...current,
      [accountId]: !current[accountId],
    }));
  }

  useEffect(() => {
    if (!adminPassword) return;
    const timer = setTimeout(() => loadOpenAccounts(true), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword, orders.length]);

  const wrapperClass = compact
    ? "mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]"
    : "mt-4 rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white p-4 shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)] sm:p-5";

  return (
    <section className={wrapperClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            <Store size={18} />
            {title}
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase text-[var(--brand-ink-2)]">
            Consumo local por cuenta
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => changeViewMode("open")}
            disabled={isLoading || viewMode === "open"}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50 disabled:bg-[var(--brand-primary)] disabled:text-white"
          >
            Abiertas
          </button>
          <button
            type="button"
            onClick={() => changeViewMode("all")}
            disabled={isLoading || viewMode === "all"}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50 disabled:bg-[var(--brand-primary)] disabled:text-white"
          >
            Historial
          </button>
          <button
            type="button"
            onClick={() => loadOpenAccounts()}
            disabled={isLoading || !adminPassword}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Actualizar
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-2xl border-2 border-orange-300 bg-orange-50 p-3 text-sm font-bold text-orange-900">
          {message}
        </div>
      )}

      {canManage && cleanPreferredTableName && (
        <div className="mt-4 flex flex-col gap-2 rounded-[1.2rem] border-2 border-yellow-400 bg-yellow-50 p-3 text-xs font-bold text-[var(--brand-ink)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Mesa seleccionada en el mapa:{" "}
            <strong>{cleanPreferredTableName}</strong>. Puedes abrir la cuenta
            con esa mesa o cambiarla manualmente.
          </span>
          <button
            type="button"
            onClick={() => applyTableToForm(cleanPreferredTableName)}
            className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
          >
            Usar mesa
          </button>
        </div>
      )}

      {canManage && (
        <div className="mt-4 grid gap-3 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] p-3 lg:grid-cols-[1fr_1fr_1fr_1.3fr_auto]">
          <div className="space-y-1">
            <input
              value={form.tableNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  tableNumber: event.target.value,
                }))
              }
              list="open-account-table-options"
              placeholder="Mesa / ubicación"
              className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
            />
            {knownTableOptions.length > 0 && (
              <datalist id="open-account-table-options">
                {knownTableOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </div>
          <input
            value={form.customerName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                customerName: event.target.value,
              }))
            }
            placeholder="Cliente o referencia"
            className="rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
          />
          <input
            value={form.customerPhone}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                customerPhone: event.target.value,
              }))
            }
            placeholder="Teléfono opcional"
            className="rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
          />
          <input
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="Nota opcional"
            className="rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
          />
          <button
            type="button"
            onClick={createOpenAccount}
            disabled={isSaving || !form.tableNumber.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)] disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Abrir
          </button>
        </div>
      )}

      {canManage && knownTableOptions.length > 0 && (
        <div className="mt-3 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-white p-3">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]/75">
            Mesas configuradas
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {knownTableOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    tableNumber: option,
                    customerName: current.customerName || option,
                  }))
                }
                className="shrink-0 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <MiniStat label="Abiertas" value={activeAccounts.length} />
        <MiniStat label="Pedidos en cuenta" value={activeTotals.ordersCount} />
        <MiniStat
          label="Total estimado"
          value={formatUSD(activeTotals.totalEstimatedUSD)}
        />
        <MiniStat
          label="Cobrado real"
          value={formatUSD(activeTotals.totalCollectedUSD)}
          tone="success"
        />
        <MiniStat
          label="Pendiente total"
          value={formatUSD(activeTotals.pendingUSD)}
          tone={activeTotals.pendingUSD > 0 ? "warning" : "success"}
        />
      </div>

      <div className="mt-3 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-white p-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/75">
        Cuentas abiertas organizan pedidos por mesa.{" "}
        <strong>
          Cerrar una cuenta no cobra, no marca pedidos como pagados y no cambia
          el cierre del día.
        </strong>{" "}
        Caja sigue registrando cada cobro real desde el pedido correspondiente.
      </div>

      {unlinkedEligibleOrders.length > 0 && canManage && (
        <div className="mt-4 rounded-[1.2rem] border-2 border-yellow-400 bg-yellow-50 p-3 text-xs font-bold text-[var(--brand-ink)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2">
              <AlertTriangle size={16} />
              Hay {unlinkedEligibleOrders.length} pedido(s) locales sin cuenta
              abierta asociada.
            </p>
            <p className="text-[var(--brand-ink-2)]/65">
              Abre la cuenta correspondiente o usa el selector dentro de cada
              mesa para asociarlos.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {visibleAccounts.length === 0 ? (
          <div className="rounded-[1.2rem] border-2 border-dashed border-[var(--brand-primary)]/35 bg-white p-5 text-sm font-bold text-[var(--brand-ink-2)]/70 xl:col-span-2">
            {viewMode === "all"
              ? "No hay cuentas registradas en este momento."
              : "No hay cuentas abiertas activas en este momento."}
          </div>
        ) : (
          visibleAccounts.map((account) => {
            const accountOrders = mergeAccountOrders(account, orders);
            const accountOrderIds = new Set(
              accountOrders.map((order) => order.id),
            );
            const totals = getComputedAccountTotals(account, accountOrders);
            const expanded =
              expandedAccounts[account.id] || accountOrders.length <= 2;
            const suggestedOrders = unlinkedEligibleOrders.filter((order) =>
              isSameTable(account, order),
            );
            const otherAttachableOrders = unlinkedEligibleOrders.filter(
              (order) => !isSameTable(account, order),
            );
            const isClosed = account.status !== "Abierta";
            const operationalTone = getAccountOperationalTone(
              totals,
              accountOrders,
            );
            const deliveryTone = getAccountDeliveryTone(accountOrders);
            const deliveryStats = getAccountDeliveryStats(accountOrders);
            const pendingOrdersCount =
              getAccountPendingOrdersCount(accountOrders);

            return (
              <article
                key={account.id}
                className={`rounded-[1.3rem] border-2 bg-white p-4 shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.10)] ${
                  isClosed
                    ? "border-zinc-300 opacity-85"
                    : "border-[var(--brand-primary)]"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        {account.tableNumber}
                      </p>
                      <span
                        className={`rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] ${getAccountStatusClasses(account.status)}`}
                      >
                        {formatAccountStatusLabel(account.status)}
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl font-black text-[var(--brand-ink-2)]">
                      {account.customerName || "Cuenta local"}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                      {account.customerPhone
                        ? `Tel. ${account.customerPhone} · `
                        : ""}
                      Abierta {formatAccountDate(account.createdAt)}
                    </p>
                    {account.note && (
                      <p className="mt-2 rounded-2xl bg-[var(--brand-cream)] px-3 py-2 text-xs font-bold text-[var(--brand-ink-2)]/75">
                        {account.note}
                      </p>
                    )}
                    {isClosed && account.closedAt && (
                      <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.10em] text-zinc-700">
                        <Clock size={13} />
                        Cerrada por {account.closedBy || "Caja"}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center lg:w-[320px] lg:shrink-0">
                    <MiniStat
                      label="Pedidos"
                      value={accountOrders.length}
                      small
                    />
                    <MiniStat
                      label="Entregados"
                      value={deliveryStats.delivered}
                      small
                      tone={deliveryStats.delivered > 0 ? "success" : "default"}
                    />
                    <MiniStat
                      label="Listos"
                      value={deliveryStats.ready}
                      small
                      tone={deliveryStats.ready > 0 ? "warning" : "default"}
                    />
                    <MiniStat
                      label="Por cobrar"
                      value={pendingOrdersCount}
                      small
                      tone={pendingOrdersCount > 0 ? "warning" : "success"}
                    />
                    <div className="col-span-2">
                      <MiniStat
                        label="Pendiente"
                        value={formatUSD(totals.pendingUSD)}
                        small
                        tone={totals.pendingUSD > 0 ? "warning" : "success"}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 lg:grid-cols-2">
                  <div
                    className={`rounded-2xl border-2 px-3 py-2 text-xs font-bold leading-5 ${operationalTone.className}`}
                  >
                    <p className="font-black uppercase tracking-[0.12em]">
                      {operationalTone.label}
                    </p>
                    <p className="mt-1">{operationalTone.text}</p>
                  </div>
                  <div
                    className={`rounded-2xl border-2 px-3 py-2 text-xs font-bold leading-5 ${deliveryTone.className}`}
                  >
                    <p className="font-black uppercase tracking-[0.12em]">
                      {deliveryTone.label}
                    </p>
                    <p className="mt-1">{deliveryTone.text}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAccountDetails(account.id)}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] transition hover:bg-yellow-50"
                  >
                    {expanded ? (
                      <ChevronUp size={15} />
                    ) : (
                      <ChevronDown size={15} />
                    )}
                    {expanded
                      ? "Ocultar pedidos"
                      : `Ver pedidos (${accountOrders.length})`}
                  </button>

                  {suggestedOrders.length > 0 && !isClosed && canManage && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400 bg-yellow-50 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-ink)]">
                      <Link2 size={13} />
                      {suggestedOrders.length} sugerido(s) por mesa
                    </span>
                  )}
                </div>

                {expanded && (
                  <div className="mt-4 space-y-2">
                    {accountOrders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3 text-xs font-bold text-[var(--brand-ink-2)]/70">
                        Esta cuenta todavía no tiene pedidos asociados.
                      </div>
                    ) : (
                      accountOrders.map((order) => (
                        <div
                          key={order.id}
                          className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 text-xs font-bold text-[var(--brand-ink-2)]/80"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {order.displayNumber || order.id} ·{" "}
                              {order.customerName || "Cliente"}
                            </span>
                            <span>
                              {formatUSD(order.totalUSD)} ·{" "}
                              {order.paymentStatus}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-4">
                            <OrderPill label="Cocina" value={order.status} />
                            <OrderPill
                              label="Entrega"
                              value={getOrderDeliveryLabel(order.status)}
                              tone={getOrderDeliveryTone(order.status)}
                            />
                            <OrderPill
                              label="Cobrado"
                              value={formatUSD(order.receivedEquivalentUSD)}
                            />
                            <OrderPill
                              label="Pendiente"
                              value={formatUSD(order.pendingUSD)}
                              tone={
                                order.pendingUSD > 0 ? "warning" : "success"
                              }
                            />
                          </div>
                          <OrderItemsPreview order={order} />
                          {canManage &&
                          !isClosed &&
                          order.status !== "Cancelado" ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {order.status !== "Entregado" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateAccountOrderStatus(
                                      account.id,
                                      order.id,
                                      "Entregado",
                                    )
                                  }
                                  disabled={isSaving}
                                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-green-700 bg-green-100 px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.10em] text-green-800 transition hover:bg-green-200 disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} />
                                  Marcar entregado
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateAccountOrderStatus(
                                      account.id,
                                      order.id,
                                      "Listo",
                                    )
                                  }
                                  disabled={isSaving}
                                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-yellow-500 bg-yellow-50 px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.10em] text-[var(--brand-ink)] transition hover:bg-yellow-100 disabled:opacity-50"
                                >
                                  <RefreshCw size={14} />
                                  No entregado
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {canManage && !isClosed && !canCloseAccounts && (
                  <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/75">
                    Mesonero puede abrir cuentas y asociar pedidos. Caja
                    mantiene el control de cobros y cierre administrativo.
                  </div>
                )}

                {canManage && !isClosed && canCloseAccounts && (
                  <div className="mt-4 rounded-2xl border-2 border-yellow-500 bg-yellow-50 p-3 text-xs font-bold leading-5 text-[var(--brand-ink)]">
                    Puedes cobrar todos los pedidos de esta cuenta en un solo
                    paso. Cerrar cuenta solo la retira de operación activa; el
                    cobro agrupado sí se reparte sobre los pedidos pendientes.
                  </div>
                )}

                {canManage && !isClosed && (
                  <div
                    className={`mt-4 grid gap-2 ${canCloseAccounts ? "sm:grid-cols-[1fr_auto_auto_auto]" : "sm:grid-cols-[1fr_auto]"}`}
                  >
                    <select
                      value={selectedOrderByAccount[account.id] || ""}
                      onChange={(event) =>
                        setSelectedOrderByAccount((current) => ({
                          ...current,
                          [account.id]: event.target.value,
                        }))
                      }
                      className="rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)] outline-none focus:border-[var(--brand-primary)]"
                    >
                      <option value="">
                        Asociar pedido local pendiente de cuenta
                      </option>
                      {suggestedOrders.length > 0 && (
                        <optgroup label="Sugeridos por mesa">
                          {suggestedOrders.map((order) => {
                            const payment = getOrderPayment(order);
                            const totals = getOrderTotals(order);
                            return (
                              <option key={order.id} value={order.id}>
                                {getDisplayOrderNumber(order)} ·{" "}
                                {order.customerName} ·{" "}
                                {formatUSD(totals.totalUSD)} · {payment.status}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      {otherAttachableOrders.length > 0 && (
                        <optgroup label="Otros pedidos locales sin cuenta">
                          {otherAttachableOrders.map((order) => {
                            const payment = getOrderPayment(order);
                            const totals = getOrderTotals(order);
                            return (
                              <option key={order.id} value={order.id}>
                                {getDisplayOrderNumber(order)} ·{" "}
                                {order.tableNumber} · {order.customerName} ·{" "}
                                {formatUSD(totals.totalUSD)} · {payment.status}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      {accountOrders.length > 0 && (
                        <optgroup label="Ya asociados a esta cuenta">
                          {accountOrders.map((order) => (
                            <option key={order.id} value="" disabled>
                              {order.displayNumber || order.id} · ya asociado
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {!suggestedOrders.length &&
                        !otherAttachableOrders.length &&
                        accountOrderIds.size === 0 && (
                          <option value="" disabled>
                            No hay pedidos locales disponibles
                          </option>
                        )}
                    </select>
                    <button
                      type="button"
                      onClick={() => attachOrder(account.id)}
                      disabled={isSaving || !selectedOrderByAccount[account.id]}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
                    >
                      <CreditCard size={15} />
                      Asociar pedido
                    </button>
                    {canRegisterPayments && (
                      <button
                        type="button"
                        onClick={() =>
                          openAccountPayment(account, accountOrders)
                        }
                        disabled={isSaving || totals.pendingUSD <= 0.01}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-red-800 disabled:opacity-50"
                      >
                        <CreditCard size={15} />
                        Cobrar cuenta
                      </button>
                    )}
                    {canCloseAccounts && (
                      <button
                        type="button"
                        onClick={() => closeAccount(account, accountOrders)}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-green-700 bg-green-100 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-green-800 transition hover:bg-green-200 disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} />
                        Cerrar cuenta
                      </button>
                    )}
                  </div>
                )}

                {canRegisterPayments &&
                  paymentAccountId === account.id &&
                  !isClosed && (
                    <div className="mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.08)]">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                            Cobro agrupado de cuenta
                          </p>
                          <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
                            Este monto se reparte automáticamente sobre los
                            pedidos pendientes de {account.tableNumber}.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentAccountId("");
                            setAccountPaymentForm(EMPTY_ACCOUNT_PAYMENT_FORM);
                          }}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <MiniStat
                          label="Pendiente"
                          value={formatUSD(totals.pendingUSD)}
                          small
                          tone={totals.pendingUSD > 0 ? "warning" : "success"}
                        />
                        <MiniStat
                          label="Total cuenta"
                          value={formatUSD(totals.totalEstimatedUSD)}
                          small
                        />
                        <MiniStat
                          label="Pedidos"
                          value={accountOrders.length}
                          small
                        />
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <PaymentInput
                          label="Recibido en divisas"
                          value={accountPaymentForm.amountReceivedUSD}
                          onChange={(value) =>
                            updateAccountPaymentForm("amountReceivedUSD", value)
                          }
                          placeholder="Ej: 35.00"
                        />
                        <PaymentSelect
                          label="Método divisas"
                          value={accountPaymentForm.paymentMethodUSD}
                          onChange={(value) =>
                            updateAccountPaymentForm("paymentMethodUSD", value)
                          }
                          options={PAYMENT_METHOD_USD_OPTIONS}
                          emptyLabel="Sin registrar"
                        />
                        <PaymentInput
                          label="Recibido en bolívares"
                          value={accountPaymentForm.amountReceivedVES}
                          onChange={(value) =>
                            updateAccountPaymentForm("amountReceivedVES", value)
                          }
                          placeholder="Ej: 1569.25"
                        />
                        <PaymentSelect
                          label="Método Bs"
                          value={accountPaymentForm.paymentMethodVES}
                          onChange={(value) =>
                            updateAccountPaymentForm("paymentMethodVES", value)
                          }
                          options={PAYMENT_METHOD_VES_OPTIONS}
                          emptyLabel="Sin registrar"
                        />
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                        <PaymentSelect
                          label="Delivery pagado en"
                          value={accountPaymentForm.deliveryPaymentIn}
                          onChange={(value) =>
                            updateAccountPaymentForm(
                              "deliveryPaymentIn",
                              value as AccountPaymentForm["deliveryPaymentIn"],
                            )
                          }
                          options={DELIVERY_PAYMENT_OPTIONS}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateAccountPaymentForm(
                              "amountReceivedUSD",
                              formatMoneyForInput(totals.pendingUSD),
                            )
                          }
                          disabled={totals.pendingUSD <= 0.01}
                          className="rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
                        >
                          Completar en divisas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rate =
                              getAccountRepresentativeExchangeRate(
                                accountOrders,
                              );
                            if (rate > 0) {
                              updateAccountPaymentForm(
                                "amountReceivedVES",
                                formatMoneyForInput(totals.pendingUSD * rate),
                              );
                            }
                          }}
                          disabled={
                            totals.pendingUSD <= 0.01 ||
                            getAccountRepresentativeExchangeRate(
                              accountOrders,
                            ) <= 0
                          }
                          className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                        >
                          Completar en Bs
                        </button>
                      </div>

                      <div className="mt-3">
                        <label className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                          Nota de pago
                        </label>
                        <textarea
                          value={accountPaymentForm.paymentNote}
                          onChange={(event) =>
                            updateAccountPaymentForm(
                              "paymentNote",
                              event.target.value,
                            )
                          }
                          rows={3}
                          className="mt-2 w-full resize-none rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                        />
                      </div>

                      <label className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/75">
                        <input
                          type="checkbox"
                          checked={closeAfterAccountPayment}
                          onChange={(event) =>
                            setCloseAfterAccountPayment(event.target.checked)
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          Cerrar la cuenta automáticamente si queda totalmente
                          pagada.
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => saveAccountPayment(account)}
                        disabled={isSaving}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-red-800 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CreditCard size={16} />
                        )}
                        Guardar cobro agrupado
                      </button>
                    </div>
                  )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

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
