"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CookingPot,
  Eye,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Table2,
  Truck,
} from "lucide-react";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import type { LocalOrder, OrderItem, OrderStatus } from "@/types/localOrders";
import {
  formatDate,
  getDisplayOrderNumber,
  getDisplayOrderType,
  getDisplayTableNumber,
  isDeliveryOrder,
  isStaffConfirmationItemConfirmed,
  isStaffConfirmationItemRequired,
  normalizeComparableText,
} from "@/lib/localOrderHelpers";

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session";

type KitchenItemsFilter = "Preparando" | "Listos" | "Activos" | "Todos";

type OrdersApiResponse = {
  orders?: LocalOrder[];
  error?: string;
};

type ProductKitchenLine = {
  key: string;
  productName: string;
  category: string;
  quantity: number;
  order: LocalOrder;
  item: OrderItem;
  selectionSummary: string;
  note: string;
  hasStaffConfirmationRequirement: boolean;
  requiresStaffConfirmation: boolean;
  staffConfirmationConfirmed: boolean;
};

type ProductKitchenGroup = {
  key: string;
  productName: string;
  category: string;
  totalQuantity: number;
  orderCount: number;
  pendingOrderCount: number;
  readyOrderCount: number;
  staffConfirmationLineCount: number;
  staffConfirmationConfirmedLineCount: number;
  lines: ProductKitchenLine[];
};

async function readApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || "El servidor respondió con un formato no válido" };
  }
}

