// ============================================================
// Registro ÚNICO de los campos escalares "simples" de la configuración del
// negocio (identidad, apariencia y fiscal). Es la fuente de verdad para:
//   - la ruta de guardado (/api/business-config) que los acepta, y
//   - los valores por defecto (lib/orders DEFAULT_BUSINESS_CONFIG).
//
// Antes esto estaba duplicado a mano en varios sitios y se desincronizaba
// (campos que no se guardaban). Agregar un campo aquí lo propaga a ambos lados,
// y un test (businessConfigFields.test.ts) falla si falta el default.
//
// NO incluye campos con permisos por rol/plan ni estructuras complejas
// (módulos, mesas, promociones, etc.): esos siguen con su lógica dedicada.
// ============================================================

export type SimpleConfigFieldType = "string" | "number" | "boolean"

export type SimpleConfigField = {
  key: string
  type: SimpleConfigFieldType
  default: string | number | boolean
  /** Para números: rango permitido (se acota al guardar). */
  min?: number
  max?: number
}

export const SIMPLE_BUSINESS_CONFIG_FIELDS: readonly SimpleConfigField[] = [
  // Identidad
  { key: "businessName", type: "string", default: "" },
  { key: "businessShortDescription", type: "string", default: "Menú y pedidos" },
  { key: "businessType", type: "string", default: "" },
  { key: "locationLabel", type: "string", default: "Mesa" },
  { key: "mainWhatsapp", type: "string", default: "" },
  { key: "deliveryWhatsapp", type: "string", default: "" },
  // Botón público "¿Dudas con tu pedido? Escríbenos" (WhatsApp con mensaje
  // listo preguntando por los pedidos activos). El dueño lo prende o apaga.
  { key: "orderHelpWhatsappEnabled", type: "boolean", default: true },
  // Botones de aviso al cliente por WhatsApp (Confirmar/Preparación/Salida…)
  // en las tarjetas de delivery del panel privado.
  { key: "orderWhatsappStageButtonsEnabled", type: "boolean", default: true },
  // Encuesta post-venta: botón en caja/pedidos que abre WhatsApp con una
  // mini encuesta para pedidos entregados (delivery/pick up). El dueño puede
  // apagarla o escribir su propio mensaje (vacío = plantilla estándar).
  { key: "postSaleSurveyEnabled", type: "boolean", default: true },
  { key: "postSaleSurveyMessage", type: "string", default: "" },
  // Encuesta automática: enviar por WhatsApp Business (Cloud API) el link de
  // la encuesta X minutos después de marcar el pedido como Entregado.
  { key: "postSaleSurveyAutoEnabled", type: "boolean", default: false },
  { key: "postSaleSurveyDelayMinutes", type: "number", default: 40, min: 5, max: 1440 },
  // Aspectos que el cliente califica con estrellas 1–5 (separados por coma).
  {
    key: "postSaleSurveyAspects",
    type: "string",
    default: "Calidad del producto, Servicio, Ambiente",
  },
  // Alarma de anulación (toast rojo + push a dueño/encargado), apagable.
  { key: "cancellationAlertsEnabled", type: "boolean", default: true },
  // Anular SOLO con código del dueño (2026-07-21): el trabajador solicita la
  // anulación con motivo, el código de un solo uso llega únicamente al dueño
  // (push a sus equipos / su panel / WhatsApp) y sin ese código no se anula.
  // Requiere la migración 0029; sin ella degrada al flujo directo con motivo.
  { key: "cancellationApprovalRequired", type: "boolean", default: false },
  // WhatsApp PERSONAL del dueño para recibir los códigos de anulación
  // (solo se usa cuando WhatsApp Business Cloud API está conectado).
  { key: "ownerCancelNotifyWhatsapp", type: "string", default: "" },
  // Push de reposición de inventario (agotados/stock bajo) a los equipos
  // suscritos del dueño/encargado, apagable.
  { key: "inventoryRestockPushEnabled", type: "boolean", default: true },
  // Recordatorio push de cuentas por pagar: aviso X días antes del
  // vencimiento de facturas a crédito (y para vencidas), apagable.
  { key: "payablesReminderPushEnabled", type: "boolean", default: true },
  { key: "payablesReminderDaysBefore", type: "number", default: 3, min: 0, max: 60 },
  // Guía paso a paso y advertencias del checkout público (Fase avisos):
  // el dueño decide si se muestran y puede escribir su propio texto de
  // "paga antes de que tu pedido se procese".
  { key: "publicOrderStepsEnabled", type: "boolean", default: true },
  // Textos de AYUDA del checkout (tips de GPS, notas aclaratorias): el dueño
  // los apaga si le estorban. NO toca errores de validación ni avisos de pago.
  { key: "publicCheckoutHintsEnabled", type: "boolean", default: true },
  { key: "publicPrepayNoticeEnabled", type: "boolean", default: true },
  { key: "publicPrepayNoticeText", type: "string", default: "" },
  { key: "publicOpenAccountHintHighlighted", type: "boolean", default: true },
  // Flujo de pago del checkout público (pedido del dueño 2026-07-21):
  // - "antes": con métodos electrónicos (pago móvil/transferencia/Zelle...)
  //   el cliente debe adjuntar captura o referencia ANTES de registrar.
  // - apagado (default): registra primero y reporta el pago en la
  //   confirmación, con advertencia grande y recordatorios.
  { key: "publicPaymentBeforeRegisterEnabled", type: "boolean", default: false },
  // Foto obligatoria de las divisas en efectivo (pedido del dueño 2026-07-22):
  // cuando el cliente elige EFECTIVO EN DIVISAS, se le exige subir una foto de
  // los billetes antes de registrar el pedido, para que el negocio vea que
  // tiene el efectivo. Apagable.
  { key: "publicCashDivisaPhotoRequired", type: "boolean", default: false },
  // Permitir DOS capturas en el reporte de pago MIXTO (una por cada pata, ej.
  // pago móvil + Zelle). Solo aparece en mixto; apagable. Requiere la migración
  // 0030 (2ª imagen del comprobante); sin ella se ignora la segunda captura.
  { key: "publicMixedSecondProofEnabled", type: "boolean", default: true },
  // Anulación automática de pedidos SIN pago reportado tras X minutos
  // (0 = apagada). Solo aplica a Para llevar/Delivery no confirmados por caja.
  { key: "publicUnpaidAutoCancelMinutes", type: "number", default: 0, min: 0, max: 240 },
  // Selector "Delivery pagado en" del cobro de caja (pedido del dueño
  // 2026-07-23): si al negocio no le interesa registrar en qué moneda se pagó
  // el delivery, lo apaga y el selector desaparece del modal de cobro. Los
  // costos de delivery se siguen viendo en el público, reportes y cierres.
  { key: "cashierDeliveryPaymentInEnabled", type: "boolean", default: true },
  // La promoción del dueño también como ventana emergente al entrar (además
  // de la sección); se recuerda el cierre por contenido para no insistir.
  { key: "promotionPopupEnabled", type: "boolean", default: false },
  // Apariencia (tema)
  { key: "themePrimaryColor", type: "string", default: "#a00000" },
  { key: "themeAccentColor", type: "string", default: "#ffd23c" },
  { key: "themeCreamColor", type: "string", default: "#fff7e8" },
  { key: "productCardBackgroundColor", type: "string", default: "#ffffff" },
  { key: "productCardTextColor", type: "string", default: "#4a0000" },
  { key: "productCardBorderColor", type: "string", default: "#a00000" },
  { key: "productCardButtonColor", type: "string", default: "#ffd23c" },
  // Símbolo de moneda del sitio PÚBLICO: "$" o "€" (solo estético; los cálculos
  // siguen en USD y los bolívares no cambian).
  { key: "publicCurrencySymbol", type: "string", default: "$" },
  // Modo de impresión de tickets: "none" = no se imprime nada; "auto" = comanda
  // al enviar a cocina + recibo simple al marcar el pedido como Listo.
  { key: "printFlowMode", type: "string", default: "none" },
  // Fiscal (Venezuela)
  { key: "fiscalEnabled", type: "boolean", default: false },
  { key: "rifNumber", type: "string", default: "" },
  { key: "razonSocial", type: "string", default: "" },
  { key: "fiscalAddress", type: "string", default: "" },
  { key: "ivaDefaultRate", type: "number", default: 16, min: 0, max: 100 },
  { key: "pricesIncludeIva", type: "boolean", default: true },
  { key: "igtfEnabled", type: "boolean", default: true },
  { key: "igtfRate", type: "number", default: 3, min: 0, max: 100 },
] as const

function coerceNumber(value: unknown, field: SimpleConfigField): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return field.default as number
  const min = field.min ?? -Infinity
  const max = field.max ?? Infinity
  return Math.min(max, Math.max(min, n))
}

/** Lee un valor crudo y lo normaliza según el tipo del campo (para guardar). */
export function coerceSimpleConfigValue(value: unknown, field: SimpleConfigField) {
  switch (field.type) {
    case "string":
      return String(value ?? "").trim()
    case "number":
      return coerceNumber(value, field)
    case "boolean":
      // Por defecto true → solo false explícito desactiva; default false → solo true activa.
      return field.default === true ? value !== false : value === true
  }
}
