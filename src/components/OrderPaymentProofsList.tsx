"use client";

import { ImageIcon } from "lucide-react";
import type { PaymentProof } from "@/types/localOrders";
import { formatUSD, formatVES } from "@/utils/formatCurrency";

// Comprobantes de pago DENTRO de la tarjeta del pedido: el staff ve las
// capturas y referencias sin tener que ir a la sección de comprobantes.
export default function OrderPaymentProofsList({
  proofs,
}: {
  proofs: PaymentProof[];
}) {
  if (!proofs.length) return null;

  return (
    <div className="rounded-[1.4rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        Comprobantes de pago ({proofs.length})
      </p>

      <div className="mt-3 space-y-2">
        {proofs.map((proof) => {
          const amountParts = [
            proof.amountReportedUSD > 0
              ? formatUSD(proof.amountReportedUSD)
              : "",
            proof.amountReportedVES > 0
              ? `Bs ${formatVES(proof.amountReportedVES)}`
              : "",
          ].filter(Boolean);

          const detailParts = [
            amountParts.join(" + "),
            proof.reportedMethod,
            proof.paymentReference ? `Ref: ${proof.paymentReference}` : "",
          ].filter(Boolean);

          const content = (
            <>
              {proof.proofImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={proof.proofImageUrl}
                  alt="Comprobante de pago"
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-cream)] text-[var(--brand-ink-2)]/50">
                  <ImageIcon size={22} />
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[0.68rem] font-black uppercase tracking-[0.1em] ${
                    proof.status === "Confirmado por caja"
                      ? "text-green-700"
                      : proof.status === "Rechazado"
                        ? "text-red-700"
                        : "text-[var(--brand-primary)]"
                  }`}
                >
                  {proof.status}
                </span>
                <span className="mt-0.5 block truncate text-xs font-bold text-[var(--brand-ink-2)]/75">
                  {detailParts.join(" · ") || "Sin detalles"}
                </span>
                {proof.proofImageUrl && (
                  <span className="mt-0.5 block text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/45">
                    Toca para ampliar
                  </span>
                )}
              </span>
            </>
          );

          const itemClassName =
            "flex w-full items-center gap-3 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] p-2.5 text-left";

          return proof.proofImageUrl ? (
            <a
              key={proof.id}
              href={proof.proofImageUrl}
              target="_blank"
              rel="noreferrer"
              className={`${itemClassName} transition hover:bg-[rgba(var(--brand-primary-rgb),0.08)]`}
            >
              {content}
            </a>
          ) : (
            <div key={proof.id} className={itemClassName}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
