"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellRing,
  CheckCircle2,
  CookingPot,
  ImagePlus,
  Loader2,
  MessageCircle,
  Star,
  Wallet,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import {
  NOTIFY_READY_BUTTON_ENABLED,
  requestNotificationPermission,
  subscribeToPushForOrder,
  useOrderReadyAlert,
  usePublicOrderStatus,
} from "@/components/PublicOrderStatusNotifier";
import PublicOrderPaymentSection from "@/components/PublicOrderPaymentSection";

// Página pública de seguimiento reabrible: el cliente la guarda desde la
// confirmación (o la recibe por WhatsApp) y ve su pedido avanzar en vivo.
// No expone datos personales ni montos: solo número visible y estado.

// Con pago reportable (Pick up/Delivery electrónico) la línea arranca en
// "Esperando pago" y avanza a "Recibido" cuando caja confirma el cobro
// (lote v6). En mesa/efectivo se mantienen los 3 pasos de siempre.
const STEPS_BASE = ["Recibido", "Preparando", "Listo"] as const;
const STEPS_WITH_PAYMENT = [
  "Esperando pago",
  "Recibido",
  "Preparando",
  "Listo",
] as const;

function stepIndexForStatus(status: string) {
  if (status === "Preparando") return 1;
  if (status === "Listo" || status === "Entregado") return 2;
  return 0;
}

function stepIcon(step: string) {
  if (step === "Esperando pago" || step === "Pagado") return <Wallet size={17} />;
  if (step === "Recibido") return <CheckCircle2 size={17} />;
  if (step === "Preparando") return <CookingPot size={17} />;
  return <BellRing size={17} />;
}

