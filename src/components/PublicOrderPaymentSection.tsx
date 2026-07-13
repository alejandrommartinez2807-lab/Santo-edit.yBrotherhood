"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  ReceiptText,
  Send,
  XCircle,
} from "lucide-react";
import { formatUSD, formatVES } from "@/utils/formatCurrency";
import { DEFAULT_PUBLIC_PAYMENT_METHODS } from "@/lib/publicPageConfig";

// Sección "Pagos" de la página pública de seguimiento (/pedido/[orderId]):
// - El cliente que salió sin subir su captura puede reportar el pago DESPUÉS
//   desde el mismo link que guardó (o recibió por WhatsApp).
// - Si ya reportó uno, lo ve con su estado (en revisión / confirmado) para no
//   enviarlo dos veces días después.
// - Cuando caja confirma, aquí aparece "Pago confirmado".

type PublicProof = {
  createdAt: string;
  status: string;
  reportedMethod: string;
  amountReportedUSD: number;
  amountReportedVES: number;
  paymentReference: string;
  internalNote: string;
};

type OrderPaymentInfo = {
  branchId: string;
  totalUSD: number;
  exchangeRate: number;
  paymentRegistered: boolean;
  proofs: PublicProof[];
};

function formatDateTime(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function proofStatusChip(status: string) {
  if (status === "Confirmado por caja") {
    return {
      icon: <BadgeCheck size={14} />,
      classes: "border-green-600 bg-green-600/15 text-green-400",
      label: "Confirmado",
    };
  }
  if (status === "Rechazado") {
    return {
      icon: <XCircle size={14} />,
      classes: "border-red-500 bg-red-500/15 text-red-400",
      label: "Rechazado",
    };
  }
  if (status === "Necesita corrección") {
    return {
      icon: <XCircle size={14} />,
      classes: "border-orange-500 bg-orange-500/15 text-orange-400",
      label: "Necesita corrección",
    };
  }
  return {
    icon: <Clock3 size={14} />,
    classes: "border-yellow-500 bg-yellow-500/10 text-yellow-500",
    label: "En revisión",
  };
}

function normalizeMoneyInput(value: string) {
  const rawValue = value.trim().replace(/\s/g, "").replace(",", ".");
  const numberValue = Number(rawValue);

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

import PaymentMethodDetailsList from "@/components/PaymentMethodDetailsList";
import { readRecentPublicOrders } from "@/components/recentPublicOrders";
// Clasificador único de moneda del método (compartido con caja/pedidos): los
// indicadores de divisa mandan (Zelle/Binance/"…internacional"/"…en dólares" son
// en $); pago móvil, punto, transferencia local, efectivo Bs, biopago son en Bs.
import { isVesPaymentMethod } from "@/lib/paymentOptions";

type PaymentEntry = {
  method: string;
  amountUSD: string;
  amountVES: string;
};

const EMPTY_PAYMENT_ENTRY: PaymentEntry = {
  method: "",
  amountUSD: "",
  amountVES: "",
};

// Total del "Paso 1" en la moneda de los métodos elegidos al pedir: solo Bs si
// todos son en bolívares, solo $ si todos son en divisas, ambos si hay mezcla.
function formatChosenTotal(
  info: { totalUSD: number; exchangeRate: number },
  chosenMethods: string[],
) {
  const vesChosen = chosenMethods.some((methodName) => isVesPaymentMethod(methodName));
  const usdChosen = chosenMethods.some((methodName) => !isVesPaymentMethod(methodName));
  const totalVES = info.totalUSD * info.exchangeRate;
  const canShowVES = vesChosen && info.exchangeRate > 0 && totalVES > 0;

  if (canShowVES && !usdChosen) return `Bs ${formatVES(totalVES)}`;
  if (canShowVES && usdChosen) return `${formatUSD(info.totalUSD)} · Bs ${formatVES(totalVES)}`;
  return formatUSD(info.totalUSD);
}

export default function PublicOrderPaymentSection({
  orderId,
}: {
  orderId: string;
}) {
  const [info, setInfo] = useState<OrderPaymentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProofsEnabled, setIsProofsEnabled] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    DEFAULT_PUBLIC_PAYMENT_METHODS,
  );
  // Datos del negocio para pagar (pago móvil, Zelle…) y métodos que el
  // cliente eligió al pedir (guardados en su dispositivo): con esto la página
  // de seguimiento muestra lo mismo que la confirmación del pedido.
  const [paymentMethodDetails, setPaymentMethodDetails] = useState<
    Record<string, string>
  >({});
  const [chosenMethods, setChosenMethods] = useState<string[]>([]);
  // Configurable por el dueño: si está apagado, el método del pedido queda
  // fijo al reportar el pago (cuando se conoce cuál eligió el cliente).
  const [allowMethodChange, setAllowMethodChange] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  // Un bloque por método: si el cliente pagó parte con un método y parte con
  // otro, indica cuánto fue en cada uno. Se precarga con lo que eligió al
  // pedir (editable si al final pagó distinto).
  const [payments, setPayments] = useState<PaymentEntry[]>([EMPTY_PAYMENT_ENTRY]);
  const [reference, setReference] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  // Aviso suave cuando lo reportado no cubre el total: se puede enviar igual
  // (abonos parciales existen), pero que sea a propósito y no un error.
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/public/order-payment?pedido=${encodeURIComponent(orderId)}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (response.ok && data.ok) {
        setInfo({
          branchId: String(data.branchId || ""),
          totalUSD: Number(data.totalUSD || 0),
          exchangeRate: Number(data.exchangeRate || 0),
          paymentRegistered: data.paymentRegistered === true,
          proofs: Array.isArray(data.proofs) ? data.proofs : [],
        });
      }
    } catch {
      // Sin datos de pago la página de seguimiento funciona igual.
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/business-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const config = data?.businessConfig || data?.config || {};
        setIsProofsEnabled(config.paymentProofsEnabled !== false);
        setAllowMethodChange(config.publicPaymentMethodChangeEnabled !== false);
        const methods = Array.isArray(config.publicPaymentMethods)
          ? config.publicPaymentMethods
              .map((item: unknown) => String(item || "").trim())
              .filter(Boolean)
          : [];
        if (methods.length) setPaymentMethods(methods);
        const details = config.publicPaymentMethodDetails;
        if (details && typeof details === "object" && !Array.isArray(details)) {
          setPaymentMethodDetails(details as Record<string, string>);
        }
      })
      .catch(() => {
        // Config pública caída: se usan los métodos por defecto.
      });

    // Difiere la carga un tick para no hacer setState síncrono en el efecto
    // (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void loadInfo();
      const recentEntry = readRecentPublicOrders().find(
        (entry) => entry.id === orderId,
      );
      setChosenMethods(recentEntry?.paymentMethods || []);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadInfo, orderId]);

  const activeProofs = (info?.proofs || []).filter(
    (proof) => proof.status !== "Rechazado",
  );
  const hasConfirmedPayment =
    info?.paymentRegistered ||
    activeProofs.some((proof) => proof.status === "Confirmado por caja");
  const hasPendingProof = activeProofs.some(
    (proof) =>
      proof.status === "Comprobante enviado" || proof.status === "En revisión",
  );
  const needsCorrection = (info?.proofs || []).some(
    (proof) => proof.status === "Necesita corrección",
  );

  function handleFileChange(file: File | undefined) {
    setFormError(null);

    if (!file) {
      setDataUrl("");
      setFileName("");
      setMimeType("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFormError("El comprobante debe ser una imagen (captura o foto).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError("La imagen pesa más de 5 MB. Usa una captura más liviana.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:image/")) {
        setFormError("No se pudo leer la imagen del comprobante.");
        return;
      }
      setDataUrl(result);
      setFileName(file.name || "comprobante.jpg");
      setMimeType(file.type || "image/jpeg");
    };
    reader.onerror = () => {
      setFormError("No se pudo leer la imagen del comprobante.");
    };
    reader.readAsDataURL(file);
  }

  // Monto prellenado en LA MONEDA del método: pago móvil/punto → Bs (con la
  // tasa del pedido); Zelle/efectivo divisas → $.
  function buildPrefilledEntry(methodName: string, amountUSDToCover: number): PaymentEntry {
    if (amountUSDToCover <= 0) {
      return { method: methodName, amountUSD: "", amountVES: "" };
    }

    const rate = Number(info?.exchangeRate || 0);
    if (isVesPaymentMethod(methodName) && rate > 0) {
      return {
        method: methodName,
        amountUSD: "",
        amountVES: (Math.round(amountUSDToCover * rate * 100) / 100).toFixed(2),
      };
    }

    return {
      method: methodName,
      amountUSD: amountUSDToCover.toFixed(2),
      amountVES: "",
    };
  }

  // Precarga del formulario: un bloque por método elegido al pedir; si fue
  // uno solo, su monto arranca con el total del pedido en su moneda.
  function buildInitialPayments(): PaymentEntry[] {
    const chosen = chosenMethods.filter(Boolean);
    const totalUSD = Number(info?.totalUSD || 0);

    if (chosen.length === 0) {
      return [{ ...EMPTY_PAYMENT_ENTRY, amountUSD: totalUSD > 0 ? totalUSD.toFixed(2) : "" }];
    }

    if (chosen.length === 1) {
      return [buildPrefilledEntry(chosen[0], totalUSD)];
    }

    // Varios métodos: los montos quedan vacíos para que el cliente reparta
    // cuánto pagó con cada uno (el botón "Completar" ayuda con el faltante).
    return chosen.map((methodName) => ({ method: methodName, amountUSD: "", amountVES: "" }));
  }

  // USD equivalente ya cargado en los demás bloques (para "Completar").
  function getCoveredUSDExcept(excludeIndex: number) {
    const rate = Number(info?.exchangeRate || 0);
    return payments.reduce((total, entry, index) => {
      if (index === excludeIndex) return total;
      const usd = normalizeMoneyInput(entry.amountUSD);
      const ves = normalizeMoneyInput(entry.amountVES);
      return total + usd + (rate > 0 ? ves / rate : 0);
    }, 0);
  }

  // "Completar": llena el bloque con lo que falta para cubrir el total,
  // en la moneda del método elegido.
  function completeEntryAmount(index: number) {
    const totalUSD = Number(info?.totalUSD || 0);
    if (totalUSD <= 0) return;

    const remainingUSD = Math.max(totalUSD - getCoveredUSDExcept(index), 0);
    const prefilled = buildPrefilledEntry(payments[index]?.method || "", remainingUSD);

    updatePaymentEntry(index, {
      amountUSD: prefilled.amountUSD,
      amountVES: prefilled.amountVES,
    });
  }

  function updatePaymentEntry(index: number, patch: Partial<PaymentEntry>) {
    setPayments((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  }

  // Cambia el método de un bloque y limpia el monto en la moneda que ya no
  // aplica (bolívares → borra $, divisas → borra Bs), para no reportar un monto
  // en la moneda equivocada. El botón "Completar lo que falta" rellena el resto.
  function changePaymentEntryMethod(index: number, nextMethod: string) {
    setPayments((current) =>
      current.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        if (isVesPaymentMethod(nextMethod)) return { ...entry, method: nextMethod, amountUSD: "" };
        if (nextMethod.trim() !== "") return { ...entry, method: nextMethod, amountVES: "" };
        return { ...entry, method: nextMethod };
      }),
    );
  }

  async function submitProof(confirmDuplicate = false, confirmPartial = false) {
    const entries = payments
      .map((entry) => ({
        method: entry.method.trim(),
        usd: normalizeMoneyInput(entry.amountUSD),
        ves: normalizeMoneyInput(entry.amountVES),
      }))
      .filter((entry) => entry.method || entry.usd > 0 || entry.ves > 0);

    const reportedUSD = entries.reduce((total, entry) => total + entry.usd, 0);
    const reportedVES = entries.reduce((total, entry) => total + entry.ves, 0);

    // Resumen por método para caja: "Zelle ($10.00) + Pago móvil (Bs 500,00)".
    const reportedMethod = entries
      .map((entry) => {
        const parts: string[] = [];
        if (entry.usd > 0) parts.push(formatUSD(entry.usd));
        if (entry.ves > 0) parts.push(`Bs ${formatVES(entry.ves)}`);
        if (!entry.method) return parts.join(" + ");
        return parts.length ? `${entry.method} (${parts.join(" + ")})` : entry.method;
      })
      .filter(Boolean)
      .join(" + ");

    // La captura es lo ideal, pero la referencia de la operación alcanza para
    // que caja verifique el pago.
    if (!dataUrl && !reference.trim()) {
      setFormError("Adjunta la captura del pago o escribe la referencia de la operación.");
      return;
    }

    if (reportedUSD <= 0 && reportedVES <= 0) {
      setFormError("Indica el monto que pagaste (en $ o en Bs).");
      return;
    }

    // Cobertura del total: si lo reportado no alcanza, avisar antes de enviar
    // (se puede enviar igual: los abonos parciales son válidos).
    const rate = Number(info?.exchangeRate || 0);
    const totalUSD = Number(info?.totalUSD || 0);
    if (!confirmPartial && totalUSD > 0 && (reportedVES <= 0 || rate > 0)) {
      const reportedEquivalentUSD = reportedUSD + (rate > 0 ? reportedVES / rate : 0);
      const missingUSD = Math.round((totalUSD - reportedEquivalentUSD) * 100) / 100;

      if (missingUSD > 0.01) {
        setFormError(null);
        setCoverageWarning(
          `Lo reportado no cubre el total del pedido: faltan ${formatUSD(missingUSD)} (total ${formatUSD(totalUSD)}). Usa "Completar" para ajustar el monto, o envíalo así si es un abono parcial.`,
        );
        return;
      }
    }
    setCoverageWarning(null);

    try {
      setIsSubmitting(true);
      setFormError(null);
      setDuplicateWarning(null);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // El pedido sabe a qué sede pertenece: el comprobante viaja a ella
      // aunque el cliente abra el link en otro teléfono.
      if (info?.branchId) headers["x-branch-id"] = info.branchId;

      const response = await fetch("/api/payment-proofs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderId,
          reportedMethod,
          amountReportedUSD: reportedUSD,
          amountReportedVES: reportedVES,
          paymentReference: reference,
          customerNote,
          dataUrl,
          fileName,
          mimeType,
          confirmDuplicate,
        }),
      });
      const data = await response.json();

      if (response.status === 409 && data.duplicate) {
        setDuplicateWarning(
          data.error ||
            "Ya reportaste un pago para este pedido. ¿Quieres enviar otro de todas formas?",
        );
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "No se pudo enviar el comprobante");
      }

      setSuccessMessage(
        "¡Pago reportado! Caja lo revisará y aquí verás cuando quede confirmado.",
      );
      setIsFormOpen(false);
      setPayments([EMPTY_PAYMENT_ENTRY]);
      setCoverageWarning(null);
      setReference("");
      setCustomerNote("");
      setDataUrl("");
      setFileName("");
      setMimeType("");
      await loadInfo();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el comprobante",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !info || !isProofsEnabled) return null;

  return (
    <div className="mt-4 rounded-[2rem] border-4 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6">
      <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
        <ReceiptText size={15} />
        Pago del pedido
      </p>

      {hasConfirmedPayment ? (
        <p className="mt-4 inline-flex w-full items-center gap-2 rounded-2xl border-2 border-green-600 bg-green-600/15 px-4 py-3 text-sm font-black leading-5 text-green-400">
          <CheckCircle2 size={17} className="shrink-0" />
          Pago confirmado por el negocio. ¡Gracias!
        </p>
      ) : null}

      {!hasConfirmedPayment &&
        (() => {
          const filtered = chosenMethods.length
            ? Object.fromEntries(
                Object.entries(paymentMethodDetails).filter(([methodName]) =>
                  chosenMethods.includes(methodName),
                ),
              )
            : paymentMethodDetails;
          const visibleDetails = Object.keys(filtered).length
            ? filtered
            : paymentMethodDetails;

          if (!Object.keys(visibleDetails).length) return null;

          return (
            <div className="mt-4 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-4 text-left">
              <span className="inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
                Paso 1
              </span>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                Paga con estos datos
                {chosenMethods.length > 0 && (
                  <span className="text-[var(--brand-ink-2)]/45">
                    {" "}
                    ({chosenMethods.join(" + ")})
                  </span>
                )}
              </p>
              {info.totalUSD > 0 ? (
                <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/75">
                  Total a pagar: {formatChosenTotal(info, chosenMethods)}
                </p>
              ) : null}
              <div className="mt-2">
                <PaymentMethodDetailsList details={visibleDetails} />
              </div>
            </div>
          );
        })()}

      {info.proofs.length > 0 && (
        <div className="mt-4 space-y-2">
          {info.proofs.map((proof, index) => {
            const chip = proofStatusChip(proof.status);
            return (
              <div
                key={`${proof.createdAt}-${index}`}
                className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-3 text-left"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] ${chip.classes}`}
                  >
                    {chip.icon}
                    {chip.label}
                  </span>
                  <span className="text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                    {formatDateTime(proof.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-black text-[var(--brand-ink-3)]">
                  {proof.amountReportedUSD > 0 &&
                    formatUSD(proof.amountReportedUSD)}
                  {proof.amountReportedUSD > 0 && proof.amountReportedVES > 0
                    ? " + "
                    : ""}
                  {proof.amountReportedVES > 0 &&
                    `Bs ${formatVES(proof.amountReportedVES)}`}
                  {proof.reportedMethod ? ` · ${proof.reportedMethod}` : ""}
                </p>
                {proof.paymentReference ? (
                  <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                    Ref: {proof.paymentReference}
                  </p>
                ) : null}
                {proof.status === "Necesita corrección" && proof.internalNote ? (
                  <p className="mt-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-[0.72rem] font-bold leading-4 text-orange-400">
                    El negocio pide corregir: {proof.internalNote}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {hasPendingProof && !hasConfirmedPayment ? (
        <p className="mt-3 text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/60">
          Tu pago ya fue reportado y está en revisión: no hace falta enviarlo
          otra vez. Aquí verás cuando quede confirmado.
        </p>
      ) : null}

      {successMessage && (
        <p className="mt-3 rounded-2xl border-2 border-green-600 bg-green-600/15 px-4 py-3 text-sm font-black leading-5 text-green-400">
          {successMessage}
        </p>
      )}

      {!hasConfirmedPayment && !isFormOpen && !hasPendingProof ? (
        <span className="mt-4 inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
          Paso 2
        </span>
      ) : null}

      {!hasConfirmedPayment && !isFormOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsFormOpen(true);
            setSuccessMessage(null);
            setPayments(buildInitialPayments());
          }}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90"
        >
          <ImagePlus size={15} />
          {hasPendingProof || needsCorrection
            ? "Enviar otro comprobante"
            : "Reportar mi pago"}
        </button>
      ) : null}

      {isFormOpen && (
        <div className="mt-4 space-y-3 text-left">
          {/* Cambió el método respecto a lo que eligió al pedir: se puede
              (si el dueño lo permite), con la condición de cubrir el total. */}
          {chosenMethods.length > 0 &&
          payments.some(
            (entry) => entry.method && !chosenMethods.includes(entry.method),
          ) ? (
            <p className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-3 text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/70">
              Al pedir indicaste {chosenMethods.join(" + ")}. Puedes cambiar el
              método sin problema, siempre que el pago cubra el total del
              pedido.
            </p>
          ) : null}
          {payments.map((entry, index) => (
            <div
              key={`payment-entry-${index}`}
              className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/25 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                  {payments.length > 1 ? `Método ${index + 1}` : "¿Cómo pagaste?"}
                </label>
                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPayments((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                    className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/50 transition hover:text-red-400"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <select
                value={entry.method}
                onChange={(event) => changePaymentEntryMethod(index, event.target.value)}
                disabled={!allowMethodChange && chosenMethods.length > 0}
                className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)] outline-none focus:border-[var(--brand-primary)] disabled:opacity-60"
              >
                <option value="">Selecciona el método</option>
                {!paymentMethods.includes(entry.method) && entry.method ? (
                  <option value={entry.method}>{entry.method}</option>
                ) : null}
                {paymentMethods.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              {(() => {
                // Muestra el monto en la moneda del método: bolívares → solo Bs,
                // divisas → solo $. Sin método elegido aún, muestra ambos.
                const methodChosen = entry.method.trim() !== "";
                const entryIsVes = isVesPaymentMethod(entry.method);
                const showUSD = !methodChosen || !entryIsVes;
                const showVES = !methodChosen || entryIsVes;

                return (
                  <div className={`mt-2 grid gap-2 ${methodChosen ? "grid-cols-1" : "grid-cols-2"}`}>
                    {showUSD && (
                      <div>
                        <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          Monto $
                        </label>
                        <input
                          value={entry.amountUSD}
                          onChange={(event) =>
                            updatePaymentEntry(index, { amountUSD: event.target.value })
                          }
                          inputMode="decimal"
                          placeholder="0.00"
                          className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)] outline-none focus:border-[var(--brand-primary)]"
                        />
                      </div>
                    )}
                    {showVES && (
                      <div>
                        <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          Monto Bs
                        </label>
                        <input
                          value={entry.amountVES}
                          onChange={(event) =>
                            updatePaymentEntry(index, { amountVES: event.target.value })
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)] outline-none focus:border-[var(--brand-primary)]"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {info.totalUSD > 0 ? (
                <button
                  type="button"
                  onClick={() => completeEntryAmount(index)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--brand-primary)]/50 px-3.5 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)]/10"
                >
                  <CheckCircle2 size={13} />
                  Completar lo que falta
                </button>
              ) : null}
            </div>
          ))}

          {payments.length < 3 && (allowMethodChange || chosenMethods.length === 0) && (
            <button
              type="button"
              onClick={() =>
                setPayments((current) => [...current, { ...EMPTY_PAYMENT_ENTRY }])
              }
              className="w-full rounded-full border-2 border-dashed border-[var(--brand-border)] px-4 py-2.5 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              + Pagué con otro método también
            </button>
          )}

          <div>
            <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Referencia (opcional si adjuntas la captura)
            </label>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Últimos dígitos de la operación"
              className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)] outline-none focus:border-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Captura del pago (opcional si pones la referencia)
            </label>
            <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-sm font-bold text-[var(--brand-ink-2)]/70 transition hover:border-[var(--brand-primary)]">
              <ImagePlus size={17} />
              {fileName || "Toca para adjuntar la imagen"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0])}
              />
            </label>
          </div>

          <div>
            <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Nota (opcional)
            </label>
            <input
              value={customerNote}
              onChange={(event) => setCustomerNote(event.target.value)}
              placeholder="Ejemplo: pagó mi mamá desde su cuenta"
              className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)] outline-none focus:border-[var(--brand-primary)]"
            />
          </div>

          {formError && (
            <p className="rounded-2xl border-2 border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-bold leading-5 text-red-400">
              {formError}
            </p>
          )}

          {duplicateWarning && (
            <div className="rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/10 px-4 py-3">
              <p className="text-sm font-bold leading-5 text-yellow-500">
                {duplicateWarning}
              </p>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => submitProof(true, true)}
                className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-yellow-500 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-yellow-500 transition hover:bg-yellow-500/10 disabled:opacity-50"
              >
                Sí, enviar de todas formas
              </button>
            </div>
          )}

          {coverageWarning && (
            <div className="rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/10 px-4 py-3">
              <p className="text-sm font-bold leading-5 text-yellow-500">
                {coverageWarning}
              </p>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => submitProof(false, true)}
                className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-yellow-500 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-yellow-500 transition hover:bg-yellow-500/10 disabled:opacity-50"
              >
                Es un abono parcial, enviar así
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => submitProof(false)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              Enviar comprobante
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsFormOpen(false);
                setFormError(null);
                setDuplicateWarning(null);
                setCoverageWarning(null);
              }}
              className="rounded-full border-2 border-[var(--brand-border)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60 transition hover:border-[var(--brand-primary)] disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
