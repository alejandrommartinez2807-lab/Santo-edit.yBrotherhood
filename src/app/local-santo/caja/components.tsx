import type { ReactNode } from "react"
import Image from "next/image"
import { BRAND } from "@/lib/brand"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Link2,
  LogIn,
  MessageCircle,
  PackageCheck,
  Printer,
  RefreshCw,
  Send,
  Truck,
  X,
  XCircle,
} from "lucide-react"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import type { OpenAccount, PaymentProof } from "@/types/localOrders"
import OrderPaymentProofsList from "@/components/OrderPaymentProofsList"
import {
  getOrderItemDetailLines,
  getOrderStaffConfirmationSummary,
  getStaffConfirmationStatusLabel,
  isStaffConfirmationItemConfirmed,
  isStaffConfirmationItemRequired,
} from "@/lib/localOrderHelpers"
import {
  buildDeliveryWhatsAppUrl,
  formatDate,
  getDisplayLocation,
  getDisplayOrderNumber,
  getDisplayOrderType,
  getOrderOpenAccountId,
  getOrderPayment,
  getOrderTotals,
  getPaymentStatusStyle,
  getStatusIcon,
  getStatusStyle,
  isComboItem,
  isDeliveryOrder,
  isDeliveryReported,
  normalizePhoneForWhatsApp,
  type CartItem,
  type LocalOrder,
} from "./domain"

