"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BRAND } from "@/lib/brand"
import {
  ArrowLeft,
  Clock,
  CookingPot,
  CreditCard,
  Eye,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Table2,
  Truck,
  X,
} from "lucide-react";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { formatUSD, formatVES } from "@/utils/formatCurrency";
import type { LocalOrder, OpenAccount, OrderItem } from "@/types/localOrders";
import {
  buildStaffConfirmationText,
  formatDate,
  getDisplayOrderNumber,
  getDisplayOrderType,
  getDisplayTableNumber,
  getOrderOpenAccountLabel,
  getOrderOpenAccountOperationalText,
  hasConfirmedStaffConfirmationItems,
  hasStaffConfirmationItems,
  isDeliveryOrder,
  isStaffConfirmationItemConfirmed,
  isStaffConfirmationItemRequired,
} from "@/lib/localOrderHelpers";
import { getOrderPayment, getOrderTotals, roundMoney } from "@/lib/localOrderMoney";

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session";

type TicketKind = "cashier" | "kitchen" | "delivery" | "account";

type TicketTarget =
  | {
      kind: Exclude<TicketKind, "account">;
      order: LocalOrder;
      account?: never;
    }
  | {
      kind: "account";
      account: OpenAccount;
      order?: never;
    };

type OrdersApiResponse = {
  orders?: LocalOrder[];
  error?: string;
};

type OpenAccountsApiResponse = {
  openAccounts?: OpenAccount[];
  error?: string;
};

