"use client";

import { AlertTriangle, X } from "lucide-react";
import { formatUSD } from "@/utils/formatCurrency";

// Toast flotante "pedido anulado": rojo y persistente (queda fijo hasta que
// lo cierren). El dueño pidió que las anulaciones SE NOTEN en gerencia.

export type CancelledOrderAlert = {
  orderId: string;
  number: string;
  customerName: string;
  itemsSummary: string;
  totalUSD: number;
};

export default function OrderCancellationAlertToast({
  alert,
  onDismiss,
}: {
  alert: CancelledOrderAlert | null;
  onDismiss: () => void;
}) {
  if (!alert) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[95] w-[min(94vw,26rem)] -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0">
      <div className="overflow-hidden rounded-[1.6rem] border-4 border-red-600 bg-white shadow-[0_14px_0_rgba(220,38,38,0.25)]">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded-full bg-red-600 text-white">
            <AlertTriangle size={24} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-red-700">
              ¡Pedido anulado!
            </p>
            <p className="mt-1 truncate text-base font-black text-red-950">
              {alert.number}
              {alert.customerName ? ` · ${alert.customerName}` : ""}
              {alert.totalUSD > 0 ? ` · ${formatUSD(alert.totalUSD)}` : ""}
            </p>
            {alert.itemsSummary ? (
              <p className="mt-1 text-[0.72rem] font-bold leading-4 text-red-900/70">
                {alert.itemsSummary}
              </p>
            ) : null}
            <p className="mt-2 text-[0.68rem] font-bold text-red-900/55">
              Revisa el detalle y el motivo en Auditoría o con el equipo de caja.
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar aviso de anulación"
            className="shrink-0 rounded-full border-2 border-red-200 bg-white p-1.5 text-red-700 transition hover:bg-red-50"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
