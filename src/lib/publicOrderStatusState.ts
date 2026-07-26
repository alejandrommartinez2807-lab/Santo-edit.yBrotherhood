// Estado del pedido en vivo que sondea usePublicOrderStatus, aparte del
// componente para poder probar la regla sin DOM (vitest corre en entorno node).

export type PublicOrderItem = {
  name: string;
  quantity: number;
  selectionSummary: string;
  subtotalUSD: number;
};

// Estado del pago que viaja junto al estado del pedido (lote v6): permite
// mostrar "Esperando pago" → "Pagado" en vivo cuando caja registra el cobro.
export type PublicOrderPaymentInfo = {
  // El pedido se paga en caja (Pick up/Delivery con método elegido): la línea
  // muestra "Esperando pago" aunque el método sea efectivo.
  expected: boolean;
  // Además admite reporte con captura/referencia (solo métodos electrónicos).
  reportable: boolean;
  reported: boolean;
  confirmed: boolean;
  // USD equivalentes de la parte ELECTRÓNICA aún sin comprobante (en mixto,
  // la foto de los billetes no cubre la pata de Pago móvil/Zelle).
  pendingReportUSD: number;
};

// Lo sondeado de UN pedido concreto. `forOrderId` es la etiqueta que impide
// mostrar los datos de un pedido en la pantalla de otro.
export type PolledOrderState = {
  forOrderId: string;
  status: string;
  displayNumber: string;
  items: PublicOrderItem[];
  cancelReason: string;
  payment: PublicOrderPaymentInfo | null;
  notFound: boolean;
};

// Constante de módulo: así `items` mantiene la MISMA referencia entre renders
// mientras no haya datos. Si se creara `[]` en cada render, cualquier consumidor
// que lo use como dependencia se re-ejecutaría en bucle.
export const EMPTY_POLLED_ORDER: Omit<PolledOrderState, "forOrderId"> = {
  status: "",
  displayNumber: "",
  items: [],
  cancelReason: "",
  payment: null,
  notFound: false,
};

// Devuelve lo sondeado SOLO si pertenece al pedido que se está mirando; si no,
// el vacío.
//
// Es la regla que faltaba. El hook guardaba el estado en useState sueltos que
// NADIE limpiaba al cambiar de pedido: al hacer un pedido nuevo el efecto volvía
// a sondear, pero hasta que llegaba la primera respuesta la pantalla seguía
// mostrando lo del pedido ANTERIOR. Con la anulación automática por falta de
// pago eso salía carísimo: al pedido recién hecho le aparecía el número del
// viejo y la alerta "Pedido cancelado · Ya NO pagues este pedido"
// (reportado por el dueño 2026-07-26).
export function selectPolledOrderState(
  polled: PolledOrderState,
  orderId: string,
): PolledOrderState {
  if (polled.forOrderId === orderId) return polled;
  return { forOrderId: orderId, ...EMPTY_POLLED_ORDER };
}
