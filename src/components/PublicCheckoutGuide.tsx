"use client";

import { AlertTriangle, ListChecks } from "lucide-react";

// Guía paso a paso del checkout público + advertencia de pago anticipado.
// El dueño controla ambas desde Configuración (publicOrderStepsEnabled,
// publicPrepayNoticeEnabled/Text). Pedido del dueño de Brotherhood: que el
// cliente sepa exactamente qué botón tocar y que NO se prepara sin pagar.

// "Cancelar" = pagar en el habla local; se alternan sinónimos (cancelar,
// pagar, abono) para no repetir "pago" tantas veces (pedido del dueño).
export const DEFAULT_PREPAY_NOTICE_TEXT =
  "Tu pedido NO empieza a prepararse hasta que canceles (pagues) y caja confirme tu abono. Después de registrarlo, cancela con tu método preferido y toca «Reportar mi pago».";

type CheckoutOrderType = "Comer aquí" | "Para llevar" | "Delivery";

function getStepsForOrderType(
  orderType: CheckoutOrderType,
  options: { submitLabel: string; prepayEnabled: boolean },
): string[] {
  const submit = options.submitLabel || "Registrar pedido";

  if (orderType === "Comer aquí") {
    return [
      "Revisa que tu carrito tenga todo lo que quieres.",
      "Escribe tu nombre e indica tu mesa o ubicación.",
      `Toca el botón «${submit}» al final.`,
      "Listo: el personal recibe tu pedido y te atiende en la mesa.",
    ];
  }

  if (orderType === "Para llevar") {
    return [
      "Revisa que tu carrito tenga todo lo que quieres.",
      "Escribe tu nombre y tu teléfono (para avisarte).",
      `Elige cómo vas a pagar y toca «${submit}».`,
      ...(options.prepayEnabled
        ? ["Realiza el pago y toca «Reportar mi pago» en la confirmación."]
        : []),
      "Te avisamos cuando esté listo para retirar.",
    ];
  }

  return [
    "Revisa que tu carrito tenga todo lo que quieres.",
    "Comparte tu ubicación y datos de entrega.",
    `Elige cómo vas a pagar y toca «${submit}».`,
    ...(options.prepayEnabled
      ? ["Realiza el pago y toca «Reportar mi pago» en la confirmación."]
      : []),
    "Confirmado el pago, preparamos y enviamos tu pedido.",
  ];
}

export function PublicCheckoutSteps({
  orderType,
  submitLabel,
  prepayEnabled,
}: {
  orderType: CheckoutOrderType;
  submitLabel: string;
  prepayEnabled: boolean;
}) {
  const steps = getStepsForOrderType(orderType, { submitLabel, prepayEnabled });

  return (
    <div className="rounded-2xl border-2 border-[var(--brand-primary)]/35 bg-[var(--brand-surface-2)] px-4 py-3.5">
      <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
        <ListChecks size={18} />
        Así se pide, paso a paso
      </p>

      <ol className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <li key={step} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[0.75rem] font-black text-black">
              {index + 1}
            </span>
            <span className="text-[0.95rem] font-bold leading-6 text-[var(--brand-ink-2)]/90">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PublicPrepayNotice({ text }: { text?: string }) {
  const noticeText = String(text || "").trim() || DEFAULT_PREPAY_NOTICE_TEXT;

  return (
    <div
      role="alert"
      className="rounded-2xl border-[3px] border-amber-500 bg-amber-50 px-4 py-3.5 shadow-[0_4px_0_rgba(217,119,6,0.25)]"
    >
      <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-amber-800">
        <AlertTriangle size={18} className="shrink-0" />
        Importante antes de pedir
      </p>
      <p className="mt-2 text-base font-black leading-6 text-amber-900">
        {noticeText}
      </p>
    </div>
  );
}