function getStoredPassword() {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(ADMIN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function shouldShowOrderInKitchenItems(order: LocalOrder) {
  return order.status !== "Cancelado" && order.status !== "Entregado";
}

function matchesKitchenFilter(order: LocalOrder, filter: KitchenItemsFilter) {
  if (filter === "Preparando") return order.status === "Preparando";
  if (filter === "Listos") return order.status === "Listo";
  if (filter === "Activos") return shouldShowOrderInKitchenItems(order);

  return true;
}

function getStatusClasses(status: OrderStatus) {
  if (status === "Preparando") return "border-orange-400 bg-orange-100 text-orange-800";
  if (status === "Listo") return "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]";
  if (status === "Entregado") return "border-green-600 bg-green-100 text-green-800";
  if (status === "Cancelado") return "border-[var(--brand-ink-3)] bg-[var(--brand-ink-3)] text-white";

  return "border-[var(--brand-primary)] bg-red-100 text-[var(--brand-primary)]";
}


function getElapsedMinutes(value: string) {
  const createdAt = new Date(value).getTime();

  if (!Number.isFinite(createdAt)) return 0;

  const minutes = Math.floor((Date.now() - createdAt) / 60000);

  return minutes > 0 ? minutes : 0;
}

function formatElapsedMinutes(minutes: number) {
  if (minutes < 1) return "Menos de 1 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!remainingMinutes) return `${hours} h`;

  return `${hours} h ${remainingMinutes} min`;
}

function getElapsedStatusClasses(minutes: number) {
  if (minutes >= 25) return "border-red-500 bg-red-100 text-red-800";
  if (minutes >= 15) return "border-orange-400 bg-orange-100 text-orange-800";
  if (minutes >= 8) return "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]";

  return "border-green-500 bg-green-50 text-green-800";
}

function getElapsedPriorityLabel(minutes: number) {
  if (minutes >= 25) return "Urgente";
  if (minutes >= 15) return "Atención";
  if (minutes >= 8) return "En tiempo";

  return "Reciente";
}

function getProductGroupKey(item: OrderItem) {
  return [item.name, item.category]
    .map((value) => normalizeComparableText(String(value || "")))
    .filter(Boolean)
    .join("|");
}

function getProductLineKey(order: LocalOrder, item: OrderItem, index: number) {
  return `${order.id}-${item.cartLineId || item.id}-${index}`;
}

function getItemQuantity(item: OrderItem) {
  const quantity = Number(item.quantity || 0);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function buildProductKitchenGroups(orders: LocalOrder[]) {
  const groups = new Map<string, ProductKitchenGroup>();

  orders.forEach((order) => {
    const items = Array.isArray(order.items) ? order.items : [];

    items.forEach((item, index) => {
      const quantity = getItemQuantity(item);
      const productName = String(item.name || "").trim();

      if (!productName || quantity <= 0) return;

      const key = getProductGroupKey(item) || productName;
      const selectionSummary = String(item.selectionSummary || "").trim();
      const note = item.noteEnabled && item.note ? String(item.note).trim() : "";
      const hasStaffConfirmationRequirement = isStaffConfirmationItemRequired(item);
      const staffConfirmationConfirmed = isStaffConfirmationItemConfirmed(item);
      const requiresStaffConfirmation = hasStaffConfirmationRequirement && !staffConfirmationConfirmed;
      const existingGroup = groups.get(key);
      const line: ProductKitchenLine = {
        key: getProductLineKey(order, item, index),
        productName,
        category: String(item.category || "General").trim() || "General",
        quantity,
        order,
        item,
        selectionSummary,
        note,
        hasStaffConfirmationRequirement,
        requiresStaffConfirmation,
        staffConfirmationConfirmed,
      };

      if (!existingGroup) {
        groups.set(key, {
          key,
          productName,
          category: line.category,
          totalQuantity: quantity,
          orderCount: 1,
          pendingOrderCount: order.status === "Preparando" ? 1 : 0,
          readyOrderCount: order.status === "Listo" ? 1 : 0,
          staffConfirmationLineCount: line.requiresStaffConfirmation ? 1 : 0,
          staffConfirmationConfirmedLineCount: line.staffConfirmationConfirmed ? 1 : 0,
          lines: [line],
        });
        return;
      }

      const existingOrderIds = new Set(existingGroup.lines.map((currentLine) => currentLine.order.id));

      existingGroup.totalQuantity += quantity;
      existingGroup.lines.push(line);

      if (line.requiresStaffConfirmation) {
        existingGroup.staffConfirmationLineCount += 1;
      }

      if (line.staffConfirmationConfirmed) {
        existingGroup.staffConfirmationConfirmedLineCount += 1;
      }

      if (!existingOrderIds.has(order.id)) {
        existingGroup.orderCount += 1;

        if (order.status === "Preparando") existingGroup.pendingOrderCount += 1;
        if (order.status === "Listo") existingGroup.readyOrderCount += 1;
      }
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      totalQuantity: Number(group.totalQuantity.toFixed(2)),
      lines: group.lines.sort((lineA, lineB) => {
        const statusOrderA = lineA.order.status === "Preparando" ? 0 : lineA.order.status === "Listo" ? 1 : 2;
        const statusOrderB = lineB.order.status === "Preparando" ? 0 : lineB.order.status === "Listo" ? 1 : 2;

        if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;

        return String(lineA.order.createdAt || "").localeCompare(String(lineB.order.createdAt || ""));
      }),
    }))
    .sort((groupA, groupB) => {
      if (groupA.pendingOrderCount !== groupB.pendingOrderCount) {
        return groupB.pendingOrderCount - groupA.pendingOrderCount;
      }

      if (groupA.staffConfirmationLineCount !== groupB.staffConfirmationLineCount) {
        return groupB.staffConfirmationLineCount - groupA.staffConfirmationLineCount;
      }

      if (groupA.totalQuantity !== groupB.totalQuantity) {
        return groupB.totalQuantity - groupA.totalQuantity;
      }

      return groupA.productName.localeCompare(groupB.productName);
    });
}

function matchesSearch(group: ProductKitchenGroup, searchText: string) {
  const query = normalizeComparableText(searchText);

  if (!query) return true;

  const searchableText = normalizeComparableText(
    [
      group.productName,
      group.category,
      ...group.lines.flatMap((line) => [
        line.order.id,
        getDisplayOrderNumber(line.order),
        line.order.customerName,
        line.order.customerPhone,
        getDisplayTableNumber(line.order),
        getDisplayOrderType(line.order),
        line.selectionSummary,
        line.note,
        line.requiresStaffConfirmation ? "revisar producto confirmar personal" : "",
        line.staffConfirmationConfirmed ? "confirmado personal revision confirmada" : "",
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );

  return searchableText.includes(query);
}

function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[1.45rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[var(--brand-ink)]">{value}</p>
    </div>
  );
}

function EmptyState({ isLoading }: { isLoading: boolean }) {
  return (
    <section className="rounded-[2rem] border-2 border-[var(--brand-primary)] bg-white px-6 py-14 text-center shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
      {isLoading ? (
        <Loader2 className="mx-auto animate-spin text-[var(--brand-primary)]" size={36} />
      ) : (
        <CookingPot className="mx-auto text-[var(--brand-primary)]" size={42} />
      )}
      <h2 className="mt-5 text-3xl font-black uppercase text-[var(--brand-primary)]">
        {isLoading ? "Cargando cocina" : "Sin productos visibles"}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
        {isLoading
          ? "Estamos revisando los pedidos activos para armar la vista por producto."
          : "Cuando haya pedidos en preparación o listos, aquí se agruparán los productos para que cocina trabaje por cantidad y por mesa."}
      </p>
    </section>
  );
}

function ProductLineCard({
  line,
  onMarkReady,
  isUpdating,
}: {
  line: ProductKitchenLine;
  onMarkReady: (orderId: string) => void;
  isUpdating: boolean;
}) {
  const order = line.order;
  const isDelivery = isDeliveryOrder(order);
  const elapsedMinutes = getElapsedMinutes(order.createdAt);

  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-[var(--brand-ink)]">
            {getDisplayOrderNumber(order)} · {getDisplayTableNumber(order)}
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/70">
            {order.customerName || "Cliente"} · {formatDate(order.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClasses(order.status)}`}>
            {order.status}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${getElapsedStatusClasses(elapsedMinutes)}`}>
            <Clock size={13} />
            {formatElapsedMinutes(elapsedMinutes)} · {getElapsedPriorityLabel(elapsedMinutes)}
          </span>
          {isDelivery ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-3 py-1 text-xs font-black text-white">
              <Truck size={13} />
              Delivery
            </span>
          ) : null}
          {line.requiresStaffConfirmation ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500 bg-[var(--brand-accent-100)] px-3 py-1 text-xs font-black text-[var(--brand-amber)]">
              <Eye size={13} />
              Revisar
            </span>
          ) : null}
          {line.staffConfirmationConfirmed ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-500/35 bg-green-50 px-3 py-1 text-xs font-black text-green-700">
              <CheckCircle2 size={13} />
              Confirmado
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--brand-accent)] px-3 py-1 text-sm font-black text-[var(--brand-ink)]">
          Cantidad: {line.quantity}
        </span>
        <span className="rounded-full border border-[var(--brand-primary)]/25 bg-white px-3 py-1 text-xs font-black uppercase text-[var(--brand-primary)]">
          {getDisplayOrderType(order)}
        </span>
      </div>

      {line.selectionSummary ? (
        <p className="mt-3 rounded-xl border border-[var(--brand-primary)]/20 bg-white px-3 py-2 text-xs font-bold leading-5 text-[#1a1a1a]/75">
          {line.selectionSummary}
        </p>
      ) : null}

      {line.requiresStaffConfirmation ? (
        <p className="mt-2 rounded-xl border border-yellow-500 bg-[var(--brand-accent-100)] px-3 py-2 text-xs font-black leading-5 text-[var(--brand-amber)]">
          Revisar con el personal antes de preparar este producto.
        </p>
      ) : null}

      {line.staffConfirmationConfirmed ? (
        <p className="mt-2 rounded-xl border border-green-500/35 bg-green-50 px-3 py-2 text-xs font-black leading-5 text-green-700">
          Revisión confirmada por el personal.
        </p>
      ) : null}

      {line.note ? (
        <p className="mt-2 rounded-xl border border-yellow-400 bg-[var(--brand-accent-100)] px-3 py-2 text-xs font-black leading-5 text-[var(--brand-amber)]">
          Nota: {line.note}
        </p>
      ) : null}

      {order.customerNote ? (
        <p className="mt-2 rounded-xl border border-[var(--brand-primary)]/20 bg-red-50 px-3 py-2 text-xs font-black leading-5 text-[var(--brand-primary)]">
          Nota general: {order.customerNote}
        </p>
      ) : null}

      {order.status === "Preparando" ? (
        <button
          type="button"
          onClick={() => onMarkReady(order.id)}
          disabled={isUpdating}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUpdating ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={15} />}
          Marcar pedido listo
        </button>
      ) : null}
    </div>
  );
}

function ProductGroupCard({
  group,
  onMarkReady,
  updatingOrderId,
}: {
  group: ProductKitchenGroup;
  onMarkReady: (orderId: string) => void;
  updatingOrderId: string;
}) {
  return (
    <article className="overflow-hidden rounded-[1.8rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
      <div className="border-b-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              {group.category || "Producto"}
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase leading-tight text-[var(--brand-ink)]">
              {group.productName}
            </h2>
            <p className="mt-2 text-sm font-bold text-[var(--brand-ink-2)]/70">
              {group.orderCount} pedido{group.orderCount === 1 ? "" : "s"} asociado{group.orderCount === 1 ? "" : "s"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.staffConfirmationLineCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500 bg-[var(--brand-accent-100)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.10em] text-[var(--brand-amber)]">
                  <Eye size={14} />
                  {group.staffConfirmationLineCount} por revisar
                </span>
              ) : null}
              {group.staffConfirmationConfirmedLineCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-green-500/35 bg-green-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.10em] text-green-700">
                  <CheckCircle2 size={14} />
                  {group.staffConfirmationConfirmedLineCount} confirmados
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-center text-[var(--brand-ink)]">
            <p className="text-xs font-black uppercase tracking-[0.14em]">Total</p>
            <p className="text-4xl font-black leading-none">{group.totalQuantity}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-white px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-orange-800">
            Preparando: {group.pendingOrderCount}
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-amber)]">
            Listos: {group.readyOrderCount}
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
            Líneas: {group.lines.length}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {group.lines.map((line) => (
          <ProductLineCard
            key={line.key}
            line={line}
            onMarkReady={onMarkReady}
            isUpdating={updatingOrderId === line.order.id}
          />
        ))}
      </div>
    </article>
  );
}

