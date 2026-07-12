"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellRing,
  CheckCircle2,
  CookingPot,
  Loader2,
  MessageCircle,
  Star,
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

const STEPS = ["Recibido", "Preparando", "Listo"] as const;

function stepIndexForStatus(status: string) {
  if (status === "Preparando") return 1;
  if (status === "Listo" || status === "Entregado") return 2;
  return 0;
}

export default function PedidoSeguimientoPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId: rawOrderId } = use(params);
  const orderId = decodeURIComponent(String(rawOrderId || "")).trim().toLowerCase();
  const { status, displayNumber, notFound } = usePublicOrderStatus(orderId);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  // WhatsApp del negocio para el botón "¿Dudas con tu pedido? Escríbenos"
  // (el dueño lo activa/apaga desde Configuración).
  const [orderHelpWhatsapp, setOrderHelpWhatsapp] = useState("");
  const [businessName, setBusinessName] = useState("");

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
          `Ref: ${orderId}`,
          "¿Me pueden ayudar?",
        ].join("\n"),
      )}`
    : "";

  const isReady = status === "Listo";
  const isDelivered = status === "Entregado";
  const isCancelled = status === "Cancelado";
  const activeStep = stepIndexForStatus(status);

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
                <p className="mt-6 rounded-2xl border-2 border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-bold leading-6 text-red-300">
                  Este pedido fue cancelado. Si crees que es un error, contáctanos.
                </p>
              ) : (
                <>
                  {/* Línea de progreso Recibido → Preparando → Listo */}
                  <div className="mt-7 flex items-center justify-center gap-2">
                    {STEPS.map((step, index) => (
                      <div key={step} className="flex items-center gap-2">
                        <div className="flex flex-col items-center gap-1.5">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                              index <= activeStep
                                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-black"
                                : "border-[var(--brand-border)] bg-transparent text-[var(--brand-ink-2)]/40"
                            }`}
                          >
                            {index === 0 ? (
                              <CheckCircle2 size={17} />
                            ) : index === 1 ? (
                              <CookingPot size={17} />
                            ) : (
                              <BellRing size={17} />
                            )}
                          </span>
                          <span
                            className={`text-[0.6rem] font-black uppercase tracking-[0.08em] ${
                              index <= activeStep
                                ? "text-[var(--brand-primary)]"
                                : "text-[var(--brand-ink-2)]/40"
                            }`}
                          >
                            {step}
                          </span>
                        </div>
                        {index < STEPS.length - 1 ? (
                          <span
                            className={`mb-5 h-0.5 w-8 rounded-full ${
                              index < activeStep
                                ? "bg-[var(--brand-primary)]"
                                : "bg-[var(--brand-border)]"
                            }`}
                          />
                        ) : null}
                      </div>
                    ))}
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

              <p className="mt-6 text-[0.7rem] font-bold leading-5 text-[var(--brand-ink-2)]/50">
                Referencia: {orderId}. Guarda este link para volver cuando quieras.
              </p>
            </>
          )}
        </div>

        {/* Pagos: reportar la captura después y ver cuándo caja la confirma.
            Solo cuando el pedido existe y no está cancelado. */}
        {!notFound && status && !isCancelled ? (
          <PublicOrderPaymentSection orderId={orderId} />
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
      </section>
    </main>
  );
}
