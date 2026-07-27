"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCircle2, Loader2 } from "lucide-react";

// Los tipos y la regla de "esto pertenece a ESTE pedido" viven en el lib para
// poder probarlos sin DOM. Se re-exportan para no cambiar los importadores.
import {
  EMPTY_POLLED_ORDER,
  selectPolledOrderState,
  type PolledOrderState,
  type PublicOrderItem,
  type PublicOrderPaymentInfo,
} from "@/lib/publicOrderStatusState";

export type { PublicOrderItem, PublicOrderPaymentInfo };

type PublicOrderStatus = {
  status: string;
  displayNumber: string;
  orderType?: string;
  items: PublicOrderItem[];
  cancelReason?: string;
  payment?: PublicOrderPaymentInfo;
};

const POLL_INTERVAL_MS = 10_000;
const FINAL_STATUSES = new Set(["Entregado", "Cancelado"]);


// Botón de avisos reactivado (pedido del dueño 2026-07-23): el cliente que
// lo toca recibe push en cada hito del pedido (entró a cocina, pagado, listo,
// entregado). En iPhone solo funciona con la app instalada en pantalla de
// inicio (limitación de iOS); si el navegador no soporta Notification, el
// botón no aparece y el seguimiento sigue por polling.
export const NOTIFY_READY_BUTTON_ENABLED: boolean = true;

function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

