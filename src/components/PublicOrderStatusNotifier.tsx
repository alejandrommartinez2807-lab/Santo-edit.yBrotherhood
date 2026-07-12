"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCircle2, Loader2 } from "lucide-react";

type PublicOrderStatus = {
  status: string;
  displayNumber: string;
};

const POLL_INTERVAL_MS = 10_000;
const FINAL_STATUSES = new Set(["Entregado", "Cancelado"]);

// Botón "Avisarme al estar listo" apagado por ahora (pedido del dueño
// 2026-07-11): la lógica de notificaciones queda intacta; poner en true para
// volver a mostrarlo aquí y en la página de seguimiento /pedido/[id].
export const NOTIFY_READY_BUTTON_ENABLED: boolean = false;

function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

// Estado del pedido en vivo (polling contra /api/public/order-status). Lo usan
// la confirmación del carrito y la página pública /pedido/[id].
export function usePublicOrderStatus(orderId: string) {
  const [status, setStatus] = useState("");
  const [displayNumber, setDisplayNumber] = useState("");
  const [notFound, setNotFound] = useState(false);

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
          setStatus(String(data.status || ""));
          setDisplayNumber(String(data.displayNumber || ""));
          setNotFound(false);
        }

        // 404/400: el pedido no existe (o el link está mal). Dejar de sondear.
        if (!cancelled && (response.status === 404 || response.status === 400)) {
          setNotFound(true);
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
  return { status, displayNumber, notFound: notFound || !orderId };
}

// Vibración + notificación del navegador la primera vez que el pedido pasa a
// "Listo". Prefiere la notificación vía service worker (funciona en Android
// aunque la pestaña esté en segundo plano); cae a Notification directa.
export function useOrderReadyAlert({
  orderId,
  status,
  displayNumber,
  notifyEnabled,
}: {
  orderId: string;
  status: string;
  displayNumber: string;
  notifyEnabled: boolean;
}) {
  const previousStatus = useRef("");
  const alreadyAnnounced = useRef(false);

  useEffect(() => {
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
      body: `Pasa a retirar tu pedido ${displayNumber || orderId} en el mostrador.`,
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
  }, [status, notifyEnabled, displayNumber, orderId]);
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
  const { status, displayNumber } = usePublicOrderStatus(orderId);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyBlocked, setNotifyBlocked] = useState(false);

  useOrderReadyAlert({ orderId, status, displayNumber, notifyEnabled });

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

    return null;
  }

  if (status === "Listo") {
    return (
      <div className="rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-4 text-center text-black">
        <CheckCircle2 size={30} className="mx-auto" />
        <p className="mt-2 text-lg font-black uppercase leading-tight">
          ¡Tu pedido {displayNumber} está listo!
        </p>
        <p className="mt-1 text-sm font-bold">Pasa a retirarlo indicando tu número.</p>
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
