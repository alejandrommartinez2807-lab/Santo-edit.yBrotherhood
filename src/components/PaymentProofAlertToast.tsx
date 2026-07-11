"use client";

import Link from "next/link";
import { BadgeDollarSign, X } from "lucide-react";
import { formatUSD, formatVES } from "@/utils/formatCurrency";
import type { NewPaymentProofAlert } from "@/hooks/usePaymentProofAlerts";

// Toast flotante "llegó un pago": grande, verde y con acceso directo a la
// revisión. El dueño pidió que registrar un pago SE NOTE; queda fijo hasta
// que lo cierren o abran el detalle.

export default function PaymentProofAlertToast({
  alert,
  reviewHref = "/local-santo/comprobantes",
  onDismiss,
}: {
  alert: NewPaymentProofAlert | null;
  reviewHref?: string;
  onDismiss: () => void;
}) {
  if (!alert) return null;

  const amountParts = [
    alert.amountReportedUSD > 0 ? formatUSD(alert.amountReportedUSD) : "",
    alert.amountReportedVES > 0 ? `Bs ${formatVES(alert.amountReportedVES)}` : "",
  ].filter(Boolean);

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-[min(94vw,26rem)] -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0">
      <div className="overflow-hidden rounded-[1.6rem] border-4 border-emerald-600 bg-white shadow-[0_14px_0_rgba(5,150,105,0.25)]">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded-full bg-emerald-600 text-white">
            <BadgeDollarSign size={24} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-emerald-700">
              ¡Pago reportado!
            </p>
            <p className="mt-1 truncate text-base font-black text-emerald-950">
              {alert.customerName}
              {amountParts.length ? ` · ${amountParts.join(" + ")}` : ""}
            </p>
            {alert.orderId ? (
              <p className="truncate text-[0.7rem] font-bold text-emerald-900/60">
                Pedido {alert.orderId}
              </p>
            ) : null}

            <Link
              href={reviewHref}
              onClick={onDismiss}
              className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-emerald-700 bg-emerald-600 px-4 py-2 text-[0.7rem] font-black uppercase tracking-[0.1em] text-white transition hover:bg-emerald-700"
            >
              Revisar comprobante
            </Link>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar aviso de pago"
            className="shrink-0 rounded-full border-2 border-emerald-200 bg-white p-1.5 text-emerald-700 transition hover:bg-emerald-50"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