function KitchenItemsPageContent() {
  const [adminPassword, setAdminPassword] = useState("");
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState<KitchenItemsFilter>("Preparando");
  const [updatingOrderId, setUpdatingOrderId] = useState("");

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setAdminPassword(getStoredPassword());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function loadOrders(showSuccessMessage = false) {
    if (!adminPassword.trim()) {
      setMessage("Entra primero al panel privado para cargar cocina por producto.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/orders", {
        headers: {
          "x-admin-password": adminPassword,
          "x-local-password": adminPassword,
        },
        cache: "no-store",
      });
      const data = (await readApiResponse(response)) as OrdersApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar los pedidos de cocina");
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);

      if (showSuccessMessage) {
        setMessage("Cocina por producto actualizada con la información más reciente.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar cocina por producto");
    } finally {
      setIsLoading(false);
    }
  }

  async function markOrderReady(orderId: string) {
    if (!adminPassword.trim() || !orderId) return;

    const previousOrders = orders;

    setUpdatingOrderId(orderId);
    setMessage(null);
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: "Listo",
            }
          : order,
      ),
    );

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
          "x-local-password": adminPassword,
        },
        body: JSON.stringify({ status: "Listo" }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "No se pudo marcar el pedido como listo");
      }

      window.setTimeout(() => {
        loadOrders(false);
      }, 500);
    } catch (error) {
      setOrders(previousOrders);
      setMessage(error instanceof Error ? error.message : "No se pudo marcar el pedido como listo");
    } finally {
      setUpdatingOrderId("");
    }
  }

  useEffect(() => {
    if (!adminPassword.trim()) return;
    const timer = setTimeout(() => {
      loadOrders(false);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword]);

  useEffect(() => {
    if (!adminPassword.trim()) return;

    const interval = window.setInterval(() => {
      loadOrders(false);
    }, 3500);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword]);

  const visibleOrders = useMemo(
    () => orders.filter((order) => matchesKitchenFilter(order, activeFilter)),
    [activeFilter, orders],
  );

  const productGroups = useMemo(() => {
    return buildProductKitchenGroups(visibleOrders).filter((group) => matchesSearch(group, searchText));
  }, [searchText, visibleOrders]);

  const preparingOrders = orders.filter((order) => order.status === "Preparando");
  const readyOrders = orders.filter((order) => order.status === "Listo");
  const activeOrders = orders.filter(shouldShowOrderInKitchenItems);
  const totalVisibleQuantity = productGroups.reduce((total, group) => total + group.totalQuantity, 0);
  const totalStaffConfirmationLines = productGroups.reduce(
    (total, group) => total + group.staffConfirmationLineCount,
    0,
  );
  const totalConfirmedStaffConfirmationLines = productGroups.reduce(
    (total, group) => total + group.staffConfirmationConfirmedLineCount,
    0,
  );

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-5 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Cocina premium
                </p>
                <h1 className="mt-1 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] sm:text-5xl">
                  Cocina por producto
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Agrupa los productos de los pedidos activos para que cocina prepare por cantidad, mesa y notas. En esta fase se marca listo el pedido completo; todavía no guarda estados individuales por producto.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/local-santo"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                >
                  <ArrowLeft size={16} />
                  Panel
                </a>
                <a
                  href="/local-santo/cocina"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                >
                  <CookingPot size={16} />
                  Cocina normal
                </a>
                <button
                  type="button"
                  onClick={() => loadOrders(true)}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-sm font-black text-[var(--brand-primary)] shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.08)]">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Preparando" value={preparingOrders.length} />
          <MetricCard label="Listos" value={readyOrders.length} />
          <MetricCard label="Pedidos activos" value={activeOrders.length} />
          <MetricCard label="Productos visibles" value={totalVisibleQuantity} />
          <MetricCard label="Por revisar" value={totalStaffConfirmationLines} />
          <MetricCard label="Confirmados" value={totalConfirmedStaffConfirmationLines} />
        </div>

        <section className="sticky top-0 z-30 rounded-[1.75rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)]">
          <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
            <label className="flex items-center gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3">
              <Search size={18} className="text-[var(--brand-primary)]" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar por producto, pedido, mesa, cliente, nota o adicional"
                className="w-full bg-transparent text-sm font-bold text-[var(--brand-ink-3)] outline-none placeholder:text-[var(--brand-ink-2)]/45"
              />
            </label>

            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(["Preparando", "Listos", "Activos", "Todos"] as KitchenItemsFilter[]).map((filter) => {
                const isActive = activeFilter === filter;

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`shrink-0 rounded-full border-2 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
                      isActive
                        ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                        : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/70">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-cream)] px-3 py-1.5">
              <Clock size={14} />
              Filtro: {activeFilter}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-cream)] px-3 py-1.5">
              <PackageCheck size={14} />
              Grupos: {productGroups.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-cream)] px-3 py-1.5">
              <Table2 size={14} />
              Pedidos filtrados: {visibleOrders.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-accent-100)] px-3 py-1.5 text-[var(--brand-amber)]">
              <Eye size={14} />
              Por revisar: {totalStaffConfirmationLines} · Confirmados: {totalConfirmedStaffConfirmationLines}
            </span>
          </div>
        </section>

        {productGroups.length ? (
          <section className="grid gap-5 xl:grid-cols-2">
            {productGroups.map((group) => (
              <ProductGroupCard
                key={group.key}
                group={group}
                onMarkReady={markOrderReady}
                updatingOrderId={updatingOrderId}
              />
            ))}
          </section>
        ) : (
          <EmptyState isLoading={isLoading} />
        )}

        <section className="rounded-[1.75rem] border-2 border-[var(--brand-primary)]/35 bg-[var(--brand-accent-100)] p-5 text-sm font-bold leading-6 text-[var(--brand-ink)]">
          <div className="mb-2 flex items-center gap-2 font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
            <CheckCircle2 size={18} />
            Alcance de esta fase
          </div>
          Esta vista ayuda a cocina a preparar por producto y cantidad. No registra cobros, no cambia cierres, no descuenta inventario y no guarda todavía estados individuales por cada producto.
        </section>
      </section>
    </main>
  );
}

export default function KitchenItemsPage() {
  return (
    <ModuleAccessGuard moduleKey="kitchenItems" moduleName="Cocina por producto">
      <KitchenItemsPageContent />
    </ModuleAccessGuard>
  );
}
