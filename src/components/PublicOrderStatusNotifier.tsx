"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCircle2, Loader2 } from "lucide-react";

type PublicOrderStatus = {
  status: string;
  displayNumber: string;
};

const POLL_INTERVAL_MS = 10_000;
const FINAL_STATUSES = new Set(["Entregado", "Cancelado"]);

function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

// Seguimiento en vivo del pedido en la confirmación pública: muestra el estado
// (Preparando / ¡Listo!) mientras el cliente mantiene la página abierta y, si
// lo pide, dispara notificación del navegador + vibración al pasar a "Listo".
// El aviso con la página cerrada lo cubre el staff con el botón de WhatsApp.
export default function PublicOrderStatusNotifier({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState("");
  const [displayNumber, setDisplayNumber] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyBlocked, setNotifyBlocked] = useState(false);
  const previousStatus = useRef("");
  const alreadyAnnounced = useRef(false);

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

    if (notifyEnabled && canUseNotifications() && Notification.permission === "granted") {
      try {
        new Notification("¡Tu pedido está listo!", {
          body: `Pasa a retirar tu pedido ${displayNumber || orderId} en el mostrador.`,
          icon: "/icon-192.png",
        });
      } catch {
        // Algunos navegadores móviles bloquean Notification directa; el banner cubre.
      }
    }
  }, [status, notifyEnabled, displayNumber, orderId]);

  async function enableNotifications() {
    if (!canUseNotifications()) {
      setNotifyBlocked(true);
      return;
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        setNotifyEnabled(true);
        setNotifyBlocked(false);
      } else {
        setNotifyBlocked(true);
      }
    } catch {
      setNotifyBlocked(true);
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

        {notifyEnabled ? (
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
        )}
      </div>

      <p className="mt-2 text-[0.7rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
        Mantén esta página abierta para ver tu pedido avanzar.
        {notifyBlocked ? " Tu navegador bloqueó las notificaciones; igual verás el aviso aquí." : ""}
      </p>
    </div>
  );
}
