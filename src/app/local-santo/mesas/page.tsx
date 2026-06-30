"use client";

import { useEffect, useMemo, useState } from "react";
import { BRAND } from "@/lib/brand"
import Link from "next/link";
import { ArrowLeft, Loader2, Printer, RefreshCw, Store, Table2 } from "lucide-react";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { LocalTableQrLinksPanel } from "@/components/local/LocalTableQrLinksPanel";
import {
  DEFAULT_LOCAL_TABLES,
  LocalTablesMap,
  normalizeLocalTableText,
  normalizeLocalTablesForMap,
  type LocalTableMapItem,
} from "@/components/local/LocalTablesMap";
import type { LocalOrder, OpenAccount } from "@/types/localOrders";

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session";

type PublicBusinessConfigResponse = {
  ok?: boolean;
  error?: string;
  businessConfig?: {
    businessName?: string;
    localTables?: LocalTableMapItem[];
  };
};

type OrdersResponse = {
  orders?: LocalOrder[];
  error?: string;
};

type OpenAccountsResponse = {
  openAccounts?: OpenAccount[];
  error?: string;
};

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

function isDeliveryOrder(order: LocalOrder) {
  return (
    order.orderType === "Delivery" ||
    normalizeLocalTableText(order.tableNumber).startsWith("delivery") ||
    Boolean(order.deliveryAddress || order.deliveryReference || order.deliveryZone || Number(order.deliveryCostUSD || 0) > 0)
  );
}

function isLocalOrder(order: LocalOrder) {
  return order.orderType === "Comer aquí" && !isDeliveryOrder(order) && order.status !== "Cancelado";
}

function isActiveLocalOrder(order: LocalOrder) {
  return isLocalOrder(order) && order.status !== "Entregado";
}

function getOrderPendingUSD(order: LocalOrder) {
  const paymentPending = Number(order.payment?.pendingUSD ?? order.paymentPendingUSD ?? 0);

  if (Number.isFinite(paymentPending) && paymentPending > 0) {
    return paymentPending;
  }

  const total = Number(order.payment?.totalOrderUSD ?? order.totalUSD ?? order.totalPrice ?? 0);
  const collected = Number(order.payment?.receivedEquivalentUSD ?? order.paymentReceivedEquivalentUSD ?? 0);
  const pending = total - collected;

  return Number.isFinite(pending) && pending > 0 ? pending : 0;
}

function getOpenAccountOrdersCount(account: OpenAccount) {
  if (Array.isArray(account.orders) && account.orders.length > 0) return account.orders.length;
  if (Array.isArray(account.orderIds)) return account.orderIds.length;
  return 0;
}

function isTableOccupied(table: LocalTableMapItem, orders: LocalOrder[], openAccounts: OpenAccount[]) {
  const tableKey = normalizeLocalTableText(table.name);
  const hasActiveOrder = orders.some((order) => normalizeLocalTableText(order.tableNumber) === tableKey);
  const hasOpenAccount = openAccounts.some(
    (account) => account.status === "Abierta" && normalizeLocalTableText(account.tableNumber) === tableKey,
  );

  return hasActiveOrder || hasOpenAccount;
}

