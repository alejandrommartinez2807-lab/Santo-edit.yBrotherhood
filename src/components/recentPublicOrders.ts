// Pedidos recientes del cliente guardados en SU dispositivo (localStorage):
// si cierra la página después de pedir, puede volver a entrar al seguimiento
// y reportar su pago (referencia o captura) sin pedirle el link a nadie.

export type RecentPublicOrder = {
  id: string;
  createdAt: string;
  totalUSD: number;
  label: string;
  // Métodos de pago que eligió el cliente al pedir: la página de seguimiento
  // los usa para volver a mostrar los datos de pago correctos.
  paymentMethods?: string[];
};

const STORAGE_KEY = "santo_public_recent_orders_v1";
const MAX_ORDERS = 5;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function readRecentPublicOrders(): RecentPublicOrder[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    const cutoff = Date.now() - MAX_AGE_MS;

    return parsed
      .map((entry) => {
        const record = (entry || {}) as Partial<RecentPublicOrder>;
        return {
          id: String(record.id || "").trim(),
          createdAt: String(record.createdAt || ""),
          totalUSD: Number(record.totalUSD || 0),
          label: String(record.label || "").trim(),
          paymentMethods: Array.isArray(record.paymentMethods)
            ? record.paymentMethods.map((item) => String(item || "").trim()).filter(Boolean)
            : [],
        };
      })
      .filter(
        (order) =>
          order.id &&
          Number.isFinite(Date.parse(order.createdAt)) &&
          Date.parse(order.createdAt) >= cutoff,
      )
      .slice(0, MAX_ORDERS);
  } catch {
    return [];
  }
}

// Pedidos que ya no le sirven al cliente: cuando el local los marca
// listos/entregados (o los cancela) salen de la lista.
export const RECENT_ORDER_HIDDEN_STATUSES = new Set([
  "Listo",
  "Entregado",
  "Cancelado",
]);

export type RecentOrderLiveInfo = { status: string; displayNumber: string };

// Consulta el estado en vivo de cada pedido guardado. Devuelve el avance de
// los activos (número visible + estado) y los ids ya terminados para podarlos.
// Los que fallan por red se dejan como están: mejor listar de más que perder
// el camino de vuelta al pedido.
export async function fetchRecentOrdersLiveInfo(
  orders: { id: string }[],
): Promise<{
  live: Record<string, RecentOrderLiveInfo>;
  finishedIds: string[];
}> {
  const results = await Promise.all(
    orders.map(async (order) => {
      try {
        const response = await fetch(
          `/api/public/order-status?pedido=${encodeURIComponent(order.id)}`,
          { cache: "no-store" },
        );
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.ok) return null;

        return {
          id: order.id,
          status: String(data.status || ""),
          displayNumber: String(data.displayNumber || ""),
        };
      } catch {
        return null;
      }
    }),
  );

  const live: Record<string, RecentOrderLiveInfo> = {};
  const finishedIds: string[] = [];

  for (const result of results) {
    if (!result) continue;

    if (RECENT_ORDER_HIDDEN_STATUSES.has(result.status)) {
      finishedIds.push(result.id);
    } else {
      live[result.id] = {
        status: result.status,
        displayNumber: result.displayNumber,
      };
    }
  }

  return { live, finishedIds };
}

// Cuando el local marca el pedido como listo/entregado (o lo cancela), deja
// de aparecer en "Pedidos recientes": ya no le hace falta al cliente.
export function removeRecentPublicOrders(ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;

  try {
    const next = readRecentPublicOrders().filter(
      (entry) => !ids.includes(entry.id),
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento el flujo sigue normal.
  }
}

export function saveRecentPublicOrder(order: {
  id: string;
  totalUSD: number;
  label: string;
  paymentMethods?: string[];
}) {
  if (typeof window === "undefined" || !order.id.trim()) return;

  try {
    const current = readRecentPublicOrders().filter(
      (entry) => entry.id !== order.id,
    );

    const next: RecentPublicOrder[] = [
      {
        id: order.id.trim(),
        createdAt: new Date().toISOString(),
        totalUSD: Number(order.totalUSD || 0),
        label: order.label.trim(),
        paymentMethods: order.paymentMethods || [],
      },
      ...current,
    ].slice(0, MAX_ORDERS);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento (modo incógnito estricto) el flujo sigue normal.
  }
}