const TICKET_KIND_LABELS: Record<TicketKind, string> = {
  cashier: "Ticket de caja",
  kitchen: "Ticket de cocina",
  delivery: "Ticket de delivery",
  account: "Ticket de cuenta abierta",
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
    return window.sessionStorage.getItem(ADMIN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function getOrderCreatedLabel(order: LocalOrder) {
  return order.createdAt ? formatDate(order.createdAt) : "Sin hora registrada";
}

function getItemSubtotalUSD(item: OrderItem) {
  return roundMoney(Number(item.price || 0) * Number(item.quantity || 0));
}

function getPaymentStatusClasses(status: string) {
  if (status === "Pagado") return "border-green-600 bg-green-100 text-green-800";
  if (status === "Pago parcial") return "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]";
  return "border-red-300 bg-red-100 text-red-700";
}

function getOrderStatusClasses(status: string) {
  if (status === "Entregado") return "border-green-600 bg-green-100 text-green-800";
  if (status === "Listo") return "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]";
  if (status === "Preparando") return "border-orange-400 bg-orange-100 text-orange-800";
  if (status === "Cancelado") return "border-[var(--brand-ink-3)] bg-[var(--brand-ink-3)] text-white";
  return "border-[var(--brand-primary)] bg-red-100 text-[var(--brand-primary)]";
}

function matchesSearch(order: LocalOrder, searchText: string) {
  const query = searchText.trim().toLowerCase();

  if (!query) return true;

  const haystack = [
    order.id,
    getDisplayOrderNumber(order),
    order.customerName,
    order.customerPhone,
    order.tableNumber,
    order.deliveryZone,
    order.deliveryAddress,
    order.openAccountTable,
    order.status,
    order.paymentStatus,
    buildStaffConfirmationText(order),
    ...(order.items || []).flatMap((item) => [
      item.name,
      item.selectionSummary,
      item.note,
      isStaffConfirmationItemRequired(item) && !isStaffConfirmationItemConfirmed(item)
        ? "revisar producto confirmar personal"
        : "",
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function isActiveOrder(order: LocalOrder) {
  return order.status !== "Entregado" && order.status !== "Cancelado";
}

function TicketLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-[var(--brand-ink-3)]/20 py-1.5 text-[12px]">
      <span className="font-black uppercase tracking-[0.12em] text-[var(--brand-ink-3)]/65">{label}</span>
      <span className="text-right font-black text-[var(--brand-ink-3)]">{value}</span>
    </div>
  );
}

function OpenAccountTicketNotice({ order }: { order: LocalOrder }) {
  const label = getOrderOpenAccountLabel(order);
  const operationalText = getOrderOpenAccountOperationalText(order);

  if (!label || !operationalText) return null;

  return (
    <div className="mt-3 rounded-xl border border-[var(--brand-primary)]/25 bg-red-50 p-3 text-[12px] font-black leading-5 text-[var(--brand-primary)]">
      <p>{label}</p>
      <p className="mt-1 text-[11px] font-bold text-[var(--brand-ink)]/75">{operationalText}</p>
    </div>
  );
}

function TicketItemLine({ item, showPrices }: { item: OrderItem; showPrices: boolean }) {
  const subtotalUSD = getItemSubtotalUSD(item);
  const selectionSummary = String(item.selectionSummary || "").trim();
  const note = item.noteEnabled && item.note ? String(item.note).trim() : "";
  const hasStaffConfirmationRequirement = isStaffConfirmationItemRequired(item);
  const staffConfirmationConfirmed = isStaffConfirmationItemConfirmed(item);
  const requiresStaffConfirmation = hasStaffConfirmationRequirement && !staffConfirmationConfirmed;

  return (
    <div className="border-b border-dashed border-[var(--brand-ink-3)]/20 py-2">
      <div className="flex items-start justify-between gap-3 text-[13px] font-black text-[var(--brand-ink-3)]">
        <span>
          {item.quantity} x {item.name}
        </span>
        {showPrices ? <span>{formatUSD(subtotalUSD)}</span> : null}
      </div>

      {selectionSummary ? (
        <p className="mt-1 text-[11px] font-bold leading-4 text-[var(--brand-ink-3)]/70">{selectionSummary}</p>
      ) : null}

      {requiresStaffConfirmation ? (
        <p className="mt-1 rounded-xl border border-yellow-500 bg-[var(--brand-accent-100)] px-2 py-1 text-[11px] font-black leading-4 text-[var(--brand-amber)]">
          Revisar con el personal antes de preparar o entregar.
        </p>
      ) : null}

      {staffConfirmationConfirmed ? (
        <p className="mt-1 rounded-xl border border-green-500/35 bg-green-50 px-2 py-1 text-[11px] font-black leading-4 text-green-700">
          Confirmado por el personal.
        </p>
      ) : null}

      {note ? (
        <p className="mt-1 rounded-xl border border-[var(--brand-primary)]/20 bg-red-50 px-2 py-1 text-[11px] font-black leading-4 text-[var(--brand-primary)]">
          Nota: {note}
        </p>
      ) : null}
    </div>
  );
}

function KitchenTicket({ order }: { order: LocalOrder }) {
  const hasProductsToConfirm = hasStaffConfirmationItems(order);
  const hasConfirmedProducts = hasConfirmedStaffConfirmationItems(order);
  const productsToConfirmText = buildStaffConfirmationText(order);

  return (
    <TicketShell title="Ticket de cocina" subtitle="Preparación sin precios">
      <TicketLine label="Pedido" value={getDisplayOrderNumber(order)} />
      <TicketLine label="Hora" value={getOrderCreatedLabel(order)} />
      <TicketLine label="Tipo" value={getDisplayOrderType(order)} />
      <TicketLine label="Ubicación" value={getDisplayTableNumber(order)} />
      <TicketLine label="Cliente" value={order.customerName || "Cliente"} />
      <TicketLine label="Estado" value={order.status} />
      {order.openAccountTable ? <TicketLine label="Cuenta" value={getOrderOpenAccountLabel(order)} /> : null}

      <OpenAccountTicketNotice order={order} />

      {order.customerNote ? (
        <div className="mt-3 rounded-xl border border-[var(--brand-primary)]/25 bg-red-50 p-3 text-[12px] font-black leading-5 text-[var(--brand-primary)]">
          Nota general: {order.customerNote}
        </div>
      ) : null}

      {hasProductsToConfirm ? (
        <div className="mt-3 rounded-xl border border-yellow-500 bg-[var(--brand-accent-100)] p-3 text-[12px] font-black leading-5 text-[var(--brand-amber)]">
          Productos por confirmar: {productsToConfirmText}.
        </div>
      ) : null}

      {!hasProductsToConfirm && hasConfirmedProducts ? (
        <div className="mt-3 rounded-xl border border-green-500/35 bg-green-50 p-3 text-[12px] font-black leading-5 text-green-700">
          Revisión confirmada por el personal.
        </div>
      ) : null}

      <TicketSectionTitle>Productos</TicketSectionTitle>
      {(order.items || []).map((item, index) => (
        <TicketItemLine key={`${item.id}-${item.name}-${index}`} item={item} showPrices={false} />
      ))}
    </TicketShell>
  );
}

function CashierTicket({ order }: { order: LocalOrder }) {
  const totals = getOrderTotals(order);
  const payment = getOrderPayment(order);
  const hasProductsToConfirm = hasStaffConfirmationItems(order);
  const hasConfirmedProducts = hasConfirmedStaffConfirmationItems(order);
  const productsToConfirmText = buildStaffConfirmationText(order);

  return (
    <TicketShell title="Ticket de caja" subtitle="Resumen para cobro y entrega">
      <TicketLine label="Pedido" value={getDisplayOrderNumber(order)} />
      <TicketLine label="Hora" value={getOrderCreatedLabel(order)} />
      <TicketLine label="Tipo" value={getDisplayOrderType(order)} />
      <TicketLine label="Ubicación" value={getDisplayTableNumber(order)} />
      <TicketLine label="Cliente" value={order.customerName || "Cliente"} />
      {order.customerPhone ? <TicketLine label="Teléfono" value={order.customerPhone} /> : null}
      {order.openAccountTable ? <TicketLine label="Cuenta" value={getOrderOpenAccountLabel(order)} /> : null}

      <OpenAccountTicketNotice order={order} />

      {hasProductsToConfirm ? (
        <div className="mt-3 rounded-xl border border-yellow-500 bg-[var(--brand-accent-100)] p-3 text-[12px] font-black leading-5 text-[var(--brand-amber)]">
          Productos por confirmar: {productsToConfirmText}.
        </div>
      ) : null}

      {!hasProductsToConfirm && hasConfirmedProducts ? (
        <div className="mt-3 rounded-xl border border-green-500/35 bg-green-50 p-3 text-[12px] font-black leading-5 text-green-700">
          Revisión confirmada por el personal.
        </div>
      ) : null}

      <TicketSectionTitle>Productos</TicketSectionTitle>
      {(order.items || []).map((item, index) => (
        <TicketItemLine key={`${item.id}-${item.name}-${index}`} item={item} showPrices />
      ))}

      <TicketSectionTitle>Totales</TicketSectionTitle>
      <TicketLine label="Productos" value={formatUSD(totals.totalBeforeDeliveryUSD)} />
      {totals.deliveryCostUSD > 0 ? <TicketLine label="Delivery" value={formatUSD(totals.deliveryCostUSD)} /> : null}
      <TicketLine label="Total" value={formatUSD(totals.totalUSD)} />
      <TicketLine label="Combos/base divisa" value={formatUSD(totals.totalCombosUSD)} />
      <TicketLine
        label="Normales Bs"
        value={`Bs ${formatVES(totals.totalRegularVES)}`}
      />

      <TicketSectionTitle>Cobro</TicketSectionTitle>
      <TicketLine label="Estado" value={payment.status} />
      <TicketLine label="Recibido" value={formatUSD(payment.receivedEquivalentUSD)} />
      <TicketLine label="Pendiente" value={formatUSD(payment.pendingUSD)} />
      {payment.paymentMethodUSD ? <TicketLine label="Divisas" value={payment.paymentMethodUSD} /> : null}
      {payment.paymentMethodVES ? <TicketLine label="Bolívares" value={payment.paymentMethodVES} /> : null}
      {payment.paymentNote ? <TicketLine label="Nota caja" value={payment.paymentNote} /> : null}
    </TicketShell>
  );
}

function DeliveryTicket({ order }: { order: LocalOrder }) {
  const totals = getOrderTotals(order);
  const payment = getOrderPayment(order);
  const hasProductsToConfirm = hasStaffConfirmationItems(order);
  const hasConfirmedProducts = hasConfirmedStaffConfirmationItems(order);
  const productsToConfirmText = buildStaffConfirmationText(order);

  return (
    <TicketShell title="Ticket de delivery" subtitle="Datos para entrega a domicilio">
      <TicketLine label="Pedido" value={getDisplayOrderNumber(order)} />
      <TicketLine label="Hora" value={getOrderCreatedLabel(order)} />
      <TicketLine label="Cliente" value={order.customerName || "Cliente"} />
      <TicketLine label="Teléfono" value={order.customerPhone || "Sin teléfono"} />
      <TicketLine label="Zona" value={order.deliveryZone || getDisplayTableNumber(order)} />
      <TicketLine label="Dirección" value={order.deliveryAddress || "Sin dirección"} />
      <TicketLine label="Referencia" value={order.deliveryReference || "Sin referencia"} />
      <TicketLine label="Método indicado" value={order.paymentMethod || "Sin registrar"} />

      <OpenAccountTicketNotice order={order} />

      {hasProductsToConfirm ? (
        <div className="mt-3 rounded-xl border border-yellow-500 bg-[var(--brand-accent-100)] p-3 text-[12px] font-black leading-5 text-[var(--brand-amber)]">
          Productos por confirmar: {productsToConfirmText}.
        </div>
      ) : null}

      {!hasProductsToConfirm && hasConfirmedProducts ? (
        <div className="mt-3 rounded-xl border border-green-500/35 bg-green-50 p-3 text-[12px] font-black leading-5 text-green-700">
          Revisión confirmada por el personal.
        </div>
      ) : null}

      <TicketSectionTitle>Productos</TicketSectionTitle>
      {(order.items || []).map((item, index) => (
        <TicketItemLine key={`${item.id}-${item.name}-${index}`} item={item} showPrices={false} />
      ))}

      <TicketSectionTitle>Entrega y cobro</TicketSectionTitle>
      <TicketLine label="Total" value={formatUSD(totals.totalUSD)} />
      <TicketLine label="Delivery" value={formatUSD(totals.deliveryCostUSD)} />
      <TicketLine label="Pago" value={payment.status} />
      <TicketLine label="Pendiente" value={formatUSD(payment.pendingUSD)} />
      <TicketLine label="Reporte" value={order.deliveryReportStatus || "Sin reportar"} />
    </TicketShell>
  );
}

function AccountTicket({ account, ordersById }: { account: OpenAccount; ordersById: Map<string, LocalOrder> }) {
  const linkedOrders = (account.orderIds || [])
    .map((orderId) => ordersById.get(String(orderId || "").trim()))
    .filter((order): order is LocalOrder => Boolean(order));

  return (
    <TicketShell title="Ticket de cuenta abierta" subtitle="Resumen para revisar en mesa">
      <TicketLine label="Cuenta" value={account.id} />
      <TicketLine label="Mesa" value={account.tableNumber || "Sin mesa"} />
      <TicketLine label="Cliente" value={account.customerName || "Cliente"} />
      {account.customerPhone ? <TicketLine label="Teléfono" value={account.customerPhone} /> : null}
      <TicketLine label="Estado" value={account.status} />
      <TicketLine label="Total estimado" value={formatUSD(account.totalEstimatedUSD || 0)} />
      <TicketLine label="Cobrado real" value={formatUSD(account.totalCollectedUSD || 0)} />
      <TicketLine label="Pendiente" value={formatUSD(account.pendingUSD || 0)} />

      {account.note ? (
        <div className="mt-3 rounded-xl border border-[var(--brand-primary)]/25 bg-red-50 p-3 text-[12px] font-black leading-5 text-[var(--brand-primary)]">
          Nota de cuenta: {account.note}
        </div>
      ) : null}

      <TicketSectionTitle>Pedidos asociados</TicketSectionTitle>
      {linkedOrders.length ? (
        linkedOrders.map((order) => (
          <div key={order.id} className="border-b border-dashed border-[var(--brand-ink-3)]/25 py-3">
            <div className="flex items-center justify-between gap-3 text-[12px] font-black text-[var(--brand-ink-3)]">
              <span>{getDisplayOrderNumber(order)}</span>
              <span>{formatUSD(getOrderTotals(order).totalUSD)}</span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-[var(--brand-ink-3)]/65">
              {order.status} · {getOrderPayment(order).status}
            </p>
            {getOrderOpenAccountLabel(order) ? (
              <p className="mt-1 rounded-xl border border-[var(--brand-primary)]/20 bg-red-50 px-2 py-1 text-[11px] font-black leading-4 text-[var(--brand-primary)]">
                {getOrderOpenAccountLabel(order)}
              </p>
            ) : null}
            {hasStaffConfirmationItems(order) ? (
              <p className="mt-1 rounded-xl border border-yellow-500 bg-[var(--brand-accent-100)] px-2 py-1 text-[11px] font-black leading-4 text-[var(--brand-amber)]">
                Revisar: {buildStaffConfirmationText(order)}.
              </p>
            ) : null}
            {!hasStaffConfirmationItems(order) && hasConfirmedStaffConfirmationItems(order) ? (
              <p className="mt-1 rounded-xl border border-green-500/35 bg-green-50 px-2 py-1 text-[11px] font-black leading-4 text-green-700">
                Revisión confirmada por el personal.
              </p>
            ) : null}
            <div className="mt-2 space-y-1">
              {(order.items || []).map((item, index) => (
                <div key={`${order.id}-${item.id}-${index}`} className="text-[11px] font-bold text-[var(--brand-ink-3)]/80">
                  {item.quantity} x {item.name}
                  {item.selectionSummary ? (
                    <p className="mt-0.5 text-[var(--brand-ink-3)]/60">{item.selectionSummary}</p>
                  ) : null}
                  {isStaffConfirmationItemRequired(item) && !isStaffConfirmationItemConfirmed(item) ? (
                    <p className="mt-0.5 text-[var(--brand-amber)]">Revisar con el personal.</p>
                  ) : null}
                  {isStaffConfirmationItemConfirmed(item) ? (
                    <p className="mt-0.5 text-green-700">Confirmado por el personal.</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="py-3 text-[12px] font-bold text-[var(--brand-ink-3)]/65">Sin pedidos asociados visibles.</p>
      )}
    </TicketShell>
  );
}

function TicketSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 border-b-2 border-[var(--brand-ink-3)] pb-1 text-center text-[12px] font-black uppercase tracking-[0.18em] text-[var(--brand-ink-3)]">
      {children}
    </p>
  );
}

function TicketShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className="ticket-paper mx-auto w-full max-w-[380px] bg-white p-5 font-mono text-[var(--brand-ink-3)] shadow-xl print:shadow-none">
      <div className="border-b-2 border-[var(--brand-ink-3)] pb-3 text-center">
        <p className="text-[18px] font-black uppercase leading-none">{BRAND.name}</p>
        <p className="mt-1 text-[12px] font-black uppercase tracking-[0.16em]">{title}</p>
        <p className="mt-1 text-[11px] font-bold text-[var(--brand-ink-3)]/65">{subtitle}</p>
        <p className="mt-2 text-[10px] font-bold text-[var(--brand-ink-3)]/60">
          Generado: {formatDate(new Date().toISOString())}
        </p>
      </div>

      <div className="py-3">{children}</div>

      <div className="border-t-2 border-[var(--brand-ink-3)] pt-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-ink-3)]/65">
        Revisa el pedido antes de entregar o cobrar.
      </div>
    </article>
  );
}

function TicketPreview({ target, ordersById }: { target: TicketTarget; ordersById: Map<string, LocalOrder> }) {
  if (target.kind === "kitchen") return <KitchenTicket order={target.order} />;
  if (target.kind === "delivery") return <DeliveryTicket order={target.order} />;
  if (target.kind === "account") return <AccountTicket account={target.account} ordersById={ordersById} />;

  return <CashierTicket order={target.order} />;
}

function OrderTicketCard({ order, onSelect }: { order: LocalOrder; onSelect: (target: TicketTarget) => void }) {
  const totals = getOrderTotals(order);
  const payment = getOrderPayment(order);
  const isDelivery = isDeliveryOrder(order);
  const hasProductsToConfirm = hasStaffConfirmationItems(order);
  const hasConfirmedProducts = hasConfirmedStaffConfirmationItems(order);

  return (
    <article
      className={`rounded-[1.75rem] border-2 bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)] ${
        hasProductsToConfirm ? "border-yellow-500" : "border-[var(--brand-primary)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
            {getDisplayOrderNumber(order)} · {getDisplayOrderType(order)}
          </p>
          <h2 className="mt-1 text-xl font-black uppercase leading-tight text-[var(--brand-ink)]">
            {order.customerName || "Cliente"}
          </h2>
          <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/70">
            {getDisplayTableNumber(order)} · {getOrderCreatedLabel(order)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-black text-[var(--brand-primary)]">{formatUSD(totals.totalUSD)}</p>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/60">
            {(order.items || []).length} producto{(order.items || []).length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${getOrderStatusClasses(order.status)}`}>
          {order.status}
        </span>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${getPaymentStatusClasses(payment.status)}`}>
          {payment.status}
        </span>
        {hasProductsToConfirm ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500 bg-[var(--brand-accent-100)] px-3 py-1 text-xs font-black text-[var(--brand-amber)]">
            <Eye size={13} />
            Revisar producto
          </span>
        ) : null}
        {!hasProductsToConfirm && hasConfirmedProducts ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-500/35 bg-green-50 px-3 py-1 text-xs font-black text-green-700">
            Confirmado
          </span>
        ) : null}
        {order.openAccountTable ? (
          <span className="rounded-full border border-[var(--brand-primary)]/25 bg-red-50 px-3 py-1 text-xs font-black text-[var(--brand-primary)]">
            {getOrderOpenAccountLabel(order)}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onSelect({ kind: "cashier", order })}
          className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
        >
          <CreditCard size={16} />
          Caja
        </button>
        <button
          type="button"
          onClick={() => onSelect({ kind: "kitchen", order })}
          className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
        >
          <CookingPot size={16} />
          Cocina
        </button>
        <button
          type="button"
          onClick={() => onSelect({ kind: "delivery", order })}
          disabled={!isDelivery}
          className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Truck size={16} />
          Delivery
        </button>
      </div>
    </article>
  );
}

function AccountTicketCard({ account, onSelect }: { account: OpenAccount; onSelect: (target: TicketTarget) => void }) {
  return (
    <article className="rounded-[1.75rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
            Cuenta abierta
          </p>
          <h2 className="mt-1 text-xl font-black uppercase leading-tight text-[var(--brand-ink)]">
            {account.tableNumber || "Mesa sin nombre"}
          </h2>
          <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/70">
            {account.customerName || "Cliente"} · {account.status}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-[var(--brand-primary)]">{formatUSD(account.totalEstimatedUSD || 0)}</p>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/60">
            Pendiente {formatUSD(account.pendingUSD || 0)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect({ kind: "account", account })}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
      >
        <ReceiptText size={16} />
        Ver ticket de cuenta
      </button>
    </article>
  );
}

function TicketsPageContent() {
  const [adminPassword, setAdminPassword] = useState("");
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<TicketTarget | null>(null);

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setAdminPassword(getStoredPassword());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const ordersById = useMemo(() => {
    const map = new Map<string, LocalOrder>();

    orders.forEach((order) => {
      map.set(String(order.id || "").trim(), order);
    });

    return map;
  }, [orders]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => isActiveOrder(order) && matchesSearch(order, searchText)),
    [orders, searchText],
  );

  const visibleOpenAccounts = useMemo(
    () =>
      openAccounts.filter((account) => {
        const query = searchText.trim().toLowerCase();

        if (!query) return account.status === "Abierta";

        return [account.id, account.tableNumber, account.customerName, account.customerPhone, account.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
    [openAccounts, searchText],
  );

  async function loadTicketsData(showSuccessMessage = false) {
    if (!adminPassword.trim()) {
      setMessage("Entra primero al panel privado para cargar tickets.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const headers = {
        "x-admin-password": adminPassword,
        "x-local-password": adminPassword,
      };

      const ordersResponse = await fetch("/api/orders", {
        headers,
        cache: "no-store",
      });
      const ordersData = (await readApiResponse(ordersResponse)) as OrdersApiResponse;

      if (!ordersResponse.ok) {
        throw new Error(ordersData.error || "No se pudieron cargar los pedidos");
      }

      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);

      try {
        const accountsResponse = await fetch("/api/open-accounts?status=all", {
          headers,
          cache: "no-store",
        });
        const accountsData = (await readApiResponse(accountsResponse)) as OpenAccountsApiResponse;

        if (accountsResponse.ok && Array.isArray(accountsData.openAccounts)) {
          setOpenAccounts(accountsData.openAccounts);
        } else {
          setOpenAccounts([]);
        }
      } catch {
        setOpenAccounts([]);
      }

      if (showSuccessMessage) {
        setMessage("Tickets actualizados con la información más reciente.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los tickets");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!adminPassword.trim()) return;
    const timer = setTimeout(() => {
      loadTicketsData(false);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword]);

  function printSelectedTicket() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-5 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          .ticket-print-zone,
          .ticket-print-zone * {
            visibility: visible !important;
          }

          .ticket-print-zone {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            min-height: 100vh !important;
            background: white !important;
            padding: 0 !important;
          }

          .ticket-print-actions {
            display: none !important;
          }

          .ticket-paper {
            box-shadow: none !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 12px !important;
          }
        }
      `}</style>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white p-5 shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Tickets base
              </p>
              <h1 className="mt-1 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] sm:text-5xl">
                Impresión operativa
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                Genera tickets de caja, cocina, delivery y cuentas abiertas para imprimir desde el navegador. Esta fase no activa impresora automática ni modifica pedidos, cobros o cierres.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/local-santo"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
              >
                <ArrowLeft size={16} />
                Volver
              </a>
              <button
                type="button"
                onClick={() => loadTicketsData(true)}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-sm font-black text-[var(--brand-primary)] shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.08)]">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Pedidos activos</p>
            <p className="mt-2 text-3xl font-black text-[var(--brand-ink)]">{filteredOrders.length}</p>
          </div>
          <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Cuentas abiertas</p>
            <p className="mt-2 text-3xl font-black text-[var(--brand-ink)]">{visibleOpenAccounts.length}</p>
          </div>
          <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Delivery</p>
            <p className="mt-2 text-3xl font-black text-[var(--brand-ink)]">
              {filteredOrders.filter(isDeliveryOrder).length}
            </p>
          </div>
          <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Pendiente</p>
            <p className="mt-2 text-3xl font-black text-[var(--brand-ink)]">
              {formatUSD(filteredOrders.reduce((total, order) => total + getOrderPayment(order).pendingUSD, 0))}
            </p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)]">
          <label className="flex items-center gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3">
            <Search size={18} className="text-[var(--brand-primary)]" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por pedido, cliente, mesa, teléfono o producto"
              className="w-full bg-transparent text-sm font-bold text-[var(--brand-ink-3)] outline-none placeholder:text-[var(--brand-ink-2)]/45"
            />
          </label>
        </div>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--brand-primary)]">
              <ReceiptText size={22} />
              <h2 className="text-2xl font-black uppercase">Pedidos para ticket</h2>
            </div>

            {isLoading && !orders.length ? (
              <div className="rounded-[1.75rem] border-2 border-[var(--brand-primary)] bg-white p-8 text-center text-sm font-black text-[var(--brand-primary)]">
                <Loader2 className="mx-auto mb-3 animate-spin" size={28} />
                Cargando pedidos para tickets.
              </div>
            ) : filteredOrders.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredOrders.map((order) => (
                  <OrderTicketCard key={order.id} order={order} onSelect={setSelectedTarget} />
                ))}
              </div>
            ) : (
              <div className="rounded-[1.75rem] border-2 border-[var(--brand-primary)] bg-white p-8 text-center text-sm font-black text-[var(--brand-primary)]">
                No hay pedidos activos que coincidan con la búsqueda.
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--brand-primary)]">
              <Table2 size={22} />
              <h2 className="text-2xl font-black uppercase">Cuentas abiertas</h2>
            </div>

            {visibleOpenAccounts.length ? (
              <div className="space-y-4">
                {visibleOpenAccounts.map((account) => (
                  <AccountTicketCard key={account.id} account={account} onSelect={setSelectedTarget} />
                ))}
              </div>
            ) : (
              <div className="rounded-[1.75rem] border-2 border-[var(--brand-primary)] bg-white p-6 text-center text-sm font-black text-[var(--brand-primary)]">
                No hay cuentas abiertas disponibles para ticket.
              </div>
            )}

            <div className="rounded-[1.75rem] border-2 border-[var(--brand-primary)]/35 bg-[var(--brand-accent-100)] p-5 text-sm font-bold leading-6 text-[var(--brand-ink)]">
              <div className="mb-2 flex items-center gap-2 font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                <Clock size={18} />
                Importante
              </div>
              Estos tickets son una base operativa. Imprimen desde el navegador, pero todavía no conectan impresora térmica automática ni abren caja física.
            </div>
          </aside>
        </section>
      </section>

      {selectedTarget ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--brand-ink-3)]/70 px-4 py-6 backdrop-blur-sm">
          <div className="ticket-print-zone w-full max-w-2xl rounded-[2rem] bg-[var(--brand-cream)] p-4 shadow-2xl">
            <div className="ticket-print-actions mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  {TICKET_KIND_LABELS[selectedTarget.kind]}
                </p>
                <p className="text-sm font-bold text-[var(--brand-ink-2)]/70">
                  Revisa el contenido antes de imprimir.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={printSelectedTicket}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                >
                  <Printer size={16} />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTarget(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                >
                  <X size={16} />
                  Cerrar
                </button>
              </div>
            </div>

            <TicketPreview target={selectedTarget} ordersById={ordersById} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function TicketsPage() {
  return (
    <ModuleAccessGuard moduleKey="tickets" moduleName="Tickets">
      <TicketsPageContent />
    </ModuleAccessGuard>
  );
}