function MesasContent() {
  const [businessName, setBusinessName] = useState<string>(BRAND.name);
  const [localTables, setLocalTables] = useState<LocalTableMapItem[]>(DEFAULT_LOCAL_TABLES);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([]);
  const [selectedTableName, setSelectedTableName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  const activeTables = useMemo(
    () => normalizeLocalTablesForMap(localTables, DEFAULT_LOCAL_TABLES).filter((table) => table.isActive !== false),
    [localTables],
  );
  const localOrders = useMemo(() => orders.filter(isLocalOrder), [orders]);
  const activeLocalOrders = useMemo(() => orders.filter(isActiveLocalOrder), [orders]);
  const activeOpenAccounts = useMemo(
    () => openAccounts.filter((account) => account.status === "Abierta"),
    [openAccounts],
  );
  const occupiedTableCount = useMemo(
    () => activeTables.filter((table) => isTableOccupied(table, activeLocalOrders, activeOpenAccounts)).length,
    [activeTables, activeLocalOrders, activeOpenAccounts],
  );
  const freeTableCount = Math.max(activeTables.length - occupiedTableCount, 0);
  const selectedTableKey = normalizeLocalTableText(selectedTableName);
  const selectedTableOrders = useMemo(
    () =>
      selectedTableKey
        ? localOrders.filter((order) => normalizeLocalTableText(order.tableNumber) === selectedTableKey)
        : [],
    [localOrders, selectedTableKey],
  );
  const selectedTableOpenAccounts = useMemo(
    () =>
      selectedTableKey
        ? activeOpenAccounts.filter((account) => normalizeLocalTableText(account.tableNumber) === selectedTableKey)
        : [],
    [activeOpenAccounts, selectedTableKey],
  );
  const selectedTablePendingUSD = useMemo(
    () =>
      selectedTableOrders.reduce((total, order) => total + getOrderPendingUSD(order), 0) +
      selectedTableOpenAccounts.reduce((total, account) => total + Number(account.pendingUSD || 0), 0),
    [selectedTableOpenAccounts, selectedTableOrders],
  );
  const selectedTableTotalUSD = useMemo(
    () =>
      Math.max(
        selectedTableOrders.reduce((total, order) => total + Number(order.totalUSD || order.totalPrice || 0), 0),
        selectedTableOpenAccounts.reduce((total, account) => total + Number(account.totalEstimatedUSD || 0), 0),
      ),
    [selectedTableOpenAccounts, selectedTableOrders],
  );

  async function loadTablesAndOrders() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const storedPassword = getStoredPassword();
      const [configResponse, ordersResponse, openAccountsResponse] = await Promise.all([
        fetch("/api/public/business-config", { cache: "no-store" }),
        storedPassword
          ? fetch("/api/orders", {
              cache: "no-store",
              headers: {
                "x-local-password": storedPassword,
              },
            })
          : Promise.resolve(null),
        storedPassword
          ? fetch("/api/open-accounts?status=Abierta", {
              cache: "no-store",
              headers: {
                "x-local-password": storedPassword,
              },
            })
          : Promise.resolve(null),
      ]);

      const configData = (await readApiResponse(configResponse)) as PublicBusinessConfigResponse;

      if (!configResponse.ok) {
        throw new Error(configData.error || "No se pudo cargar la configuración de mesas");
      }

      setBusinessName(configData.businessConfig?.businessName || BRAND.name);
      setLocalTables(normalizeLocalTablesForMap(configData.businessConfig?.localTables, DEFAULT_LOCAL_TABLES));

      if (ordersResponse) {
        const ordersData = (await readApiResponse(ordersResponse)) as OrdersResponse;

        if (!ordersResponse.ok) {
          throw new Error(ordersData.error || "No se pudieron cargar los pedidos activos");
        }

        setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
      }

      if (openAccountsResponse) {
        const accountsData = (await readApiResponse(openAccountsResponse)) as OpenAccountsResponse;

        setOpenAccounts(openAccountsResponse.ok && Array.isArray(accountsData.openAccounts) ? accountsData.openAccounts : []);
      } else {
        setOpenAccounts([]);
      }

      setLastUpdatedAt(new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el panel de mesas");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTablesAndOrders();
  }, []);

  function handlePrint() {
    if (typeof window === "undefined") return;

    window.print();
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-6 text-[var(--brand-ink-3)] print:bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white p-5 shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)] print:border-0 print:shadow-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link
                href="/pedidos"
                className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50 print:hidden"
              >
                <ArrowLeft size={15} />
                Volver a pedidos
              </Link>

              <p className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                <Table2 size={18} />
                Mesas y QR
              </p>
              <h1 className="mt-2 text-3xl font-black uppercase text-[var(--brand-ink-3)] sm:text-4xl">
                {businessName}
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                Panel para revisar el estado de mesas y preparar enlaces imprimibles. Los QR abren el menú público con la mesa preseleccionada.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                onClick={loadTablesAndOrders}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Actualizar
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)]"
              >
                <Printer size={16} />
                Imprimir QR
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5">
            <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">Mesas activas</p>
              <p className="mt-2 text-3xl font-black text-[var(--brand-ink-3)]">{activeTables.length}</p>
            </div>
            <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">Ocupadas</p>
              <p className="mt-2 text-3xl font-black text-[var(--brand-ink-3)]">{occupiedTableCount}</p>
            </div>
            <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">Libres</p>
              <p className="mt-2 text-3xl font-black text-[var(--brand-ink-3)]">{freeTableCount}</p>
            </div>
            <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">Pedidos local</p>
              <p className="mt-2 text-3xl font-black text-[var(--brand-ink-3)]">{localOrders.length}</p>
            </div>
            <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">Cuentas abiertas</p>
              <p className="mt-2 text-3xl font-black text-[var(--brand-ink-3)]">{activeOpenAccounts.length}</p>
            </div>
          </div>

          {lastUpdatedAt && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--brand-cream)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70 print:hidden">
              <Store size={14} />
              Actualizado {lastUpdatedAt}
            </p>
          )}

          {errorMessage && (
            <p className="mt-4 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 print:hidden">
              {errorMessage}
            </p>
          )}
        </section>

        <LocalTablesMap
          tables={activeTables}
          orders={localOrders}
          openAccounts={activeOpenAccounts}
          selectedTableName={selectedTableName}
          onSelectTable={setSelectedTableName}
          onClearSelection={() => setSelectedTableName("")}
          title="Estado operativo por mesa"
          description="Toca una mesa para revisar sus pedidos, cuenta abierta, pendientes y revisión del personal. Esta vista no registra cobros ni cierra cuentas."
          showOrderPreview
        />

        {selectedTableName && (
          <section className="rounded-[1.5rem] border-4 border-[var(--brand-primary)] bg-white p-4 shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)] print:hidden">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">Mesa seleccionada</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">{selectedTableName}</p>
                <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/70">
                  {selectedTableOrders.length} pedido(s) y {selectedTableOpenAccounts.length} cuenta(s) abierta(s) relacionados con esta mesa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTableName("")}
                className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50"
              >
                Ver todas
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]/70">Total mesa/cuenta</p>
                <p className="mt-1 text-xl font-black text-[var(--brand-ink-3)]">${selectedTableTotalUSD.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border-2 border-yellow-500 bg-[var(--brand-accent-100)] p-3">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[var(--brand-amber)]">Pendiente</p>
                <p className="mt-1 text-xl font-black text-[var(--brand-ink)]">${selectedTablePendingUSD.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border-2 border-green-700 bg-green-50 p-3">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-green-700">Estado cuenta</p>
                <p className="mt-1 text-xl font-black text-green-800">{selectedTableOpenAccounts.length ? "Abierta" : "Sin cuenta"}</p>
              </div>
            </div>

            {selectedTableOpenAccounts.length > 0 && (
              <div className="mt-4 space-y-2">
                {selectedTableOpenAccounts.map((account) => (
                  <div key={account.id} className="rounded-2xl border-2 border-green-700 bg-green-50 p-3 text-sm font-bold leading-6 text-[#234000]">
                    <p className="font-black uppercase tracking-[0.12em] text-green-700">Cuenta abierta · {account.customerName || account.tableNumber}</p>
                    <p>{getOpenAccountOrdersCount(account)} pedido(s) asociados · total ${Number(account.totalEstimatedUSD || 0).toFixed(2)} · pendiente ${Number(account.pendingUSD || 0).toFixed(2)}</p>
                    <p className="mt-1 text-xs font-bold text-[#234000]/70">Cerrar la cuenta no registra cobro. Caja debe cobrar pedidos reales.</p>
                  </div>
                ))}
              </div>
            )}

            {selectedTableOrders.length > 0 && (
              <div className="mt-4 space-y-2">
                {selectedTableOrders.slice(0, 6).map((order) => (
                  <div key={order.id} className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 text-xs font-bold text-[var(--brand-ink-2)]">
                    {order.customerName || "Cliente"} · {order.status} · {order.paymentStatus || order.payment?.status || "Pendiente"} · pendiente ${getOrderPendingUSD(order).toFixed(2)}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <LocalTableQrLinksPanel
          tables={activeTables}
          title="Tarjetas imprimibles por mesa"
          description="Imprime estas tarjetas, recórtalas y colócalas en cada mesa. El cliente abre el menú con su mesa ya cargada en el carrito."
          showQrImages
          showBatchActions
          showPrintButton
          showManagementLink={false}
        />
      </div>
    </main>
  );
}

export default function LocalTablesPage() {
  return (
    <ModuleAccessGuard moduleKey="tables" moduleName="Mesas">
      <MesasContent />
    </ModuleAccessGuard>
  );
}
