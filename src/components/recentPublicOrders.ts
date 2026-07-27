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
  // Cuándo ESTE dispositivo vio el pedido Listo/Entregado por primera vez:
  // desde ahí corre la hora de gracia antes de salir de "Tus pedidos".
  finishedAt?: string;
};

const STORAGE_KEY = "santo_public_recent_orders_v1";
const MAX_ORDERS = 5;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Un pedido Listo/Entregado NO sale de la lista al instante: se queda 1 hora
// por si el cliente quiere revisarlo (pedido del dueño 2026-07-26).
const FINISHED_GRACE_MS = 60 * 60 * 1000;

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
          ...(record.finishedAt ? { finishedAt: String(record.finishedAt) } : {}),
        };
      })
      .filter(
        (order) =>
          order.id &&
          Number.isFinite(Date.parse(order.createdAt)) &&
          Date.parse(order.createdAt) >= cutoff &&
          // Terminado hace más de la hora de gracia: ya no le sirve al
          // cliente ni offline — sale aunque nadie vuelva a sondear.
          !isFinishedGraceOver(order.finishedAt),
      )
      .slice(0, MAX_ORDERS);
  } catch {
    return [];
  }
}

// Cancelado sale de la lista al instante (no hay nada que revisar ahí que el
// seguimiento no diga). Listo/Entregado NO: se quedan la hora de gracia.
export const RECENT_ORDER_HIDDEN_STATUSES = new Set(["Cancelado"]);

// Estados terminales "buenos": arrancan la hora de gracia la primera vez que
// este dispositivo los ve.
const RECENT_ORDER_FINISHED_STATUSES = new Set(["Listo", "Entregado"]);

function isFinishedGraceOver(finishedAt: string | undefined): boolean {
  if (!finishedAt) return false;
  const finishedMs = Date.parse(finishedAt);
  // Marca ilegible: mejor tratarla como vencida a dejar el pedido pegado.
  if (!Number.isFinite(finishedMs)) return true;
  return Date.now() - finishedMs >= FINISHED_GRACE_MS;
}

// Estampa finishedAt = ahora en los pedidos indicados (solo si no la tienen):
// desde ahí corre la hora de gracia de "Tus pedidos".
function stampRecentOrdersFinished(ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;

  try {
    const now = new Date().toISOString();
    const next = readRecentPublicOrders().map((entry) =>
      ids.includes(entry.id) && !entry.finishedAt
        ? { ...entry, finishedAt: now }
        : entry,
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento el flujo sigue normal.
  }
}

export type RecentOrderLiveInfo = {
  status: string;
  displayNumber: string;
  // Estado del pago (lote v6): permite que "Tus pedidos en curso" avise
  // "Reporta tu pago" en vez de mostrar solo el avance de cocina.
  payment?: { reportable: boolean; reported: boolean; confirmed: boolean };
};

// Consulta el estado en vivo de cada pedido guardado. Devuelve el avance de
// los activos (número visible + estado) y los ids ya terminados para podarlos.
// Listo/Entregado siguen contando como activos durante la hora de gracia
// (con su estado a la vista); pasada la hora entran en finishedIds.
// Los que fallan por red se dejan como están: mejor listar de más que perder
// el camino de vuelta al pedido.
export async function fetchRecentOrdersLiveInfo(
  orders: { id: string; finishedAt?: string }[],
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

        // 404 = el pedido ya no existe (el local cerró el día y reinició sus
        // pedidos): sale de la lista igual que un entregado. Si se dejara,
        // los pedidos viejos se acumularían 7 días en "Pedidos recientes".
        if (response.status === 404) {
          return {
            id: order.id,
            status: "__gone__",
            displayNumber: "",
            payment: undefined,
          };
        }

        if (!response.ok || !data?.ok) return null;

        return {
          id: order.id,
          status: String(data.status || ""),
          displayNumber: String(data.displayNumber || ""),
          payment:
            data.payment && typeof data.payment === "object"
              ? {
                  reportable: data.payment.reportable === true,
                  reported: data.payment.reported === true,
                  confirmed: data.payment.confirmed === true,
                }
              : undefined,
        };
      } catch {
        return null;
      }
    }),
  );

  const live: Record<string, RecentOrderLiveInfo> = {};
  const finishedIds: string[] = [];
  const toStamp: string[] = [];
  const finishedAtById = new Map(
    orders.map((order) => [order.id, order.finishedAt]),
  );

  for (const result of results) {
    if (!result) continue;

    if (result.status === "__gone__" || RECENT_ORDER_HIDDEN_STATUSES.has(result.status)) {
      finishedIds.push(result.id);
      continue;
    }

    if (RECENT_ORDER_FINISHED_STATUSES.has(result.status)) {
      const finishedAt = finishedAtById.get(result.id);
      if (finishedAt && isFinishedGraceOver(finishedAt)) {
        finishedIds.push(result.id);
        continue;
      }
      // Primera vez que este dispositivo lo ve terminado: arranca la hora.
      if (!finishedAt) toStamp.push(result.id);
    }

    live[result.id] = {
      status: result.status,
      displayNumber: result.displayNumber,
      payment: result.payment,
    };
  }

  stampRecentOrdersFinished(toStamp);

  return { live, finishedIds };
}

// Saca de "Pedidos recientes" los que ya no le hacen falta al cliente
// (cancelados, borrados del día, o terminados con la hora de gracia vencida).
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