// Estado del pedido en vivo (polling contra /api/public/order-status). Lo usan
// la confirmación del carrito y la página pública /pedido/[id].
export function usePublicOrderStatus(orderId: string) {
  // Todo el estado sondeado va junto y ETIQUETADO con el pedido al que
  // pertenece. Antes eran useState sueltos que NADIE limpiaba al cambiar de
  // pedido: el efecto volvía a sondear, pero hasta que llegaba la primera
  // respuesta la pantalla seguía mostrando lo del pedido ANTERIOR. Con la
  // anulación automática eso salía carísimo — al pedido recién hecho le
  // aparecía el número del viejo y la alerta roja de "Pedido cancelado / Ya NO
  // pagues este pedido" (dueño 2026-07-26). Derivándolo es imposible pintar
  // datos de otro pedido, y sin setState dentro del efecto.
  const [polled, setPolled] = useState<PolledOrderState>({
    forOrderId: "",
    ...EMPTY_POLLED_ORDER,
  });

  const { status, displayNumber, orderType, items, cancelReason, payment, notFound } =
    selectPolledOrderState(polled, orderId);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const response = await fetch(
          `/api/public/order-status?pedido=${encodeURIComponent(orderId)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as Partial<PublicOrderStatus> & { ok?: boolean };

        if (!cancelled && response.ok && data.ok) {
          setPolled({
            // Etiquetado con el pedido de ESTA consulta: si el id ya cambió, el
            // valor derivado lo descarta en vez de pintarlo sobre el nuevo.
            forOrderId: orderId,
            status: String(data.status || ""),
            displayNumber: String(data.displayNumber || ""),
            orderType: String(data.orderType || ""),
            items: Array.isArray(data.items) ? data.items : [],
            cancelReason: String(data.cancelReason || ""),
            payment:
              data.payment && typeof data.payment === "object"
                ? {
                    // Respuestas viejas (sin "expected") degradan a reportable.
                    expected:
                      data.payment.expected === true ||
                      data.payment.reportable === true,
                    reportable: data.payment.reportable === true,
                    reported: data.payment.reported === true,
                    confirmed: data.payment.confirmed === true,
                    pendingReportUSD: Number(data.payment.pendingReportUSD || 0),
                  }
                : null,
            notFound: false,
          });
        }

        // 404/400: el pedido no existe (o el link está mal). Dejar de sondear.
        if (!cancelled && (response.status === 404 || response.status === 400)) {
          setPolled({
            forOrderId: orderId,
            ...EMPTY_POLLED_ORDER,
            notFound: true,
          });
          return;
        }
      } catch {
        // Silencioso: la confirmación sigue siendo válida sin seguimiento.
      }

      if (!cancelled) {
        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId]);

  // Sin id de pedido no hay nada que sondear: cuenta como "no encontrado"
  // derivado, sin setState síncrono dentro del efecto.
  return {
    status,
    displayNumber,
    orderType,
    items,
    cancelReason,
    payment,
    notFound: notFound || !orderId,
  };
}

// Vibración + notificación del navegador la primera vez que el pedido pasa a
// "Listo". Prefiere la notificación vía service worker (funciona en Android
// aunque la pestaña esté en segundo plano); cae a Notification directa.
export function useOrderReadyAlert({
  orderId,
  status,
  displayNumber,
  notifyEnabled,
  isDelivery = false,
}: {
  orderId: string;
  status: string;
  displayNumber: string;
  notifyEnabled: boolean;
  // Delivery: el cliente NO pasa a retirar — el aviso dice que el delivery
  // se comunicará con él para entregarlo.
  isDelivery?: boolean;
}) {
  const previousStatus = useRef("");
  const alreadyAnnounced = useRef(false);
  // A qué pedido pertenece la memoria de los dos refs de arriba.
  const memoryForOrder = useRef("");

  useEffect(() => {
    // Cambió el pedido: la memoria de "ya avisé" es POR pedido. Sin esto, el
    // segundo pedido de la misma sesión NO vibraba al quedar listo (el primero
    // ya había gastado alreadyAnnounced), y arrastraba el "Cancelado" del
    // anterior como estado previo (2026-07-26).
    if (memoryForOrder.current !== orderId) {
      memoryForOrder.current = orderId;
      previousStatus.current = "";
      alreadyAnnounced.current = false;
    }

    // Cancelación: vibración + notificación (si el cliente activó avisos)
    // la primera vez que el pedido pasa a "Cancelado".
    if (status === "Cancelado" && previousStatus.current !== "Cancelado") {
      previousStatus.current = status;

      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([300, 120, 300]);
        }
      } catch {
        // vibrate puede no estar disponible; el banner visual ya avisa.
      }

      if (notifyEnabled && canUseNotifications() && Notification.permission === "granted") {
        const cancelTitle = "Tu pedido fue cancelado";
        const cancelOptions = {
          body: `El pedido ${displayNumber || orderId} fue cancelado por el negocio. Abre el seguimiento para ver el motivo.`,
          icon: "/icon-192.png",
        };

        navigator.serviceWorker?.ready
          .then((registration) => registration.showNotification(cancelTitle, cancelOptions))
          .catch(() => {
            try {
              new Notification(cancelTitle, cancelOptions);
            } catch {
              // El banner visual del seguimiento cubre el aviso.
            }
          });
      }
      return;
    }

    if (status !== "Listo" || previousStatus.current === "Listo") {
      previousStatus.current = status;
      return;
    }

    previousStatus.current = status;

    if (alreadyAnnounced.current) return;
    alreadyAnnounced.current = true;

    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {
      // vibrate puede no estar disponible; el banner visual ya avisa.
    }

    if (!notifyEnabled || !canUseNotifications() || Notification.permission !== "granted") {
      return;
    }

    const title = "¡Tu pedido está listo!";
    const options = {
      body: isDelivery
        ? `Tu pedido ${displayNumber || orderId} está listo. El delivery se comunicará con usted para entregarlo.`
        : `Pasa a retirar tu pedido ${displayNumber || orderId} en el mostrador.`,
      icon: "/icon-192.png",
    };

    navigator.serviceWorker?.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(() => {
        try {
          new Notification(title, options);
        } catch {
          // Algunos navegadores móviles bloquean Notification directa; el banner cubre.
        }
      });
  }, [status, notifyEnabled, displayNumber, orderId, isDelivery]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!canUseNotifications()) return false;

  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Suscripción web push para el aviso "listo" de este pedido: funciona con la
// página cerrada y el teléfono bloqueado (requiere claves VAPID en el servidor
// y la migración 0023). Si algo falla devuelve false y queda el polling.
export async function subscribeToPushForOrder(orderId: string): Promise<boolean> {
  try {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      typeof window === "undefined" ||
      !("PushManager" in window)
    ) {
      return false;
    }

    const keyResponse = await fetch("/api/public/push", { cache: "no-store" });
    const keyData = await keyResponse.json().catch(() => ({}));

    if (!keyResponse.ok || !keyData?.enabled || !keyData.publicKey) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(String(keyData.publicKey)),
      }));

    const saveResponse = await fetch("/api/public/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, subscription: subscription.toJSON() }),
    });

    return saveResponse.ok;
  } catch {
    return false;
  }
}

// Seguimiento en vivo del pedido en la confirmación pública: muestra el estado
// (Preparando / ¡Listo!) mientras el cliente mantiene la página abierta y, si
// lo pide, dispara notificación del navegador + vibración al pasar a "Listo".
// El aviso con la página cerrada lo cubre el staff con el botón de WhatsApp.
export default function PublicOrderStatusNotifier({ orderId }: { orderId: string }) {
  const { status, displayNumber, orderType, cancelReason } = usePublicOrderStatus(orderId);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyBlocked, setNotifyBlocked] = useState(false);
  const isDeliveryOrder = orderType === "Delivery";

  useOrderReadyAlert({
    orderId,
    status,
    displayNumber,
    notifyEnabled,
    isDelivery: isDeliveryOrder,
  });

  async function enableNotifications() {
    const granted = await requestNotificationPermission();

    setNotifyEnabled(granted);
    setNotifyBlocked(!granted);

    if (granted) {
      // Mejor esfuerzo: con push el aviso llega incluso con la página cerrada.
      void subscribeToPushForOrder(orderId);
    }
  }

  if (status && FINAL_STATUSES.has(status)) {
    if (status === "Entregado") {
      return (
        <div className="rounded-2xl border-2 border-green-600 bg-green-600/15 px-4 py-3 text-center text-sm font-black text-green-400">
          Pedido entregado. ¡Gracias por tu compra!
        </div>
      );
    }

    // Cancelado: el cliente se entera aquí mismo, con el motivo si existe.
    return (
      <div className="rounded-2xl border-2 border-red-500/60 bg-red-500/10 px-4 py-3 text-center">
        <p className="text-sm font-black leading-5 text-red-400">
          Tu pedido {displayNumber || ""} fue cancelado por el negocio.
        </p>
        {cancelReason ? (
          <p className="mt-1 text-[0.75rem] font-bold leading-4 text-red-300/80">
            Motivo: {cancelReason}
          </p>
        ) : null}
        <p className="mt-1 text-[0.7rem] font-bold text-red-300/60">
          Si crees que es un error, escríbenos por WhatsApp.
        </p>
      </div>
    );
  }

  if (status === "Listo") {
    return (
      <div className="rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-4 text-center text-black">
        <CheckCircle2 size={30} className="mx-auto" />
        <p className="mt-2 text-lg font-black uppercase leading-tight">
          ¡Tu pedido {displayNumber} está listo!
        </p>
        <p className="mt-1 text-sm font-bold">
          {isDeliveryOrder
            ? "El delivery se comunicará con usted para entregarlo."
            : "Pasa a retirarlo indicando tu número."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-left">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
            Estado del pedido{displayNumber ? ` ${displayNumber}` : ""}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[var(--brand-ink-2)]/80">
            {status ? (
              status === "Preparando" ? (
                <>
                  <Loader2 size={15} className="animate-spin text-[var(--brand-primary)]" />
                  En preparación…
                </>
              ) : (
                "Recibido, en espera de cocina"
              )
            ) : (
              <>
                <Loader2 size={15} className="animate-spin text-[var(--brand-primary)]" />
                Consultando estado…
              </>
            )}
          </p>
        </div>

        {NOTIFY_READY_BUTTON_ENABLED ? (
          notifyEnabled ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-green-600 bg-green-600/15 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-green-400">
              <BellRing size={13} />
              Aviso activo
            </span>
          ) : (
            <button
              type="button"
              onClick={enableNotifications}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90"
            >
              <Bell size={13} />
              Avisarme al estar listo
            </button>
          )
        ) : null}
      </div>

      <p className="mt-2 text-[0.7rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
        Mantén esta página abierta para ver tu pedido avanzar.
        {notifyBlocked ? " Tu navegador bloqueó las notificaciones; igual verás el aviso aquí." : ""}
      </p>

      <a
        href={`/pedido/${encodeURIComponent(orderId)}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-[0.7rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] underline underline-offset-2"
      >
        Abrir mi página de seguimiento
      </a>
    </div>
  );
}
