"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Link2,
  Loader2,
  RefreshCw,
  Store,
  Table2,
  UserRound,
  Utensils,
} from "lucide-react";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { OpenAccountsPanel } from "@/components/local/OpenAccountsPanel";
import { LocalTableQrLinksPanel } from "@/components/local/LocalTableQrLinksPanel";
import {
  DEFAULT_LOCAL_TABLES,
  LocalTablesMap,
  getActiveLocalTableNamesForMap,
  normalizeLocalTableText,
  normalizeLocalTablesForMap,
  type LocalTableMapItem,
} from "@/components/local/LocalTablesMap";
import { formatUSD } from "@/utils/formatCurrency";
import type { LocalOrder, OpenAccount } from "@/types/localOrders";
import {
  buildStaffConfirmationText,
  getDisplayOrderNumber,
  getDisplayTableNumber,
  getOrderItemDetailLines,
  hasConfirmedStaffConfirmationItems,
  hasStaffConfirmationItems,
  isDeliveryOrder,
} from "@/lib/localOrderHelpers";
import { getOrderPayment, getOrderTotals } from "@/lib/localOrderMoney";

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session";

async function readApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || "Respuesta inválida" };
  }
}

function getStoredPassword() {
  if (typeof window === "undefined") return "";

  try {
    return window.sessionStorage.getItem(ADMIN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function isLocalOrder(order: LocalOrder) {
  return order.orderType === "Comer aquí" && !isDeliveryOrder(order);
}

function shouldShowAsActive(order: LocalOrder) {
  return order.status !== "Entregado" && order.status !== "Cancelado";
}

function getOrderOpenAccountId(order: LocalOrder) {
  return String(order.openAccountId || "").trim();
}

function findSuggestedOpenAccountForOrder(
  order: LocalOrder,
  accounts: OpenAccount[],
) {
  if (getOrderOpenAccountId(order)) return null;
  if (!isLocalOrder(order) || order.status === "Cancelado") return null;

  const orderTable = normalizeLocalTableText(order.tableNumber);

  if (!orderTable) return null;

  return (
    accounts.find(
      (account) =>
        account.status === "Abierta" &&
        normalizeLocalTableText(account.tableNumber) === orderTable,
    ) || null
  );
}

function findOpenAccountForOrder(order: LocalOrder, accounts: OpenAccount[]) {
  const accountId = getOrderOpenAccountId(order);

  if (accountId) {
    const matchedAccount = accounts.find(
      (account) => String(account.id || "").trim() === accountId,
    );

    if (matchedAccount) return matchedAccount;
  }

  const tableKey = normalizeLocalTableText(order.openAccountTable || order.tableNumber);

  if (!tableKey) return null;

  return (
    accounts.find(
      (account) =>
        account.status === "Abierta" &&
        normalizeLocalTableText(account.tableNumber) === tableKey,
    ) || null
  );
}

function getOpenAccountOrdersCount(account: OpenAccount | null) {
  if (!account) return 0;
  if (Array.isArray(account.orders) && account.orders.length > 0) return account.orders.length;
  if (Array.isArray(account.orderIds)) return account.orderIds.length;
  return 0;
}

function getOpenAccountPendingUSD(account: OpenAccount | null) {
  if (!account) return 0;

  const pending = Number(account.pendingUSD || 0);

  if (Number.isFinite(pending) && pending > 0) return pending;

  const total = Number(account.totalEstimatedUSD || 0);
  const collected = Number(account.totalCollectedUSD || 0);
  const calculated = total - collected;

  return Number.isFinite(calculated) && calculated > 0 ? calculated : 0;
}

function MesoneroContent() {
  const [adminPassword, setAdminPassword] = useState("");
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([]);
  const [localTables, setLocalTables] = useState<LocalTableMapItem[]>(DEFAULT_LOCAL_TABLES);
  const [selectedTableName, setSelectedTableName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [attachingOrderId, setAttachingOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const localOrders = useMemo(() => orders.filter(isLocalOrder), [orders]);
  const activeLocalOrders = useMemo(
    () => localOrders.filter(shouldShowAsActive),
    [localOrders],
  );
  const activeOpenAccounts = useMemo(
    () => openAccounts.filter((account) => account.status === "Abierta"),
    [openAccounts],
  );
  const tableOptions = useMemo(
    () => getActiveLocalTableNamesForMap(localTables),
    [localTables],
  );
  const visibleActiveLocalOrders = useMemo(() => {
    const selectedTable = normalizeLocalTableText(selectedTableName);

    if (!selectedTable) return activeLocalOrders;

    return activeLocalOrders.filter(
      (order) => normalizeLocalTableText(order.tableNumber) === selectedTable,
    );
  }, [activeLocalOrders, selectedTableName]);
  const unlinkedLocalOrders = useMemo(
    () =>
      activeLocalOrders.filter(
        (order) => !String(order.openAccountId || "").trim(),
      ),
    [activeLocalOrders],
  );
  const activeTotalUSD = useMemo(
    () =>
      activeLocalOrders.reduce(
        (total, order) => total + getOrderTotals(order).totalUSD,
        0,
      ),
    [activeLocalOrders],
  );
  const activeAccountsPendingUSD = useMemo(
    () => activeOpenAccounts.reduce((total, account) => total + getOpenAccountPendingUSD(account), 0),
    [activeOpenAccounts],
  );
  const activeAccountsOrdersCount = useMemo(
    () => activeOpenAccounts.reduce((total, account) => total + getOpenAccountOrdersCount(account), 0),
    [activeOpenAccounts],
  );
  const ordersWithProductsToConfirm = useMemo(
    () => activeLocalOrders.filter(hasStaffConfirmationItems),
    [activeLocalOrders],
  );

  async function loadLocalTables() {
    try {
      const response = await fetch("/api/public/business-config", {
        cache: "no-store",
      });
      const data = await readApiResponse(response);
      const businessConfig = data.businessConfig && typeof data.businessConfig === "object"
        ? data.businessConfig
        : data;

      setLocalTables(normalizeLocalTablesForMap(businessConfig.localTables));
    } catch {
      setLocalTables(DEFAULT_LOCAL_TABLES);
    }
  }

  async function loadOpenAccounts(password = adminPassword, silent = true) {
    const cleanPassword = password.trim();

    if (!cleanPassword) {
      setOpenAccounts([]);
      return;
    }

    try {
      const response = await fetch("/api/open-accounts?status=Abierta", {
        headers: {
          "x-admin-password": cleanPassword,
        },
        cache: "no-store",
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar las cuentas abiertas");
      }

      setOpenAccounts(Array.isArray(data.openAccounts) ? data.openAccounts : []);
    } catch (error) {
      setOpenAccounts([]);

      if (!silent) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las cuentas abiertas",
        );
      }
    }
  }

  async function loadOrders(password = adminPassword, silent = false) {
    const cleanPassword = password.trim();

    if (!cleanPassword) return;

    if (!silent) setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/orders", {
        headers: {
          "x-admin-password": cleanPassword,
        },
        cache: "no-store",
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudieron cargar los pedidos del local",
        );
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los pedidos del local",
      );
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function confirmStaffItems(order: LocalOrder) {
    const cleanPassword = adminPassword.trim();

    if (!cleanPassword) {
      setMessage("Ingresa la clave del local para confirmar la revisión.");
      return;
    }

    setConfirmingOrderId(order.id);
    setMessage(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": cleanPassword,
        },
        cache: "no-store",
        body: JSON.stringify({
          action: "confirmStaffItems",
          confirmedBy: "Mesonero",
          confirmedRole: "Mesonero",
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo confirmar la revisión del pedido",
        );
      }

      if (data.order) {
        setOrders((currentOrders) =>
          currentOrders.map((currentOrder) =>
            currentOrder.id === order.id ? data.order : currentOrder,
          ),
        );
      } else {
        await loadOrders(cleanPassword, true);
      }

      setMessage("Revisión del pedido confirmada correctamente.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo confirmar la revisión del pedido",
      );
    } finally {
      setConfirmingOrderId(null);
    }
  }

  async function resetStaffItems(order: LocalOrder) {
    const cleanPassword = adminPassword.trim();

    if (!cleanPassword) {
      setMessage("Ingresa la clave del local para reabrir la revisión.");
      return;
    }

    setConfirmingOrderId(order.id);
    setMessage(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": cleanPassword,
        },
        cache: "no-store",
        body: JSON.stringify({
          action: "resetStaffItems",
          resetBy: "Mesonero",
          resetRole: "Mesonero",
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo reabrir la revisión del pedido",
        );
      }

      if (data.order) {
        setOrders((currentOrders) =>
          currentOrders.map((currentOrder) =>
            currentOrder.id === order.id ? data.order : currentOrder,
          ),
        );
      } else {
        await loadOrders(cleanPassword, true);
      }

      setMessage("Revisión reabierta. El pedido vuelve a quedar por revisar.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo reabrir la revisión del pedido",
      );
    } finally {
      setConfirmingOrderId(null);
    }
  }

  async function attachOrderToOpenAccount(order: LocalOrder, account: OpenAccount) {
    const cleanPassword = adminPassword.trim();

    if (!cleanPassword) {
      setMessage("Ingresa la clave del local para asociar el pedido a la cuenta.");
      return;
    }

    const accountId = String(account.id || "").trim();

    if (!accountId) {
      setMessage("No se encontró la cuenta abierta de esta mesa.");
      return;
    }

    setAttachingOrderId(order.id);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(accountId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": cleanPassword,
          },
          cache: "no-store",
          body: JSON.stringify({ action: "attachOrder", orderId: order.id }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo asociar el pedido a la cuenta abierta",
        );
      }

      if (data.order) {
        setOrders((currentOrders) =>
          currentOrders.map((currentOrder) =>
            currentOrder.id === order.id ? data.order : currentOrder,
          ),
        );
      }

      await loadOrders(cleanPassword, true);
      await loadOpenAccounts(cleanPassword, true);
      setMessage(`Pedido asociado a la cuenta abierta de ${account.tableNumber}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo asociar el pedido a la cuenta abierta",
      );
    } finally {
      setAttachingOrderId(null);
    }
  }

  useEffect(() => {
    const storedPassword = getStoredPassword();

    setAdminPassword(storedPassword);

    loadLocalTables();

    if (storedPassword) {
      loadOrders(storedPassword);
      loadOpenAccounts(storedPassword, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-4 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[1.8rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
                  <UserRound size={18} />
                  Atención en mesa
                </p>
                <h1 className="mt-2 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Mesonero
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Abre cuentas por mesa, revisa pedidos locales activos y asocia
                  pedidos a la cuenta correcta. Caja sigue siendo quien confirma
                  cobros y cierra cuentas.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href="/local-santo"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50"
                >
                  <ArrowLeft size={16} />
                  Panel
                </a>
                <a
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50"
                >
                  <Store size={16} />
                  Menú
                </a>
                <button
                  type="button"
                  onClick={() => { loadOrders(adminPassword); loadOpenAccounts(adminPassword, true); loadLocalTables(); }}
                  disabled={isLoading || !adminPassword}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
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

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MesoneroMetric
                icon={<Table2 size={18} />}
                label="Pedidos locales activos"
                value={activeLocalOrders.length}
              />
              <MesoneroMetric
                icon={<Utensils size={18} />}
                label="Sin cuenta asociada"
                value={unlinkedLocalOrders.length}
                tone={unlinkedLocalOrders.length > 0 ? "warning" : "success"}
              />
              <MesoneroMetric
                icon={<Clock size={18} />}
                label="Total local activo"
                value={formatUSD(activeTotalUSD)}
              />
              <MesoneroMetric
                icon={<Link2 size={18} />}
                label="Cuentas abiertas"
                value={`${activeOpenAccounts.length} / ${activeAccountsOrdersCount} pedidos`}
                compactText
              />
              <MesoneroMetric
                icon={<Eye size={18} />}
                label="Por revisar / pendiente"
                value={`${ordersWithProductsToConfirm.length} · ${formatUSD(activeAccountsPendingUSD)}`}
                tone={ordersWithProductsToConfirm.length > 0 || activeAccountsPendingUSD > 0 ? "warning" : "success"}
                compactText
              />
            </div>
          </div>
        </section>

        <div className="mt-4">
          <LocalTablesMap
            tables={localTables}
            orders={activeLocalOrders}
            openAccounts={activeOpenAccounts}
            compact
            selectedTableName={selectedTableName}
            onSelectTable={(tableName) => setSelectedTableName(tableName)}
            onClearSelection={() => setSelectedTableName("")}
            title="Mapa del mesonero"
            description="Toca una mesa para filtrar los pedidos locales activos. El estado se calcula con pedidos, cuentas abiertas y pendientes de cobro."
          />
        </div>

        <div className="mt-4">
          <LocalTableQrLinksPanel
            tables={localTables}
            compact
            title="QR y enlaces por mesa"
            description="Copia el enlace de una mesa para imprimirlo como QR o enviarlo al cliente. Al abrirlo, el menú público carga con esa mesa preseleccionada."
          />
        </div>

        <OpenAccountsPanel
          adminPassword={adminPassword}
          orders={orders}
          canManage={true}
          canCloseAccounts={false}
          compact
          title="Cuentas del mesonero"
          description="Abre cuentas para mesas ocupadas y asocia pedidos de consumo local. Mesonero no cobra ni cierra cuentas; caja mantiene el control de pagos reales."
          tableOptions={tableOptions}
          preferredTableName={selectedTableName}
          onOrdersShouldRefresh={() => {
            loadOrders(adminPassword, true);
            loadOpenAccounts(adminPassword, true);
          }}
        />

        <section className="mt-4 rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white p-4 shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)] sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Pedidos locales activos
              </p>
              <h2 className="mt-1 text-2xl font-black uppercase text-[var(--brand-ink-2)]">
                Seguimiento rápido de mesas
              </h2>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                Esta vista ayuda al personal a ubicar pedidos por mesa sin
                entrar en caja ni ver funciones administrativas.
              </p>
              {selectedTableName && (
                <p className="mt-2 inline-flex rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent-100)] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]">
                  Filtro de mesa activo: {selectedTableName}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {visibleActiveLocalOrders.length === 0 ? (
              <div className="rounded-[1.2rem] border-2 border-dashed border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] p-5 text-sm font-bold text-[var(--brand-ink-2)]/70 xl:col-span-2">
                {selectedTableName
                  ? `No hay pedidos activos para ${selectedTableName} en este momento.`
                  : "No hay pedidos activos de consumo local en este momento."}
              </div>
            ) : (
              visibleActiveLocalOrders.map((order) => {
                const payment = getOrderPayment(order);
                const totals = getOrderTotals(order);
                const linkedOpenAccount = findOpenAccountForOrder(order, activeOpenAccounts);
                const hasOpenAccount = Boolean(
                  String(order.openAccountId || "").trim(),
                );
                const hasProductsToConfirm = hasStaffConfirmationItems(order);
                const hasConfirmedProducts = hasConfirmedStaffConfirmationItems(order);
                const productsToConfirmText = buildStaffConfirmationText(order);
                const isConfirmingThisOrder = confirmingOrderId === order.id;
                const suggestedOpenAccount = findSuggestedOpenAccountForOrder(
                  order,
                  activeOpenAccounts,
                );
                const isAttachingThisOrder = attachingOrderId === order.id;

                return (
                  <article
                    key={order.id}
                    className={`rounded-[1.2rem] border-2 bg-[var(--brand-cream)] p-4 ${
                      hasProductsToConfirm
                        ? "border-yellow-500"
                        : hasConfirmedProducts
                          ? "border-green-700"
                          : "border-[var(--brand-primary)]/30"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          {getDisplayOrderNumber(order)} ·{" "}
                          {getDisplayTableNumber(order)}
                        </p>
                        <h3 className="mt-1 text-lg font-black text-[var(--brand-ink-2)]">
                          {order.customerName || "Cliente"}
                        </h3>
                        <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                          Estado: {order.status} · Cobro: {payment.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {hasProductsToConfirm && (
                          <span className="rounded-full border border-yellow-600 bg-[var(--brand-accent)] px-3 py-2 text-[0.66rem] font-black uppercase tracking-[0.10em] text-[var(--brand-ink)]">
                            Revisar producto
                          </span>
                        )}
                        {!hasProductsToConfirm && hasConfirmedProducts && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-green-700 bg-green-100 px-3 py-2 text-[0.66rem] font-black uppercase tracking-[0.10em] text-green-800">
                            <CheckCircle2 size={14} />
                            Revisado
                          </span>
                        )}
                        <span
                          className={`rounded-full border px-3 py-2 text-[0.66rem] font-black uppercase tracking-[0.10em] ${
                            hasOpenAccount
                              ? "border-green-700 bg-green-100 text-green-800"
                              : "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]"
                          }`}
                        >
                          {hasOpenAccount ? "En cuenta" : "Sin cuenta"}
                        </span>
                      </div>
                    </div>

                    {linkedOpenAccount && hasOpenAccount && (
                      <div className="mt-3 rounded-2xl border-2 border-green-700 bg-green-50 p-3">
                        <p className="inline-flex items-center gap-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-green-800">
                          <Link2 size={15} />
                          Pedido dentro de cuenta abierta
                        </p>
                        <p className="mt-2 text-xs font-bold leading-5 text-[#234000]">
                          Cuenta de {linkedOpenAccount.tableNumber}: {getOpenAccountOrdersCount(linkedOpenAccount)} pedido(s), pendiente estimado {formatUSD(getOpenAccountPendingUSD(linkedOpenAccount))}. Mesonero solo da seguimiento; caja registra cobros y cierre administrativo.
                        </p>
                      </div>
                    )}

                    {suggestedOpenAccount && (
                      <div className="mt-3 rounded-2xl border-2 border-yellow-500 bg-[var(--brand-accent-100)] p-3">
                        <p className="inline-flex items-center gap-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-[var(--brand-amber)]">
                          <Link2 size={15} />
                          Cuenta abierta detectada
                        </p>
                        <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]">
                          Esta mesa tiene una cuenta abierta. Puedes asociar este pedido manualmente para que aparezca dentro de la cuenta de {suggestedOpenAccount.tableNumber}.
                        </p>
                        <button
                          type="button"
                          onClick={() => attachOrderToOpenAccount(order, suggestedOpenAccount)}
                          disabled={isAttachingThisOrder}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_4px_0_rgba(0,0,0,0.10)] transition hover:bg-[var(--brand-accent-200)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                        >
                          {isAttachingThisOrder ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Link2 size={16} />
                          )}
                          Asociar a cuenta
                        </button>
                      </div>
                    )}

                    {hasProductsToConfirm && (
                      <div className="mt-3 rounded-2xl border-2 border-yellow-500 bg-[var(--brand-accent-100)] p-3">
                        <p className="inline-flex items-center gap-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-[var(--brand-amber)]">
                          <Eye size={15} />
                          Productos por confirmar
                        </p>
                        <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]">
                          Revisar con el cliente o con cocina: {productsToConfirmText}.
                        </p>
                        <button
                          type="button"
                          onClick={() => confirmStaffItems(order)}
                          disabled={isConfirmingThisOrder}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-green-800 bg-green-700 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_4px_0_rgba(0,0,0,0.18)] transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                        >
                          {isConfirmingThisOrder ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                          Confirmar revisión
                        </button>
                      </div>
                    )}

                    {!hasProductsToConfirm && hasConfirmedProducts && (
                      <div className="mt-3 rounded-2xl border-2 border-green-700 bg-green-50 p-3">
                        <p className="inline-flex items-center gap-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-green-800">
                          <CheckCircle2 size={15} />
                          Revisión confirmada
                        </p>
                        <p className="mt-2 text-xs font-bold leading-5 text-[#234000]">
                          El pedido ya fue revisado por el personal. Si se confirmó por error, puedes reabrir la revisión para que vuelva a aparecer como pendiente.
                        </p>
                        <button
                          type="button"
                          onClick={() => resetStaffItems(order)}
                          disabled={isConfirmingThisOrder}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] shadow-[0_4px_0_rgba(0,0,0,0.10)] transition hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                        >
                          {isConfirmingThisOrder ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <RefreshCw size={16} />
                          )}
                          Reabrir revisión
                        </button>
                      </div>
                    )}

                    {order.items.length > 0 && (
                      <div className="mt-3 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-3">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]/70">
                          Productos
                        </p>
                        <div className="mt-2 space-y-2">
                          {order.items.map((item, index) => (
                            <div
                              key={`${order.id}-${item.id}-${item.name}-${index}`}
                              className="rounded-xl bg-[var(--brand-cream)] px-3 py-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p>{item.name} x{item.quantity}</p>
                                <p className="shrink-0 font-black text-[var(--brand-primary)]">
                                  {formatUSD(Number(item.price || 0) * Number(item.quantity || 0))}
                                </p>
                              </div>
                              {getOrderItemDetailLines(item).map((line) => (
                                <p
                                  key={line}
                                  className="mt-1 rounded-lg bg-white px-2 py-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/75"
                                >
                                  {line}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <OrderMetric
                        label="Total"
                        value={formatUSD(totals.totalUSD)}
                      />
                      <OrderMetric
                        label="Cobrado"
                        value={formatUSD(payment.receivedEquivalentUSD)}
                      />
                      <OrderMetric
                        label="Pendiente"
                        value={formatUSD(payment.pendingUSD)}
                      />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MesoneroMetric({
  icon,
  label,
  value,
  tone = "default",
  compactText = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success";
  compactText?: boolean;
}) {
  const toneClass =
    tone === "warning"
      ? "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]"
      : tone === "success"
        ? "border-green-700 bg-green-100 text-green-800"
        : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-ink-2)]";

  return (
    <div className={`rounded-[1.2rem] border-2 p-4 ${toneClass}`}>
      <p className="inline-flex items-center gap-2 text-[0.62rem] font-black uppercase tracking-[0.14em] opacity-75">
        {icon}
        {label}
      </p>
      <p className={`${compactText ? "text-lg" : "text-2xl"} mt-2 font-black`}>
        {value}
      </p>
    </div>
  );
}

function OrderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white px-3 py-2">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/60">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-[var(--brand-ink-2)]">{value}</p>
    </div>
  );
}

export default function MesoneroPage() {
  return (
    <ModuleAccessGuard moduleKey="openAccounts" moduleName="Mesonero">
      <MesoneroContent />
    </ModuleAccessGuard>
  );
}
