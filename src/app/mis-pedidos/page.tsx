"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  MessageCircle,
  UtensilsCrossed,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { formatPublicUSD as formatUSD } from "@/utils/formatCurrency";
import { usePublicCurrencySymbol } from "@/hooks/usePublicCurrencySymbol";
import {
  fetchRecentOrdersLiveInfo,
  readRecentPublicOrders,
  removeRecentPublicOrders,
  type RecentOrderLiveInfo,
  type RecentPublicOrder,
} from "@/components/recentPublicOrders";
import { readPublicCustomerProfile } from "@/components/publicCustomerProfile";

// Página pública "Tus pedidos": los pedidos en curso de este dispositivo con
// su número y avance, más el botón de dudas por WhatsApp. Llega desde la
// barra superior; los pedidos entregados/cancelados salen solos de la lista.

function getStatusLabel(status: string) {
  if (status === "Preparando") return "En preparación";
  return "Recibido";
}

export default function MisPedidosPage() {
  usePublicCurrencySymbol();
  const [orders, setOrders] = useState<RecentPublicOrder[]>([]);
  const [liveInfo, setLiveInfo] = useState<Record<string, RecentOrderLiveInfo>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [helpWhatsapp, setHelpWhatsapp] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const storedOrders = readRecentPublicOrders();

      if (!cancelled) setOrders(storedOrders);

      if (storedOrders.length > 0) {
        const { live, finishedIds } =
          await fetchRecentOrdersLiveInfo(storedOrders);

        if (!cancelled) {
          setLiveInfo(live);

          if (finishedIds.length > 0) {
            removeRecentPublicOrders(finishedIds);
            setOrders(readRecentPublicOrders());
          }
        }
      }

      if (!cancelled) setIsLoading(false);
    }

    const timer = setTimeout(load, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/business-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const config = data?.businessConfig || {};

        setBusinessName(String(config.businessName || "").trim());

        if (config.orderHelpWhatsappEnabled !== false) {
          const phone = String(
            config.deliveryWhatsapp ||
              config.mainWhatsapp ||
              BRAND.whatsapp ||
              "",
          ).replace(/[^0-9]/g, "");
          setHelpWhatsapp(phone);
        }
      })
      .catch(() => {
        // Sin config la página funciona igual, solo sin botón de WhatsApp.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const helpHref = helpWhatsapp
    ? `https://wa.me/${helpWhatsapp}?text=${encodeURIComponent(
        (() => {
          const lines = [
            `Hola ${businessName || BRAND.name}! Tengo una duda sobre mi pedido.`,
          ];

          orders.slice(0, 3).forEach((order) => {
            const live = liveInfo[order.id];
            const numberLabel = live?.displayNumber
              ? `${live.displayNumber} · `
              : "";

            lines.push(
              `• ${numberLabel}${order.label || "Pedido"} · ${formatUSD(order.totalUSD)}`,
            );
          });

          if (orders.length === 0) {
            const profileName = readPublicCustomerProfile().name;
            if (profileName) lines.push(`Mi nombre: ${profileName}`);
          }

          lines.push("¿Me pueden ayudar?");

          return lines.join("\n");
        })(),
      )}`
    : "";

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

        <div className="mt-4 rounded-[2rem] border-4 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">
            {businessName || BRAND.name}
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase leading-none text-[var(--brand-ink-3)]">
            Tus pedidos
          </h1>

          <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            Aquí están los pedidos en curso que hiciste desde este teléfono.
            Toca uno para ver cómo va o enviar tu comprobante. Al entregarse,
            sale solo de la lista.
          </p>

          {isLoading ? (
            <p className="mt-6 text-sm font-bold text-[var(--brand-ink-2)]/55">
              Buscando tus pedidos…
            </p>
          ) : orders.length === 0 ? (
            <div className="mt-6 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-5 text-center">
              <ClipboardList
                size={30}
                className="mx-auto text-[var(--brand-primary)]"
              />
              <p className="mt-3 text-sm font-black text-[var(--brand-ink)]">
                No tienes pedidos en curso
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                Cuando hagas un pedido desde el menú, aparecerá aquí con su
                número y su avance.
              </p>
              <Link
                href="/#menu"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:opacity-90"
              >
                <UtensilsCrossed size={15} />
                Ver el menú
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {orders.map((order) => {
                const live = liveInfo[order.id];

                return (
                  <a
                    key={order.id}
                    href={`/pedido/${encodeURIComponent(order.id)}`}
                    className="flex items-center gap-3 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-3 py-3 transition hover:border-[var(--brand-primary)]"
                  >
                    {live?.displayNumber ? (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-sm font-black text-black">
                        {live.displayNumber}
                      </span>
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--brand-border)] text-[var(--brand-primary)]">
                        <ClipboardList size={18} />
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-black text-[var(--brand-ink)]">
                        {order.label || "Pedido"}
                      </span>
                      <span className="mt-0.5 block text-[0.66rem] font-bold text-[var(--brand-ink-2)]/55">
                        {new Date(order.createdAt).toLocaleDateString("es-VE", {
                          day: "2-digit",
                          month: "short",
                        })}{" "}
                        · {formatUSD(order.totalUSD)}
                      </span>
                      {live?.status ? (
                        <span className="mt-1 inline-flex rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em] text-orange-900">
                          {getStatusLabel(live.status)}
                        </span>
                      ) : null}
                    </span>

                    <span className="shrink-0 text-[0.66rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                      Ver →
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          {helpHref ? (
            <a
              href={helpHref}
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-5 py-3.5 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent)] hover:text-black"
            >
              <MessageCircle size={17} />
              ¿Dudas con tu pedido? Escríbenos
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
