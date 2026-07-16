// Presets por tipo de negocio. Al elegir uno, se aplican valores recomendados a
// la configuración (qué módulos activar y cómo llamar a la "ubicación"). El
// dueño puede ajustar cualquier módulo individualmente después. Solo escribe las
// claves listadas; no toca el resto de la config.

export type BusinessTypePreset = {
  id: string
  label: string
  description: string
  locationLabel: string
  config: Record<string, boolean>
}

export const BUSINESS_TYPE_PRESETS: BusinessTypePreset[] = [
  {
    id: "restaurante",
    label: "Restaurante",
    description: "Mesas, cocina, cuentas por mesa y delivery.",
    locationLabel: "Mesa",
    config: {
      tablesModuleEnabled: true,
      qrTablesModuleEnabled: true,
      openAccountsModuleEnabled: true,
      kitchenModuleEnabled: true,
      deliveryModuleEnabled: true,
      waiterConfirmationModuleEnabled: true,
      cashierModuleEnabled: true,
      inventoryModuleEnabled: true,
    },
  },
  {
    id: "cafe",
    label: "Café / Cafetería",
    description: "Mesas y cuentas, sin foco en delivery.",
    locationLabel: "Mesa",
    config: {
      tablesModuleEnabled: true,
      qrTablesModuleEnabled: true,
      openAccountsModuleEnabled: true,
      kitchenModuleEnabled: true,
      deliveryModuleEnabled: false,
      waiterConfirmationModuleEnabled: false,
      cashierModuleEnabled: true,
      inventoryModuleEnabled: true,
    },
  },
  {
    id: "bar",
    label: "Bar",
    description: "Cuentas abiertas por mesa (tabs) y cocina ligera.",
    locationLabel: "Mesa",
    config: {
      tablesModuleEnabled: true,
      qrTablesModuleEnabled: true,
      openAccountsModuleEnabled: true,
      kitchenModuleEnabled: true,
      deliveryModuleEnabled: false,
      cashierModuleEnabled: true,
      inventoryModuleEnabled: true,
    },
  },
  {
    id: "comida_rapida",
    label: "Comida rápida / Para llevar",
    description: "Caja y cocina rápidas, delivery; sin mesas ni cuentas.",
    locationLabel: "Orden",
    config: {
      tablesModuleEnabled: false,
      qrTablesModuleEnabled: false,
      openAccountsModuleEnabled: false,
      waiterConfirmationModuleEnabled: false,
      kitchenModuleEnabled: true,
      deliveryModuleEnabled: true,
      cashierModuleEnabled: true,
      inventoryModuleEnabled: true,
    },
  },
  {
    id: "hotel",
    label: "Hotel / Resort",
    description: "Recepción con reservas por noche, folio, limpieza y room service.",
    locationLabel: "Habitación",
    config: {
      // PMS completo encendido
      roomsModuleEnabled: true,
      hotelReservationsModuleEnabled: true,
      folioModuleEnabled: true,
      housekeepingModuleEnabled: true,
      rateSeasonsModuleEnabled: true,
      hotelReportsModuleEnabled: true,
      bookingEngineModuleEnabled: true,
      tapeChartModuleEnabled: true,
      groupBookingsModuleEnabled: true,
      advancedRatesModuleEnabled: true,
      resortServicesModuleEnabled: true,
      resortChargesModuleEnabled: true,
      guestReviewsModuleEnabled: true,
      guestCrmModuleEnabled: true,
      hotelLandingModuleEnabled: true,
      hotelPackagesModuleEnabled: true,
      guestPortalModuleEnabled: true,
      onlinePaymentsModuleEnabled: true,
      guestNotificationsModuleEnabled: true,
      nightAuditModuleEnabled: true,
      fiscalInvoicingModuleEnabled: true,
      guestMembershipsModuleEnabled: true,
      channelManagerModuleEnabled: true,
      // Room service: caja + cocina sí; sin mesas de restaurante
      cashierModuleEnabled: true,
      kitchenModuleEnabled: true,
      openAccountsModuleEnabled: false,
      tablesModuleEnabled: false,
      qrTablesModuleEnabled: false,
      waiterConfirmationModuleEnabled: false,
      deliveryModuleEnabled: false,
      reservationsModuleEnabled: false,
      inventoryModuleEnabled: true,
    },
  },
  {
    id: "tienda",
    label: "Tienda / Retail",
    description: "Venta directa por caja con inventario; sin mesas ni cocina.",
    locationLabel: "Punto",
    config: {
      tablesModuleEnabled: false,
      qrTablesModuleEnabled: false,
      openAccountsModuleEnabled: false,
      kitchenModuleEnabled: false,
      waiterConfirmationModuleEnabled: false,
      deliveryModuleEnabled: true,
      cashierModuleEnabled: true,
      inventoryModuleEnabled: true,
    },
  },
]

export function getBusinessTypePreset(id: unknown): BusinessTypePreset | undefined {
  return BUSINESS_TYPE_PRESETS.find((p) => p.id === id)
}
