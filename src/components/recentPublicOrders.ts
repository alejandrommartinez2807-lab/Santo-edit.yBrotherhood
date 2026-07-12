// Pedidos recientes del cliente guardados en SU dispositivo (localStorage):
// si cierra la página después de pedir, puede volver a entrar al seguimiento
// y reportar su pago (referencia o captura) sin pedirle el link a nadie.

export type RecentPublicOrder = {
  id: string;
  createdAt: string;
  totalUSD: number;
  label: string;
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
      },
      ...current,
    ].slice(0, MAX_ORDERS);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento (modo incógnito estricto) el flujo sigue normal.
  }
}
