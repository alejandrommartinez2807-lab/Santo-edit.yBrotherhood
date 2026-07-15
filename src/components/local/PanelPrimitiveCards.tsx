import type { ReactNode } from "react"
import { X } from "lucide-react"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import {
  getOrderItemDetailLines,
  isStaffConfirmationItemConfirmed,
  isStaffConfirmationItemRequired,
} from "@/lib/localOrderHelpers"
import type { CartItem } from "@/types/localOrders"

export function ModuleAccessCard({
  href,
  onClick,
  icon,
  eyebrow,
  title,
  description,
  metric,
  disabled,
}: {
  href?: string
  onClick?: () => void
  icon: ReactNode
  eyebrow: string
  title: string
  description: string
  metric: string
  disabled?: boolean
}) {
  // Tarjeta sobria estilo hotel 5★: hairline, titular serif, hover sutil.
  const className =
    "group flex min-h-[170px] flex-col justify-between rounded-2xl border border-[var(--brand-border)] bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/45 hover:shadow-md"

  const content = (
    <>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--brand-primary)]/25 bg-[rgba(var(--brand-primary-rgb),0.10)] text-[var(--brand-primary-dark)]">
            {icon}
          </div>

          <span className="rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-3 py-1 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[var(--brand-primary-dark)]">
            {metric}
          </span>
        </div>

        <p className="mt-4 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[var(--brand-primary-dark)]">
          {eyebrow}
        </p>

        <h2 className="mt-1 font-serif text-xl font-semibold leading-tight text-[var(--brand-ink-3)]">
          {title}
        </h2>

        <p className="mt-2 text-sm font-medium leading-6 text-[var(--brand-ink-2)]">
          {description}
        </p>
      </div>

      <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-primary-dark)] transition-colors group-hover:text-[var(--brand-ink-3)]">
        {disabled ? "Disponible luego" : "Entrar"}
        {!disabled && <span aria-hidden="true">→</span>}
      </div>
    </>
  )

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className={`${className} cursor-not-allowed opacity-70`}
      >
        {content}
      </button>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  if (!href) {
    return (
      <button
        type="button"
        disabled
        className={`${className} cursor-not-allowed opacity-70`}
      >
        {content}
      </button>
    )
  }

  return (
    <a href={href} className={className}>
      {content}
    </a>
  )
}

export function PanelMiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-2">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-[var(--brand-ink-3)]">
        {value}
      </p>
    </div>
  )
}

export function MetricCard({
  label,
  value,
  tone = "red",
}: {
  label: string
  value: string | number
  tone?: "red" | "yellow"
}) {
  const style =
    tone === "yellow"
      ? "border-amber-300 bg-amber-50"
      : "border-[var(--brand-border)] bg-white"

  return (
    <div className={`min-w-0 overflow-hidden rounded-xl border p-3 shadow-sm ${style}`}>
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[var(--brand-primary-dark)]">
        {label}
      </p>
      <p className="mt-1 whitespace-nowrap font-serif text-xl font-semibold leading-tight text-[var(--brand-ink-3)] sm:text-2xl">
        {value}
      </p>
    </div>
  )
}

export function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-[var(--brand-ink-3)]">
        {value || "—"}
      </p>
    </div>
  )
}


export function ProductGroup({
  title,
  items,
  exchangeRate,
  onlyCurrency,
}: {
  title: string
  items: CartItem[]
  exchangeRate: number
  onlyCurrency?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => {
          const subtotal = Number(item.price || 0) * Number(item.quantity || 0)
          const subtotalVES = subtotal * Number(exchangeRate || 0)

          return (
            <div
              key={`${item.id}-${item.name}-${index}`}
              className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p>{item.name} x{item.quantity}</p>
                <p className="shrink-0 font-black text-[var(--brand-primary)]">
                  {formatUSD(subtotal)}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--brand-ink-2)]/60">
                <span>{onlyCurrency ? "Solo divisas" : `Bs ${formatVES(subtotalVES)}`}</span>
                {isStaffConfirmationItemRequired(item) && !isStaffConfirmationItemConfirmed(item) && (
                  <span className="rounded-full bg-[var(--brand-accent)] px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.10em] text-[var(--brand-ink)]">
                    Revisar
                  </span>
                )}
                {isStaffConfirmationItemConfirmed(item) && (
                  <span className="rounded-full bg-green-100 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.10em] text-green-700">
                    Confirmado
                  </span>
                )}
              </div>
              {getOrderItemDetailLines(item).map((line) => (
                <p key={line} className="mt-1 rounded-lg bg-[var(--brand-cream)] px-2 py-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/75">
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


export function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--brand-ink-3)]/60 px-4 py-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-ink-3)] shadow-2xl shadow-black/45">
        <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />
        <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--brand-primary)] bg-white px-6 py-5">
          <h2 className="text-3xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
          >
            <X size={24} />
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}