export default function PedidoSeguimientoPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId: rawOrderId } = use(params);
  const orderId = decodeURIComponent(String(rawOrderId || "")).trim().toLowerCase();
  const { status, displayNumber, items, cancelReason, payment, notFound } =
    usePublicOrderStatus(orderId);
  // Señal para abrir el formulario de reporte de pago desde el CTA de arriba
  // (mismo mecanismo que la confirmación del carrito).
  const [openReportSignal, setOpenReportSignal] = useState(0);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  // Pop-up de reseña tras la venta: se abre UNA vez cuando el pedido pasa a
  // Entregado (recordado por dispositivo para no insistir al reabrir el link).
  const [isReviewPopupOpen, setIsReviewPopupOpen] = useState(false);
  // El cliente puede cancelar SU pedido mientras siga en "Nuevo" (sin pago):
  // modal de confirmación con motivo opcional.
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // WhatsApp del negocio para el botón "¿Dudas con tu pedido? Escríbenos"
  // (el dueño lo activa/apaga desde Configuración).
  const [orderHelpWhatsapp, setOrderHelpWhatsapp] = useState("");
  const [businessName, setBusinessName] = useState("");
  // Fuente única de si el reporte de pago está disponible (la resuelve la
  // config pública que igual cargamos aquí). Se pasa al PublicOrderPaymentSection
  // para que su render NO dependa de un segundo fetch que puede fallar en el
  // teléfono y dejar el reporte de pago muerto en silencio.
  const [paymentProofsEnabled, setPaymentProofsEnabled] = useState<
    boolean | undefined
  >(undefined);

  useOrderReadyAlert({ orderId, status, displayNumber, notifyEnabled });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/business-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const config = data?.businessConfig || {};
        const url = String(config.googleReviewUrl || "").trim();
        if (url.startsWith("https://") || url.startsWith("http://")) {
          setGoogleReviewUrl(url);
        }

        setBusinessName(String(config.businessName || "").trim());
        setPaymentProofsEnabled(config.paymentProofsEnabled !== false);

        if (config.orderHelpWhatsappEnabled !== false) {
          const phone = String(
            config.deliveryWhatsapp ||
              config.mainWhatsapp ||
              BRAND.whatsapp ||
              "",
          ).replace(/[^0-9]/g, "");
          setOrderHelpWhatsapp(phone);
        }
      })
      .catch(() => {
        // Sin config no hay CTA de reseña; el seguimiento funciona igual.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const orderHelpHref = orderHelpWhatsapp
    ? `https://wa.me/${orderHelpWhatsapp}?text=${encodeURIComponent(
        [
          `Hola ${businessName || BRAND.name}! Tengo una duda sobre mi pedido${displayNumber ? ` ${displayNumber}` : ""}.`,
          "¿Me pueden ayudar?",
        ].join("\n"),
      )}`
    : "";

  const isReady = status === "Listo";
  const isDelivered = status === "Entregado";
  const isCancelled = status === "Cancelado";
  // Estado del pago: "expected" (Pick up/Delivery con método elegido, incluso
  // efectivo) manda el paso "Esperando pago"; "reportable" (solo electrónico)
  // manda el CTA de subir captura/referencia (lote v6 + ajuste 2026-07-23).
  const paymentExpected = payment?.expected === true || payment?.reportable === true;
  const paymentReportable = payment?.reportable === true;
  const paymentConfirmed = payment?.confirmed === true;
  const paymentReported = payment?.reported === true;
  const needsPaymentReport =
    paymentReportable &&
    !paymentConfirmed &&
    !paymentReported &&
    !isCancelled &&
    !isDelivered;
  const steps: readonly string[] = paymentExpected
    ? STEPS_WITH_PAYMENT
    : STEPS_BASE;
  const baseStep = stepIndexForStatus(status);
  // Con pago esperado: cocina avanzada arrastra la línea (aunque caja no
  // haya marcado el cobro); si sigue en Nuevo, "Recibido" solo se alcanza al
  // confirmarse el pago.
  const activeStep = paymentExpected
    ? baseStep > 0
      ? baseStep + 1
      : paymentConfirmed
        ? 1
        : 0
    : baseStep;

  function openPaymentReport() {
    setOpenReportSignal((current) => current + 1);
    window.setTimeout(() => {
      document
        .getElementById("reporte-pago-seccion")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  useEffect(() => {
    if (!isDelivered || !googleReviewUrl) return;

    const dismissKey = `bh_review_prompt_${orderId}`;
    try {
      if (window.localStorage.getItem(dismissKey)) return;
    } catch {
      // Sin localStorage el pop-up igual se muestra una vez por visita.
    }

    const timer = window.setTimeout(() => setIsReviewPopupOpen(true), 800);
    return () => window.clearTimeout(timer);
  }, [isDelivered, googleReviewUrl, orderId]);

  function dismissReviewPopup() {
    setIsReviewPopupOpen(false);
    try {
      window.localStorage.setItem(`bh_review_prompt_${orderId}`, "1");
    } catch {
      // Sin localStorage no pasa nada: solo podría volver a aparecer.
    }
  }

  async function submitClientCancellation() {
    try {
      setIsCancelling(true);
      setCancelError(null);

      const response = await fetch("/api/public/order-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason: cancelReasonInput.trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || "No se pudo cancelar el pedido");
      }

      // El polling del estado refleja "Cancelado" solo; cerramos el modal.
      setIsCancelModalOpen(false);
      setCancelReasonInput("");
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : "No se pudo cancelar el pedido",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <section className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/60 transition hover:text-[var(--brand-primary)]"
        >
          <ArrowLeft size={15} />
          Volver al menú
        </Link>

        <div
          className={`mt-4 rounded-[2rem] border-4 bg-[var(--brand-surface-2)] p-7 text-center shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)] ${
            isReady ? "border-[var(--brand-primary)]" : "border-[var(--brand-border)]"
          }`}
        >
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">
            {BRAND.name} · Tu pedido
          </p>

          {notFound ? (
            <p className="mt-8 rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/10 px-4 py-3 text-sm font-bold leading-6 text-yellow-500">
              No encontramos este pedido. Revisa que el link esté completo o vuelve al menú para
              hacer uno nuevo.
            </p>
          ) : !status ? (
            <p className="mt-8 flex items-center justify-center gap-2 text-sm font-bold text-[var(--brand-ink-2)]/60">
              <Loader2 size={17} className="animate-spin text-[var(--brand-primary)]" />
              Buscando tu pedido…
            </p>
          ) : (
            <>
              <p className="mt-5 text-6xl font-black leading-none text-[var(--brand-ink-3)]">
                {displayNumber || "—"}
              </p>

              {isCancelled ? (
                <div className="mt-6 rounded-2xl border-2 border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-bold leading-6 text-red-300">
                  <p>Este pedido fue cancelado. Si crees que es un error, contáctanos.</p>
                  {cancelReason ? (
                    <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-[0.8rem] leading-5 text-red-200">
                      Motivo del negocio: {cancelReason}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  {/* Estado del pago ANTES que todo (lote v6): si falta
                      reportar, el CTA sale primero; si ya está pagado, el
                      cliente lo ve de una. */}
                  {needsPaymentReport ? (
                    <div className="mt-5 rounded-2xl border-[3px] border-amber-500 bg-amber-500/10 px-4 py-4 text-left">
                      <p className="text-sm font-black leading-5 text-amber-600">
                        No has reportado el pago de tu pedido.
                      </p>
                      <p className="mt-1 text-[0.8rem] font-bold leading-5 text-[var(--brand-ink-2)]/75">
                        Repórtalo aquí abajo y tu pedido se empezará a
                        procesar.
                      </p>
                      <button
                        type="button"
                        onClick={openPaymentReport}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-black transition hover:opacity-90 active:translate-y-0.5"
                      >
                        <ImagePlus size={17} />
                        Reportar mi pago
                      </button>
                    </div>
                  ) : paymentExpected && paymentConfirmed ? (
                    <p className="mt-5 rounded-2xl border-2 border-green-600 bg-green-600/15 px-4 py-3 text-sm font-black leading-5 text-green-500">
                      ✅ Pedido pagado: el local confirmó tu pago.
                    </p>
                  ) : paymentExpected && paymentReported ? (
                    <p className="mt-5 rounded-2xl border-2 border-sky-500/60 bg-sky-500/10 px-4 py-3 text-[0.85rem] font-black leading-5 text-sky-500">
                      Pago reportado: el local lo está verificando. Apenas lo
                      confirme, tu pedido avanza solo.
                    </p>
                  ) : null}

                  {/* Línea de progreso (con "Esperando pago" delante cuando
                      el pedido se paga por vía electrónica) */}
                  <div className="mt-7 flex items-center justify-center gap-2">
                    {steps.map((step, index) => {
                      const label =
                        step === "Esperando pago" && paymentConfirmed
                          ? "Pagado"
                          : step;
                      return (
                        <div key={step} className="flex items-center gap-2">
                          <div className="flex flex-col items-center gap-1.5">
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                                index <= activeStep
                                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-black"
                                  : "border-[var(--brand-border)] bg-transparent text-[var(--brand-ink-2)]/40"
                              }`}
                            >
                              {stepIcon(label)}
                            </span>
                            <span
                              className={`text-[0.6rem] font-black uppercase tracking-[0.08em] ${
                                index <= activeStep
                                  ? "text-[var(--brand-primary)]"
                                  : "text-[var(--brand-ink-2)]/40"
                              }`}
                            >
                              {label}
                            </span>
                          </div>
                          {index < steps.length - 1 ? (
                            <span
                              className={`mb-5 h-0.5 w-8 rounded-full ${
                                index < activeStep
                                  ? "bg-[var(--brand-primary)]"
                                  : "bg-[var(--brand-border)]"
                              }`}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {isReady && !isDelivered ? (
                    <p className="mt-6 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-4 text-base font-black uppercase leading-tight text-black">
                      ¡Listo! Pasa a retirarlo indicando tu número.
                    </p>
                  ) : null}

                  {isDelivered ? (
                    <div className="mt-6 space-y-4">
                      <p className="rounded-2xl border-2 border-green-600 bg-green-600/15 px-4 py-3 text-sm font-black text-green-400">
                        Pedido entregado. ¡Gracias por tu compra!
                      </p>
                      {googleReviewUrl ? (
                        <a
                          href={googleReviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-black transition hover:opacity-90"
                        >
                          <Star size={17} />
                          ¿Te gustó? Déjanos una reseña
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  {NOTIFY_READY_BUTTON_ENABLED &&
                  !isReady &&
                  !isDelivered &&
                  !notifyEnabled ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const granted = await requestNotificationPermission();
                        setNotifyEnabled(granted);
                        if (granted) void subscribeToPushForOrder(orderId);
                      }}
                      className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90"
                    >
                      <Bell size={15} />
                      Avisarme cuando esté listo
                    </button>
                  ) : null}

                  {notifyEnabled && !isReady && !isDelivered ? (
                    <p className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-green-600 bg-green-600/15 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-green-400">
                      <BellRing size={14} />
                      Te avisaremos aquí mismo
                    </p>
                  ) : null}
                </>
              )}

              {/* Qué trae el pedido: nombre, cantidad y personalización, para
                  que el cliente confirme que es SU pedido al reabrir el link. */}
              {items.length > 0 ? (
                <div className="mt-6 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-4 text-left">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                    Tu pedido trae
                  </p>
                  <div className="mt-2 space-y-2">
                    {items.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="rounded-xl bg-[var(--brand-surface-2)] px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3 text-sm font-black text-[var(--brand-ink-3)]">
                          <span>
                            {item.name} x{item.quantity}
                          </span>
                          {item.subtotalUSD > 0 ? (
                            <span className="shrink-0 text-[var(--brand-primary)]">
                              ${item.subtotalUSD.toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                        {item.selectionSummary
                          ? item.selectionSummary
                              .split(" · ")
                              .map((line) => line.trim())
                              .filter(Boolean)
                              .map((line) => (
                                <p
                                  key={line}
                                  className="mt-1 text-[0.72rem] font-bold leading-4 text-[var(--brand-ink-2)]/65"
                                >
                                  {line}
                                </p>
                              ))
                          : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="mt-6 text-[0.7rem] font-bold leading-5 text-[var(--brand-ink-2)]/50">
                Referencia: {orderId}. Guarda este link para volver cuando quieras.
              </p>
            </>
          )}
        </div>

        {/* Pagos: reportar la captura después y ver cuándo caja la confirma.
            Solo cuando el pedido existe y no está cancelado. */}
        {!notFound && status && !isCancelled ? (
          <div id="reporte-pago-seccion">
            <PublicOrderPaymentSection
              orderId={orderId}
              proofsEnabled={paymentProofsEnabled}
              autoOpenForm={needsPaymentReport}
              forceOpenSignal={openReportSignal}
            />
          </div>
        ) : null}

        {/* Camino directo al negocio con el mensaje ya armado (número y
            referencia del pedido). El dueño lo activa/apaga en Configuración. */}
        {orderHelpHref ? (
          <a
            href={orderHelpHref}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-5 py-3.5 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:opacity-85"
          >
            <MessageCircle size={17} />
            ¿Dudas con tu pedido? Escríbenos
          </a>
        ) : null}

        {/* Cancelar mi pedido: solo mientras siga en "Nuevo" (sin pago). */}
        {!notFound && status === "Nuevo" ? (
          <button
            type="button"
            onClick={() => {
              setCancelError(null);
              setIsCancelModalOpen(true);
            }}
            className="mt-3 w-full rounded-full px-5 py-3 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/45 transition hover:text-red-400"
          >
            Cancelar mi pedido
          </button>
        ) : null}

        {isCancelModalOpen ? (
          <div
            className="fixed inset-0 z-[96] flex items-end justify-center bg-black/70 px-4 py-6 backdrop-blur-sm sm:items-center"
            onClick={() => setIsCancelModalOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-[1.8rem] border-4 border-red-500 bg-[var(--brand-surface-2)] p-6 text-center shadow-2xl shadow-black/60"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-xl font-black uppercase leading-tight text-[var(--brand-ink-3)]">
                ¿Seguro que quieres cancelar?
              </p>
              <p className="mt-2 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
                Tu pedido {displayNumber || ""} se anulará y no se preparará.
              </p>

              <textarea
                value={cancelReasonInput}
                onChange={(event) => setCancelReasonInput(event.target.value)}
                rows={2}
                placeholder="¿Nos cuentas por qué? (opcional)"
                className="mt-4 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)] outline-none focus:border-red-400"
              />

              {cancelError ? (
                <p className="mt-2 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-[0.78rem] font-bold leading-4 text-red-400">
                  {cancelError}
                </p>
              ) : null}

              <button
                type="button"
                disabled={isCancelling}
                onClick={() => void submitClientCancellation()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-red-500 bg-red-500 px-5 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : null}
                Sí, cancelar mi pedido
              </button>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="mt-2 w-full rounded-full px-5 py-2.5 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60 transition hover:text-[var(--brand-ink-2)]"
              >
                No, mantener mi pedido
              </button>
            </div>
          </div>
        ) : null}

        {/* Pop-up de reseña tras la venta (pedido del dueño 2026-07-21). */}
        {isReviewPopupOpen ? (
          <div
            className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 px-4 py-6 backdrop-blur-sm sm:items-center"
            onClick={dismissReviewPopup}
          >
            <div
              className="w-full max-w-sm rounded-[1.8rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] p-6 text-center shadow-2xl shadow-black/60"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary)] text-black">
                <Star size={26} fill="currentColor" />
              </span>
              <p className="mt-4 text-xl font-black uppercase leading-tight text-[var(--brand-ink-3)]">
                ¿Cómo estuvo todo?
              </p>
              <p className="mt-2 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
                Tu opinión nos ayuda un montón. Déjanos una reseña, toma un
                minuto.
              </p>
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noreferrer"
                onClick={dismissReviewPopup}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:opacity-90"
              >
                <Star size={15} />
                Dejar mi reseña
              </a>
              <button
                type="button"
                onClick={dismissReviewPopup}
                className="mt-2 w-full rounded-full px-5 py-2.5 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/50 transition hover:text-[var(--brand-ink-2)]"
              >
                Ahora no
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