export function CashOrderCard({
  order,
  onOpenPayment,
  onSendToKitchen,
  onMarkDelivered,
  onCancelOrder,
  suggestedOpenAccount,
  onAttachToSuggestedOpenAccount,
  onConfirmStaffItems,
  onResetStaffItems,
  isConfirmingStaff,
  isAttachingToOpenAccount,
  paymentProofs = [],
}: {
  order: LocalOrder
  suggestedOpenAccount: OpenAccount | null
  onOpenPayment: () => void
  onSendToKitchen: () => void
  onMarkDelivered: () => void
  onCancelOrder: () => void
  onAttachToSuggestedOpenAccount: (account: OpenAccount) => void
  onConfirmStaffItems: () => void
  onResetStaffItems: () => void
  isConfirmingStaff: boolean
  isAttachingToOpenAccount: boolean
  paymentProofs?: PaymentProof[]
}) {
  const orderTotals = getOrderTotals(order)
  const payment = getOrderPayment(order)
  const isDelivery = isDeliveryOrder(order)
  const deliveryReported = isDeliveryReported(order)
  const phone = normalizePhoneForWhatsApp(order.customerPhone || "")
  const comboItems = order.items.filter(isComboItem)
  const regularItems = order.items.filter((item) => !isComboItem(item))
  const staffConfirmationSummary = getOrderStaffConfirmationSummary(order)
  const hasRequiredStaffConfirmation = staffConfirmationSummary.requiredCount > 0
  const hasPendingStaffConfirmation = staffConfirmationSummary.pendingCount > 0
  const staffConfirmationLabel = getStaffConfirmationStatusLabel(staffConfirmationSummary.status)
  const hasOpenAccount = Boolean(getOrderOpenAccountId(order))

  return (
    <article className="overflow-hidden rounded-[1.6rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
      <div className="border-b-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-4xl font-black leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">{getDisplayOrderNumber(order)}</p>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase ${getStatusStyle(order.status)}`}>{getStatusIcon(order.status)}{order.status === "Nuevo" ? "Por confirmar" : order.status}</span>
              <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black uppercase ${getPaymentStatusStyle(payment.status)}`}>{payment.status}</span>
              {isDelivery && <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-black uppercase text-white"><Truck size={15} />Delivery</span>}
              {deliveryReported && <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-xs font-black uppercase text-green-700"><PackageCheck size={15} />Entrega reportada</span>}
              {hasRequiredStaffConfirmation && (
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase ${
                    hasPendingStaffConfirmation
                      ? "bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {hasPendingStaffConfirmation ? <Clock size={15} /> : <CheckCircle2 size={15} />}
                  {staffConfirmationLabel}
                </span>
              )}
              {!isDelivery && (
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase ${
                    hasOpenAccount
                      ? "bg-green-100 text-green-700"
                      : suggestedOpenAccount
                        ? "bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
                        : "bg-[var(--brand-cream)] text-[var(--brand-primary)]"
                  }`}
                >
                  <Link2 size={15} />
                  {hasOpenAccount ? "En cuenta" : suggestedOpenAccount ? "Cuenta detectada" : "Sin cuenta"}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs font-bold text-[var(--brand-ink-2)]/70">{formatDate(order.createdAt)} · {getDisplayOrderType(order)} · {getDisplayLocation(order)}</p>
          </div>

          <div className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-right">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Total</p>
            <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">{formatUSD(orderTotals.totalUSD)}</p>
            {payment.pendingUSD > 0 && <p className="mt-1 text-xs font-black text-red-700">Pendiente {formatUSD(payment.pendingUSD)}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {order.attachmentImageUrl && (
          <a
            href={order.attachmentImageUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3 transition hover:bg-[var(--brand-accent-100)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.attachmentImageUrl}
              alt="Imagen del pedido"
              className="h-16 w-16 rounded-lg object-cover"
            />
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Imagen adjunta por el cliente · toca para ampliar
            </span>
          </a>
        )}

        <OrderPaymentProofsList proofs={paymentProofs} />

        {hasRequiredStaffConfirmation && (
          <div
            className={`rounded-[1.4rem] border-2 p-4 ${
              hasPendingStaffConfirmation
                ? "border-yellow-500 bg-yellow-50"
                : "border-green-600 bg-green-50"
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p
                  className={`text-xs font-black uppercase tracking-[0.18em] ${
                    hasPendingStaffConfirmation ? "text-[var(--brand-amber)]" : "text-green-700"
                  }`}
                >
                  {hasPendingStaffConfirmation ? "Productos por revisar" : "Revisión confirmada"}
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  {hasPendingStaffConfirmation
                    ? `Caja debe confirmar: ${staffConfirmationSummary.pendingText || "producto pendiente"}.`
                    : `El personal ya confirmó ${staffConfirmationSummary.confirmedCount} producto(s) de este pedido.`}
                </p>
                {order.staffConfirmationUpdatedAt && (
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/55">
                    Última revisión: {formatDate(order.staffConfirmationUpdatedAt)}
                    {order.staffConfirmationUpdatedBy ? ` · ${order.staffConfirmationUpdatedBy}` : ""}
                  </p>
                )}
              </div>

              {hasPendingStaffConfirmation ? (
                <button
                  type="button"
                  onClick={onConfirmStaffItems}
                  disabled={isConfirmingStaff}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)] disabled:opacity-50"
                >
                  {isConfirmingStaff ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                  Confirmar revisión
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResetStaffItems}
                  disabled={isConfirmingStaff}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-green-600 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                >
                  {isConfirmingStaff ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                  Reabrir revisión
                </button>
              )}
            </div>
          </div>
        )}

        {deliveryReported && (
          <div className="rounded-[1.4rem] border-2 border-green-600 bg-green-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">Delivery por confirmar</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[#234000]">
              Entrega reportada por {order.deliveryReportedBy || "Delivery"}. Caja debe revisar cobro/estado y presionar “Confirmar entregado”.
            </p>
            {order.deliveryReportedAt && (
              <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-green-700">
                Reportado: {formatDate(order.deliveryReportedAt)}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBox label="Cliente" value={order.customerName || "Cliente"} />
          <InfoBox label={isDelivery ? "Zona" : "Mesa / ubicación"} value={getDisplayLocation(order)} />
          <InfoBox label="Cobrado equiv." value={formatUSD(payment.receivedEquivalentUSD)} />
          <InfoBox label="Pendiente" value={formatUSD(payment.pendingUSD)} />
        </div>

        {suggestedOpenAccount && (
          <div className="rounded-[1.4rem] border-2 border-yellow-500 bg-yellow-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-amber)]">
                  <Link2 size={16} />
                  Cuenta abierta detectada
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Esta mesa tiene una cuenta abierta. Puedes asociar este pedido manualmente para que caja lo vea dentro de la cuenta de {suggestedOpenAccount.tableNumber}. Esto no registra cobro ni cambia el estado de pago.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAttachToSuggestedOpenAccount(suggestedOpenAccount)}
                disabled={isAttachingToOpenAccount}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
              >
                {isAttachingToOpenAccount ? <Loader2 size={17} className="animate-spin" /> : <Link2 size={17} />}
                Asociar a cuenta
              </button>
            </div>
          </div>
        )}

        {isDelivery && (
          <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]"><Truck size={16} />Datos delivery</p>
            <div className="mt-3 grid gap-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/80">
              <p className="rounded-2xl bg-white px-3 py-2"><strong>Teléfono:</strong> {order.customerPhone || "Sin teléfono"}</p>
              <p className="rounded-2xl bg-white px-3 py-2"><strong>Dirección:</strong> {order.deliveryAddress || "Sin dirección"}</p>
              <p className="rounded-2xl bg-white px-3 py-2"><strong>Referencia:</strong> {order.deliveryReference || "Sin referencia"}</p>
              <p className="rounded-2xl bg-white px-3 py-2"><strong>Delivery:</strong> {formatUSD(orderTotals.deliveryCostUSD)} / Bs {formatVES(orderTotals.deliveryCostUSD * Number(order.exchangeRate || 0))}</p>
            </div>

            {phone ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <WhatsAppButton href={buildDeliveryWhatsAppUrl(order, "confirm")} label="Confirmar" />
                <WhatsAppButton href={buildDeliveryWhatsAppUrl(order, "preparing")} label="Preparación" />
                <WhatsAppButton href={buildDeliveryWhatsAppUrl(order, "onTheWay")} label="Avisar salida" dark />
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-3 py-2 text-xs font-black text-[var(--brand-amber)]">Este delivery no tiene teléfono válido para WhatsApp.</p>
            )}
          </div>
        )}

        <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">Productos</p>
          <div className="mt-3 space-y-2">
            {comboItems.length > 0 && <ProductGroup title="Combos" items={comboItems} exchangeRate={order.exchangeRate} onlyCurrency />}
            {regularItems.length > 0 && <ProductGroup title="Productos normales" items={regularItems} exchangeRate={order.exchangeRate} />}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onOpenPayment} className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]">
            <CreditCard size={17} /> Registrar cobro
          </button>

          {order.status === "Nuevo" && hasPendingStaffConfirmation && (
            <div className="rounded-full border-2 border-yellow-500 bg-[var(--brand-accent-100)] px-5 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-amber)]">
              Confirma la revisión antes de enviar a cocina
            </div>
          )}

          {order.status === "Nuevo" && !hasPendingStaffConfirmation && (
            <button type="button" onClick={onSendToKitchen} className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)]">
              <Send size={17} /> Pedido confirmado / enviar a cocina
            </button>
          )}

          {order.status === "Preparando" && (
            <div className="rounded-full border-2 border-orange-400 bg-orange-100 px-5 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-amber)]">
              En cocina
            </div>
          )}

          {order.status === "Listo" && (
            hasPendingStaffConfirmation ? (
              <div className="rounded-full border-2 border-yellow-500 bg-[var(--brand-accent-100)] px-5 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-amber)]">
                Revisión pendiente antes de entregar
              </div>
            ) : (
              <button type="button" onClick={onMarkDelivered} className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-green-600 bg-green-500 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-green-400">
                <CheckCircle2 size={17} /> Confirmar entregado
              </button>
            )
          )}

          {order.status === "Listo" && phone && !isDelivery && (
            <WhatsAppButton href={buildDeliveryWhatsAppUrl(order, "ready")} label="Avisar que está listo" green />
          )}

          {order.status === "Entregado" && (
            <div className="rounded-full border-2 border-green-600 bg-green-50 px-5 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-green-700">
              Pedido entregado
            </div>
          )}

          {order.status === "Cancelado" && (
            <div className="rounded-full border-2 border-[var(--brand-ink-3)] bg-[var(--brand-ink-3)] px-5 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white">
              Pedido cancelado
            </div>
          )}

          <a
            href={`/local-santo/tickets?pedido=${encodeURIComponent(String(order.id || ""))}&tipo=caja&auto=1`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
          >
            <Printer size={17} /> Imprimir ticket
          </a>

          {order.status !== "Cancelado" && order.status !== "Entregado" && (
            <button
              type="button"
              onClick={() => {
                const shouldCancel = window.confirm(
                  "¿Seguro que quieres cancelar este pedido? Quedará registrado como Cancelado para el cierre del día."
                )

                if (shouldCancel) {
                  onCancelOrder()
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-ink-3)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink-3)] transition hover:bg-red-50 hover:text-red-700"
            >
              <XCircle size={17} />
              Cancelar pedido
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export function WhatsAppButton({ href, label, dark, green }: { href: string; label: string; dark?: boolean; green?: boolean }) {
  const className = green
    ? "border-green-600 bg-green-500 text-white hover:bg-green-400"
    : dark
      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-dark)]"
      : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"

  return (
    <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-4 py-3 text-center text-[0.68rem] font-black uppercase tracking-[0.1em] transition ${className}`}>
      <MessageCircle size={16} /> {label}
    </a>
  )
}

export function ProductGroup({ title, items, exchangeRate, onlyCurrency }: { title: string; items: CartItem[]; exchangeRate: number; onlyCurrency?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">{title}</p>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => {
          const subtotal = Number(item.price || 0) * Number(item.quantity || 0)
          const subtotalVES = subtotal * Number(exchangeRate || 0)
          const detailLines = getOrderItemDetailLines(item)
          const pendingStaffReview =
            isStaffConfirmationItemRequired(item) && !isStaffConfirmationItemConfirmed(item)

          return (
            <div key={`${item.id}-${item.name}-${index}`} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)]">
              <div className="flex items-start justify-between gap-3">
                <p>{item.name} x{item.quantity}</p>
                <p className="shrink-0 font-black text-[var(--brand-primary)]">{formatUSD(subtotal)}</p>
              </div>
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">{onlyCurrency ? "Base en divisas" : `Bs ${formatVES(subtotalVES)}`}</p>
              {pendingStaffReview && (
                <p className="mt-1 inline-flex rounded-full bg-[var(--brand-accent-100)] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-amber)]">
                  Pendiente por confirmar
                </p>
              )}
              {detailLines.map((line, lineIndex) => (
                <p key={`${item.id}-${index}-detail-${lineIndex}`} className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                  {line}
                </p>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function InputBox({ label, value, onChange, placeholder, helper }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; helper?: string }) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]" />
      {helper && <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">{helper}</p>}
    </div>
  )
}

export function SelectBox({ label, value, onChange, options, emptyLabel = "Sin registrar" }: { label: string; value: string; onChange: (value: string) => void; options: string[]; emptyLabel?: string }) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]">
        {value && !options.includes(value) && <option value={value}>{value}</option>}
        {options.map((option) => <option key={option || `${label}-empty`} value={option}>{option || emptyLabel}</option>)}
      </select>
    </div>
  )
}

export function MetricCard({ label, value, tone = "red" }: { label: string; value: string | number; tone?: "red" | "yellow" | "soft" }) {
  const style = tone === "yellow" ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]" : tone === "soft" ? "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]" : "border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-primary)]"
  // min-w-0 + break-words: etiquetas largas ("Comprobantes", "Por revisar")
  // se parten en vez de sobresalir de la tarjeta en la grilla del encabezado.
  return <div className={`min-w-0 overflow-hidden rounded-[1.2rem] border-2 p-3 ${style}`}><p className="break-words text-[0.6rem] font-black uppercase leading-4 tracking-[0.08em]">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
}

export function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-2"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">{label}</p><p className="mt-1 break-words text-sm font-black text-[var(--brand-ink-3)]">{value}</p></div>
}

export function InfoBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">{label}</p><p className="mt-1 break-words text-sm font-black text-[var(--brand-ink-3)]">{value || "—"}</p></div>
}

export function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--brand-ink-3)]/60 px-4 py-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-ink-3)] shadow-2xl shadow-black/45">
        <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />
        <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--brand-primary)] bg-white px-6 py-5">
          <h2 className="text-3xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"><X size={24} /></button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

export function LoginShell({ title, subtitle, passwordInput, setPasswordInput, showPassword, setShowPassword, handleLogin, errorMessage }: { title: string; subtitle: string; passwordInput: string; setPasswordInput: (value: string) => void; showPassword: boolean; setShowPassword: (value: boolean) => void; handleLogin: () => void; errorMessage: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
        <div className="h-6 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />
        <div className="px-6 py-6">
          <a href="/admin" className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"><ArrowLeft size={16} />Volver</a>
          <Image src={BRAND.logoUrl || "/logoremovebg.png"} alt={BRAND.name} width={112} height={112} unoptimized className="mx-auto mt-6 h-28 w-28 object-contain" />
          <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">Acceso privado</p>
          <h1 className="mt-2 text-center text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">{title}</h1>
          <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">{subtitle}</p>
        </div>
        <div className="space-y-4 px-6 pb-6">
          <div>
            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">Clave de acceso</label>
            <div className="relative mt-2">
              <input type={showPassword ? "text" : "password"} value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleLogin() }} placeholder="Ingresa la clave del local" className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 pr-12 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-ink)]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          {errorMessage && <div className="rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3"><p className="text-sm font-bold leading-6 text-red-800">{errorMessage}</p></div>}
          <button type="button" onClick={handleLogin} className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-[1.02]"><LogIn size={21} />Entrar</button>
        </div>
      </div>
    </main>
  )
}
