import type { ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Clock, Eye, EyeOff, X } from "lucide-react"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import { getOrderItemDetailLines } from "@/lib/localOrderHelpers"
import type {
  CartItem,
  CloseReviewItem,
  CloseReviewTone,
  DaySummaryItem,
  ExpenseSummaryItem,
  PaymentSummaryItem,
} from "./domain"

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
  const className =
    "group flex min-h-[180px] flex-col justify-between rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 text-left shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.10)] transition hover:-translate-y-0.5 hover:bg-yellow-50"

  const content = (
    <>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]">
            {icon}
          </div>

          <span className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-3 py-1 text-[0.58rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
            {metric}
          </span>
        </div>

        <p className="mt-4 text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          {eyebrow}
        </p>

        <h2 className="mt-1 text-2xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_2px_0_rgba(var(--brand-accent-rgb),0.75)]">
          {title}
        </h2>

        <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
          {description}
        </p>
      </div>

      <div className="mt-4 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] group-hover:bg-[var(--brand-accent)] group-hover:text-[var(--brand-ink)]">
        {disabled ? "Disponible luego" : "Entrar"}
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
      ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
      : "border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-primary)]"

  return (
    <div className={`min-w-0 overflow-hidden rounded-[1.2rem] border-2 p-3 ${style}`}>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-1 whitespace-nowrap text-lg font-black leading-tight tracking-[-0.03em] sm:text-xl xl:text-2xl">
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

export function CloseDetailSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4"
    >
      <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            {title}
          </p>
          {description && (
            <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
              {description}
            </p>
          )}
        </div>

        <span className="inline-flex w-fit rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] group-open:bg-[var(--brand-accent)] group-open:text-[var(--brand-ink)]">
          <span className="group-open:hidden">Mostrar</span>
          <span className="hidden group-open:inline">Ocultar</span>
        </span>
      </summary>

      <div className="mt-4 border-t-2 border-[var(--brand-primary)]/15 pt-4">
        {children}
      </div>
    </details>
  )
}

export function ExpenseSummaryList({
  title,
  emptyText,
  items,
}: {
  title: string
  emptyText: string
  items: ExpenseSummaryItem[]
}) {
  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {title}
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
          {emptyText}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                    {item.count} gasto(s)
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-base font-black text-[var(--brand-primary)]">
                    {formatUSD(item.totalUSD)}
                  </p>
                  {item.amountVES > 0 && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      Bs {formatVES(item.amountVES)}
                    </p>
                  )}
                  {item.amountUSD > 0 && Math.abs(item.amountUSD - item.totalUSD) > 0.009 && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      Divisas {formatUSD(item.amountUSD)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PaymentSummaryList({
  title,
  emptyText,
  items,
  showVES,
  showDelivery,
}: {
  title: string
  emptyText: string
  items: PaymentSummaryItem[]
  showVES?: boolean
  showDelivery?: boolean
}) {
  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {title}
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
          {emptyText}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                    {item.count} registro(s)
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-base font-black text-[var(--brand-primary)]">
                    {formatUSD(item.totalUSD)}
                  </p>
                  {showVES && item.totalVES && item.totalVES > 0 && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      Bs {formatVES(item.totalVES)}
                    </p>
                  )}
                  {showDelivery &&
                    item.deliveryCostUSD &&
                    item.deliveryCostUSD > 0 &&
                    Math.abs(item.deliveryCostUSD - item.totalUSD) > 0.009 && (
                      <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                        Delivery {formatUSD(item.deliveryCostUSD)}
                      </p>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SummaryList({
  title,
  emptyText,
  items,
  showDelivery,
}: {
  title: string
  emptyText: string
  items: DaySummaryItem[]
  showDelivery?: boolean
}) {
  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {title}
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
          {emptyText}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                    {item.count} pedido(s)
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-base font-black text-[var(--brand-primary)]">
                    {formatUSD(item.totalUSD)}
                  </p>
                  {showDelivery && item.deliveryCostUSD > 0 && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      Delivery {formatUSD(item.deliveryCostUSD)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
          const detailLines = getOrderItemDetailLines(item)

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
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                {onlyCurrency ? "Solo divisas" : `Bs ${formatVES(subtotalVES)}`}
              </p>
              {detailLines.length > 0 && (
                <div className="mt-2 space-y-1">
                  {detailLines.map((line, lineIndex) => (
                    <p
                      key={`${item.id}-${item.name}-${index}-detail-${lineIndex}`}
                      className="text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


export function getCloseReviewItemClasses(tone: CloseReviewTone) {
  if (tone === "danger") {
    return {
      wrapper: "border-red-500/45 bg-red-50",
      icon: "border-red-600 bg-white text-red-700",
      title: "text-red-800",
      value: "text-red-700",
    }
  }

  if (tone === "warning") {
    return {
      wrapper: "border-yellow-400 bg-[var(--brand-accent-100)]",
      icon: "border-[var(--brand-amber)] bg-[var(--brand-accent)] text-[var(--brand-amber)]",
      title: "text-[var(--brand-amber)]",
      value: "text-[var(--brand-primary)]",
    }
  }

  if (tone === "success") {
    return {
      wrapper: "border-green-500/45 bg-green-50",
      icon: "border-green-700 bg-green-500 text-white",
      title: "text-green-800",
      value: "text-green-700",
    }
  }

  return {
    wrapper: "border-[var(--brand-primary)]/25 bg-white",
    icon: "border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-primary)]",
    title: "text-[var(--brand-primary)]",
    value: "text-[var(--brand-ink-3)]",
  }
}

export function CloseReviewPanel({
  items,
  isVisible,
  onToggle,
}: {
  items: CloseReviewItem[]
  isVisible: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Revisión inteligente del cierre
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            {isVisible
              ? "El sistema marca puntos de caja y operación que conviene revisar antes de guardar el cierre y reiniciar pedidos."
              : "La revisión está oculta para dejar más limpio el cierre. Puedes mostrarla otra vez antes de confirmar."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
            {items.length} punto(s)
          </span>

          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
          >
            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            {isVisible ? "Ocultar revisión" : "Mostrar revisión"}
          </button>
        </div>
      </div>

      {isVisible ? (
        <div className="mt-4 grid gap-3">
          {items.map((item, index) => (
            <CloseReviewItemCard key={`${item.title}-${index}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-3">
          <p className="text-sm font-black uppercase text-[var(--brand-amber)]">
            Revisión oculta
          </p>
          <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            Hay {items.length} punto(s) detectado(s). El cierre puede continuar si escribes REINICIAR, pero conviene revisar esos puntos cuando caja no cuadre.
          </p>
        </div>
      )}
    </div>
  )
}

export function CloseReviewItemCard({ item }: { item: CloseReviewItem }) {
  const classes = getCloseReviewItemClasses(item.tone)

  return (
    <div className={`rounded-2xl border-2 p-4 ${classes.wrapper}`}>
      <div className="flex gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${classes.icon}`}
        >
          {item.tone === "success" ? (
            <CheckCircle2 size={20} />
          ) : item.tone === "info" ? (
            <Clock size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <p className={`text-sm font-black uppercase ${classes.title}`}>
              {item.title}
            </p>
            <p className={`shrink-0 text-sm font-black ${classes.value}`}>
              {item.value}
            </p>
          </div>

          <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            {item.description}
          </p>
        </div>
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
