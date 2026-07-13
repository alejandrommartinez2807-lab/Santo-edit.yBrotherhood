export type LocalPlanKey =
  | "menuDigital"
  | "basic"
  | "operational"
  | "pro"
  | "complete"

export type LocalPlanMode = "plan" | "custom"

export type LocalModuleKey =
  | "publicMenu"
  | "publicCart"
  | "publicWhatsapp"
  | "businessBasicConfig"
  | "settings"
  | "mainPanel"
  | "kitchen"
  | "sounds"
  | "cashier"
  | "delivery"
  | "history"
  | "ownerDashboard"
  | "expenses"
  | "reports"
  | "roles"
  | "advancedPublicConfig"
  | "promotions"
  | "featuredProducts"
  | "menuProducts"
  | "customers"
  | "inventory"
  | "inventoryAlerts"
  | "advancedMenu"
  | "productVariations"
  | "productAddons"
  | "productBuilder"
  | "productCombos"
  | "productAvailability"
  | "salesChannels"
  | "paymentProofs"
  | "openAccounts"
  | "tables"
  | "qrTables"
  | "reservations"
  | "rooms"
  | "hotelReservations"
  | "folio"
  | "housekeeping"
  | "rateSeasons"
  | "hotelReports"
  // Roadmap hotel/resort (Próximamente — ver docs/ROADMAP-HOTEL-COMPLETO.md)
  | "bookingEngine"
  | "guestPortal"
  | "hotelLanding"
  | "onlinePayments"
  | "guestNotifications"
  | "guestReviews"
  | "tapeChart"
  | "nightAudit"
  | "fiscalInvoicing"
  | "channelManager"
  | "advancedRates"
  | "guestCrm"
  | "groupBookings"
  | "resortServices"
  | "resortCharges"
  | "hotelPackages"
  | "waiterConfirmation"
  | "kitchenItems"
  | "tickets"
  | "splitBill"
  | "serviceChargeTips"
  | "suppliers"
  | "supplierPurchases"
  | "accountsPayable"
  | "subrecipes"
  | "auditLog"
  | "visualEditor"
  | "trainingMode"
  | "advancedReports"
  | "futureModules"
  | "branches"
  | "support"

export type LocalPlanDefinition = {
  key: LocalPlanKey
  label: string
  shortLabel: string
  description: string
  commercialFocus: string
  order: number
  includedModules: LocalModuleKey[]
}

export type LocalModuleCategory =
  | "public"
  | "operation"
  | "money"
  | "management"
  | "growth"
  | "internal"

export type LocalModuleDefinition = {
  key: LocalModuleKey
  label: string
  description: string
  category: LocalModuleCategory
  minimumPlan: LocalPlanKey | "internal"
  ownerConfigKey?: string
  visibleForOwnerSettings?: boolean
  visibleForSupport?: boolean
  routePath?: string
  comingSoon?: boolean
}

export type LocalPlanConfigLike = {
  membershipPlan?: unknown
  membershipPlanMode?: unknown
  customIncludedModules?: unknown
  customBlockedModules?: unknown
  ownerDashboardModuleEnabled?: unknown
  cashierModuleEnabled?: unknown
  kitchenModuleEnabled?: unknown
  deliveryEnabled?: unknown
  deliveryModuleEnabled?: unknown
  historyModuleEnabled?: unknown
  expensesModuleEnabled?: unknown
  promotionModuleEnabled?: unknown
  featuredProductsModuleEnabled?: unknown
  menuProductsModuleEnabled?: unknown
  customersModuleEnabled?: unknown
  inventoryModuleEnabled?: unknown
  inventoryAlertsModuleEnabled?: unknown
  advancedMenuModuleEnabled?: unknown
  productVariationsModuleEnabled?: unknown
  productAddonsModuleEnabled?: unknown
  productBuilderModuleEnabled?: unknown
  productCombosModuleEnabled?: unknown
  productAvailabilityModuleEnabled?: unknown
  salesChannelsModuleEnabled?: unknown
  paymentProofsModuleEnabled?: unknown
  openAccountsModuleEnabled?: unknown
  tablesModuleEnabled?: unknown
  qrTablesModuleEnabled?: unknown
  reservationsModuleEnabled?: unknown
  roomsModuleEnabled?: unknown
  hotelReservationsModuleEnabled?: unknown
  folioModuleEnabled?: unknown
  housekeepingModuleEnabled?: unknown
  rateSeasonsModuleEnabled?: unknown
  hotelReportsModuleEnabled?: unknown
  bookingEngineModuleEnabled?: unknown
  waiterConfirmationModuleEnabled?: unknown
  kitchenItemsModuleEnabled?: unknown
  ticketsModuleEnabled?: unknown
  splitBillModuleEnabled?: unknown
  serviceChargeTipsModuleEnabled?: unknown
  suppliersModuleEnabled?: unknown
  supplierPurchasesModuleEnabled?: unknown
  accountsPayableModuleEnabled?: unknown
  subrecipesModuleEnabled?: unknown
  auditLogModuleEnabled?: unknown
  visualEditorModuleEnabled?: unknown
  trainingModeModuleEnabled?: unknown
  branchesModuleEnabled?: unknown
  soundEnabled?: unknown
}

export type LocalModulePlanAccess = {
  moduleKey: LocalModuleKey
  label: string
  description: string
  category: LocalModuleCategory
  minimumPlan: LocalPlanKey | "internal"
  minimumPlanLabel: string
  plan: LocalPlanKey
  planLabel: string
  planMode: LocalPlanMode
  baseIncluded: boolean
  customIncluded: boolean
  customBlocked: boolean
  includedInPlan: boolean
  enabledByOwner: boolean
  effectiveEnabled: boolean
  lockedByPlan: boolean
  ownerConfigKey?: string
  routePath?: string
  comingSoon?: boolean
}

export const LOCAL_PLAN_KEYS: LocalPlanKey[] = [
  "menuDigital",
  "basic",
  "operational",
  "pro",
  "complete",
]

export const LOCAL_MODULE_KEYS: LocalModuleKey[] = [
  "publicMenu",
  "publicCart",
  "publicWhatsapp",
  "businessBasicConfig",
  "settings",
  "mainPanel",
  "kitchen",
  "sounds",
  "cashier",
  "delivery",
  "history",
  "ownerDashboard",
  "expenses",
  "reports",
  "roles",
  "advancedPublicConfig",
  "promotions",
  "featuredProducts",
  "menuProducts",
  "customers",
  "inventory",
  "inventoryAlerts",
  "advancedMenu",
  "productVariations",
  "productAddons",
  "productBuilder",
  "productCombos",
  "productAvailability",
  "salesChannels",
  "paymentProofs",
  "openAccounts",
  "tables",
  "qrTables",
  "reservations",
  "rooms",
  "hotelReservations",
  "folio",
  "housekeeping",
  "rateSeasons",
  "hotelReports",
  // Roadmap hotel/resort (Próximamente)
  "bookingEngine",
  "guestPortal",
  "hotelLanding",
  "onlinePayments",
  "guestNotifications",
  "guestReviews",
  "tapeChart",
  "nightAudit",
  "fiscalInvoicing",
  "channelManager",
  "advancedRates",
  "guestCrm",
  "groupBookings",
  "resortServices",
  "resortCharges",
  "hotelPackages",
  "waiterConfirmation",
  "kitchenItems",
  "tickets",
  "splitBill",
  "serviceChargeTips",
  "suppliers",
  "supplierPurchases",
  "accountsPayable",
  "subrecipes",
  "auditLog",
  "visualEditor",
  "trainingMode",
  "advancedReports",
  "futureModules",
  "branches",
  "support",
]

const PLAN_LABELS: Record<LocalPlanKey, string> = {
  menuDigital: "Menú Digital",
  basic: "Básico",
  operational: "Operativo",
  pro: "Pro",
  complete: "Completo",
}

export const LOCAL_PLAN_DEFINITIONS: LocalPlanDefinition[] = [
  {
    key: "menuDigital",
    label: "Plan Menú Digital",
    shortLabel: "Menú Digital",
    description:
      "Carta online con carrito, tasa de referencia y envío del pedido por WhatsApp.",
    commercialFocus:
      "Para negocios que quieren empezar a vender online sin panel operativo avanzado.",
    order: 1,
    includedModules: [
      "publicMenu",
      "publicCart",
      "publicWhatsapp",
      "businessBasicConfig",
      "settings",
    ],
  },
  {
    key: "basic",
    label: "Plan Básico",
    shortLabel: "Básico",
    description:
      "Menú digital más panel interno para organizar pedidos y cocina.",
    commercialFocus:
      "Para negocios que quieren dejar el cuaderno y ordenar la preparación.",
    order: 2,
    includedModules: [
      "publicMenu",
      "publicCart",
      "publicWhatsapp",
      "businessBasicConfig",
      "settings",
      "mainPanel",
      "kitchen",
      "sounds",
    ],
  },
  {
    key: "operational",
    label: "Plan Operativo",
    shortLabel: "Operativo",
    description:
      "Pedidos, caja, delivery, cobros reales e historial de cierres.",
    commercialFocus:
      "Para negocios que necesitan controlar la operación diaria desde un solo panel.",
    order: 3,
    includedModules: [
      "publicMenu",
      "publicCart",
      "publicWhatsapp",
      "businessBasicConfig",
      "settings",
      "mainPanel",
      "kitchen",
      "sounds",
      "cashier",
      "delivery",
      "history",
    ],
  },
  {
    key: "pro",
    label: "Plan Pro",
    shortLabel: "Pro",
    description:
      "Operación completa con gastos, resumen del dueño, reportes, roles y configuración pública avanzada.",
    commercialFocus:
      "Para dueños que quieren administrar, medir y ajustar el negocio sin depender del código.",
    order: 4,
    includedModules: [
      "publicMenu",
      "publicCart",
      "publicWhatsapp",
      "businessBasicConfig",
      "settings",
      "mainPanel",
      "kitchen",
      "sounds",
      "cashier",
      "delivery",
      "history",
      "ownerDashboard",
      "expenses",
      "reports",
      "roles",
      "advancedPublicConfig",
      "promotions",
      "featuredProducts",
      "menuProducts",
      "customers",
      "inventory",
    ],
  },
  {
    key: "complete",
    label: "Plan Completo",
    shortLabel: "Completo",
    description:
      "Sistema completo con inventario, menú avanzado y base preparada para operación premium de restaurante.",
    commercialFocus:
      "Para negocios que quieren operar, medir, personalizar y crecer con módulos avanzados activables por fases.",
    order: 5,
    includedModules: [
      "publicMenu",
      "publicCart",
      "publicWhatsapp",
      "businessBasicConfig",
      "settings",
      "mainPanel",
      "kitchen",
      "sounds",
      "cashier",
      "delivery",
      "history",
      "ownerDashboard",
      "expenses",
      "reports",
      "roles",
      "advancedPublicConfig",
      "promotions",
      "featuredProducts",
      "menuProducts",
      "customers",
      "inventory",
      "inventoryAlerts",
      "advancedMenu",
      "productVariations",
      "productAddons",
      "productBuilder",
      "productCombos",
      "productAvailability",
      "salesChannels",
      "paymentProofs",
      "openAccounts",
      "tables",
      "qrTables",
      "reservations",
      "rooms",
      "hotelReservations",
      "folio",
      "housekeeping",
      "rateSeasons",
      "hotelReports",
      "bookingEngine",
      "guestPortal",
      "hotelLanding",
      "onlinePayments",
      "guestNotifications",
      "guestReviews",
      "tapeChart",
      "nightAudit",
      "fiscalInvoicing",
      "channelManager",
      "advancedRates",
      "guestCrm",
      "groupBookings",
      "resortServices",
      "resortCharges",
      "hotelPackages",
      "waiterConfirmation",
      "kitchenItems",
      "tickets",
      "splitBill",
      "serviceChargeTips",
      "suppliers",
      "supplierPurchases",
      "accountsPayable",
      "subrecipes",
      "auditLog",
      "visualEditor",
      "trainingMode",
      "advancedReports",
      "branches",
      "futureModules",
    ],
  },
]

export const LOCAL_MODULE_DEFINITIONS: LocalModuleDefinition[] = [
  {
    key: "publicMenu",
    label: "Menú digital",
    description: "Carta pública con categorías, productos y precios visibles para el cliente.",
    category: "public",
    minimumPlan: "menuDigital",
    visibleForOwnerSettings: false,
    visibleForSupport: true,
  },
  {
    key: "publicCart",
    label: "Carrito público",
    description: "Carrito con totales, tasa de referencia y resumen del pedido.",
    category: "public",
    minimumPlan: "menuDigital",
    visibleForOwnerSettings: false,
    visibleForSupport: true,
  },
  {
    key: "publicWhatsapp",
    label: "Pedido por WhatsApp",
    description: "Envío del pedido al WhatsApp del negocio desde la página pública.",
    category: "public",
    minimumPlan: "menuDigital",
    visibleForOwnerSettings: false,
    visibleForSupport: true,
  },
  {
    key: "businessBasicConfig",
    label: "Configuración básica",
    description: "Nombre del negocio, descripción, WhatsApp y datos principales.",
    category: "public",
    minimumPlan: "menuDigital",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
  },
  {
    key: "settings",
    label: "Panel de configuración",
    description: "Acceso del dueño para ajustar el negocio dentro de lo permitido por su plan.",
    category: "management",
    minimumPlan: "menuDigital",
    visibleForOwnerSettings: false,
    visibleForSupport: true,
    routePath: "/local-santo/configuracion",
  },
  {
    key: "mainPanel",
    label: "Panel de pedidos",
    description: "Pantalla interna para revisar pedidos activos y coordinar el trabajo del local.",
    category: "operation",
    minimumPlan: "basic",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo",
  },
  {
    key: "kitchen",
    label: "Cocina",
    description: "Vista para preparar pedidos y marcarlos como listos.",
    category: "operation",
    minimumPlan: "basic",
    ownerConfigKey: "kitchenModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/cocina",
  },
  {
    key: "sounds",
    label: "Sonidos",
    description: "Avisos sonoros para nuevos pedidos y cambios importantes.",
    category: "operation",
    minimumPlan: "basic",
    ownerConfigKey: "soundEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
  },
  {
    key: "cashier",
    label: "Caja",
    description: "Confirmación de pedidos, cobros reales, métodos de pago y pagos mixtos.",
    category: "money",
    minimumPlan: "operational",
    ownerConfigKey: "cashierModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/caja",
  },
  {
    key: "delivery",
    label: "Delivery",
    description: "Flujo de delivery, zonas, WhatsApp de seguimiento y coordinación de entregas.",
    category: "operation",
    minimumPlan: "operational",
    ownerConfigKey: "deliveryModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/delivery",
  },
  {
    key: "history",
    label: "Historial de cierres",
    description: "Revisión de cierres guardados, totales cobrados y resultados del día.",
    category: "money",
    minimumPlan: "operational",
    ownerConfigKey: "historyModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/cierres",
  },
  {
    key: "ownerDashboard",
    label: "Dashboard del dueño",
    description: "Resumen de ventas, pedidos, cobros, delivery y alertas del negocio.",
    category: "management",
    minimumPlan: "pro",
    ownerConfigKey: "ownerDashboardModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/dueno",
  },
  {
    key: "expenses",
    label: "Control de gastos",
    description: "Centro de egresos del negocio: gastos del día, compras a proveedores, proveedores y alertas de inventario, con resumen por sede y consolidado.",
    category: "money",
    minimumPlan: "pro",
    ownerConfigKey: "expensesModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/control-gastos",
  },
  {
    key: "reports",
    label: "Reportes",
    description: "Lectura de resultados, productos, cobros, delivery y alertas del negocio.",
    category: "management",
    minimumPlan: "pro",
    visibleForOwnerSettings: false,
    visibleForSupport: true,
    routePath: "/local-santo/reportes",
  },
  {
    key: "roles",
    label: "Roles por trabajador",
    description: "Accesos separados para dueño, encargado, caja, cocina y delivery.",
    category: "management",
    minimumPlan: "pro",
    visibleForOwnerSettings: false,
    visibleForSupport: true,
  },
  {
    key: "advancedPublicConfig",
    label: "Configuración pública avanzada",
    description: "Edición de títulos, textos, horarios, ubicación, reseñas y secciones públicas desde el panel.",
    category: "growth",
    minimumPlan: "pro",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
  },
  {
    key: "promotions",
    label: "Promociones visibles",
    description: "Promoción editable en la página pública para impulsar ventas sin tocar código.",
    category: "growth",
    minimumPlan: "pro",
    ownerConfigKey: "promotionModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
  },
  {
    key: "featuredProducts",
    label: "Productos destacados",
    description: "Selección editable de productos o combos destacados en la página pública.",
    category: "growth",
    minimumPlan: "pro",
    ownerConfigKey: "featuredProductsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
  },
  {
    key: "menuProducts",
    label: "Productos del menú",
    description: "Permite crear y editar productos visibles en el menú público con precio, categoría, descripción e imagen.",
    category: "growth",
    minimumPlan: "pro",
    ownerConfigKey: "menuProductsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/menu",
  },
  {
    key: "customers",
    label: "Clientes frecuentes",
    description: "Historial de clientes, pedidos frecuentes y preferencias para recompra.",
    category: "growth",
    minimumPlan: "pro",
    ownerConfigKey: "customersModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/clientes",
  },
  {
    key: "inventory",
    label: "Inventario básico",
    description: "Control inicial de insumos, existencias, recetas, movimientos y alertas de reposición.",
    category: "management",
    minimumPlan: "pro",
    ownerConfigKey: "inventoryModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/inventario",
  },
  {
    key: "inventoryAlerts",
    label: "Inventario alertas",
    description: "Vista rápida de stock bajo, alertas de reposición e insumos críticos por sucursal.",
    category: "management",
    minimumPlan: "complete",
    ownerConfigKey: "inventoryAlertsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/inventario-alertas",
    comingSoon: false,
  },
  {
    key: "advancedMenu",
    label: "Menú avanzado",
    description: "Base para productos normales, variaciones, productos armables, adicionales, combos y reglas especiales sin rehacer el menú actual.",
    category: "growth",
    minimumPlan: "complete",
    ownerConfigKey: "advancedMenuModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/menu-avanzado",
    comingSoon: false,
  },
  {
    key: "productVariations",
    label: "Variaciones de producto",
    description: "Tamaños, sabores, tipos de proteína, presentaciones y precios por variación dentro del menú avanzado.",
    category: "growth",
    minimumPlan: "complete",
    ownerConfigKey: "productVariationsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/menu-avanzado",
    comingSoon: false,
  },
  {
    key: "productAddons",
    label: "Adicionales",
    description: "Extras con costo, cantidades, salsas, bebidas, acompañantes y mejoras del producto dentro del menú avanzado.",
    category: "growth",
    minimumPlan: "complete",
    ownerConfigKey: "productAddonsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/menu-avanzado",
    comingSoon: false,
  },
  {
    key: "productBuilder",
    label: "Productos armables",
    description: "Productos configurables por el cliente o mesonero con variaciones, adicionales, ingredientes incluidos y removibles.",
    category: "growth",
    minimumPlan: "complete",
    ownerConfigKey: "productBuilderModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/menu-avanzado",
    comingSoon: false,
  },
  {
    key: "productCombos",
    label: "Combos compuestos",
    description: "Combos formados por varios productos, promociones familiares y componentes seleccionables desde el menú avanzado.",
    category: "growth",
    minimumPlan: "complete",
    ownerConfigKey: "productCombosModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/menu-avanzado",
    comingSoon: false,
  },
  {
    key: "productAvailability",
    label: "Disponibilidad inteligente",
    description: "Control visible de productos activos, agotados y reglas básicas por canal desde el menú avanzado.",
    category: "growth",
    minimumPlan: "complete",
    ownerConfigKey: "productAvailabilityModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/menu-avanzado",
    comingSoon: false,
  },
  {
    key: "salesChannels",
    label: "Canales de venta",
    description: "Separación avanzada entre consumo en local, para llevar y delivery por producto del menú avanzado.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "salesChannelsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/menu-avanzado",
    comingSoon: false,
  },
  {
    key: "paymentProofs",
    label: "Comprobantes de pago",
    description: "Permite que el cliente reporte un pago con captura y que caja lo revise sin marcarlo pagado automáticamente.",
    category: "money",
    minimumPlan: "complete",
    ownerConfigKey: "paymentProofsModuleEnabled",
    routePath: "/local-santo/comprobantes",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
  },
  {
    key: "openAccounts",
    label: "Cuentas abiertas",
    description: "Base para consumo en mesa, productos agregados durante la visita y cierre/pago al final.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "openAccountsModuleEnabled",
    routePath: "/local-santo/caja",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
  },
  {
    key: "tables",
    label: "Mesas",
    description: "Mesas reales, ubicaciones, estados de ocupación, pedidos activos y cuentas abiertas asociadas.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "tablesModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/mesas",
    comingSoon: false,
  },
  {
    key: "qrTables",
    label: "QR por mesa",
    description: "Enlaces y QR imprimibles por mesa conectados al carrito público, mesas activas y cuentas abiertas.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "qrTablesModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/mesas",
    comingSoon: false,
  },
  {
    key: "reservations",
    label: "Reservas",
    description: "Reservas por sede, mesa y franja horaria, con bloqueo de la mesa reservada en el flujo del cliente.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "reservationsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/reservas",
    comingSoon: false,
  },
  {
    key: "rooms",
    label: "Habitaciones",
    description: "Catálogo de habitaciones y tipos (Individual, Doble, Suite) con tarifa base, capacidad y estado de limpieza. Base del PMS hotelero.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "roomsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/habitaciones",
    comingSoon: false,
  },
  {
    key: "hotelReservations",
    label: "Reservas del hotel",
    description: "Reservas por rango de noches: huésped, habitación, entrada/salida, tarifa y estados (pendiente → check-in → check-out) con validación de disponibilidad. Núcleo del PMS hotelero.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "hotelReservationsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/reservas-hotel",
    comingSoon: false,
  },
  {
    key: "folio",
    label: "Folio del huésped",
    description: "Cuenta de la estadía: ficha legal del huésped, check-in que publica el cargo de habitación, cargos (restaurante, extras), pagos y saldo, con check-out que cierra el folio.",
    category: "money",
    minimumPlan: "complete",
    ownerConfigKey: "folioModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/folio",
    comingSoon: false,
  },
  {
    key: "housekeeping",
    label: "Limpieza (housekeeping)",
    description: "Tablero de estado de limpieza por habitación (limpia, sucia, inspección, mantenimiento) con tareas asignables. El check-out marca la habitación como sucia y encola su limpieza automáticamente.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "housekeepingModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/housekeeping",
    comingSoon: false,
  },
  {
    key: "rateSeasons",
    label: "Tarifas por temporada",
    description: "Temporadas que ajustan la tarifa por noche de un tipo de habitación en un rango de fechas (precio fijo o factor). Al crear una reserva se sugiere automáticamente la tarifa según las fechas.",
    category: "money",
    minimumPlan: "complete",
    ownerConfigKey: "rateSeasonsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/tarifas",
    comingSoon: false,
  },
  {
    key: "hotelReports",
    label: "Reportes del hotel",
    description: "Indicadores del hotel por periodo: ocupación, tarifa media (ADR) e ingreso por habitación disponible (RevPAR), calculados desde las reservas y las habitaciones.",
    category: "money",
    minimumPlan: "complete",
    ownerConfigKey: "hotelReportsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/reportes-hotel",
    comingSoon: false,
  },
  // ----------------------------------------------------------------
  // ROADMAP HOTEL/RESORT — módulos reservados (Próximamente). Sin
  // ownerConfigKey todavía: al construir la fase se apaga comingSoon, se
  // agrega el ownerConfigKey + su cableado en businessConfig/configuracion
  // y se reemplaza la página placeholder. Ver docs/ROADMAP-HOTEL-COMPLETO.md.
  // ----------------------------------------------------------------
  {
    key: "bookingEngine",
    label: "Reservas online",
    description: "Motor de reservas público: el huésped elige fechas, ve disponibilidad y precio por temporada, y reserva. Reutiliza el cálculo de tarifas y la disponibilidad.",
    category: "growth",
    minimumPlan: "complete",
    ownerConfigKey: "bookingEngineModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/reservas-online",
    comingSoon: false,
  },
  {
    key: "guestPortal",
    label: "Portal del huésped",
    description: "El huésped ve, modifica o cancela su reserva, hace check-in online y consulta su cuenta, sin crear contraseña.",
    category: "growth",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/portal-huesped",
    comingSoon: true,
  },
  {
    key: "hotelLanding",
    label: "Página del hotel",
    description: "Landing pública del hotel: fotos, amenidades, mapa, políticas y galería por tipo de habitación.",
    category: "growth",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/pagina-hotel",
    comingSoon: true,
  },
  {
    key: "onlinePayments",
    label: "Pagos online",
    description: "Cobro de depósito o total al reservar (pago móvil, Zelle, transferencia o Stripe), conciliado con el folio.",
    category: "money",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/pagos-online",
    comingSoon: true,
  },
  {
    key: "guestNotifications",
    label: "Notificaciones",
    description: "Confirmación, recordatorio y post-estadía automáticos por email y WhatsApp.",
    category: "growth",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/notificaciones",
    comingSoon: true,
  },
  {
    key: "guestReviews",
    label: "Reseñas",
    description: "Valoración del huésped tras el check-out, con promedio y comentarios.",
    category: "growth",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/resenas",
    comingSoon: true,
  },
  {
    key: "tapeChart",
    label: "Calendario (tape chart)",
    description: "Grilla habitaciones × días con arrastrar y soltar para ver la ocupación de un vistazo.",
    category: "operation",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/calendario",
    comingSoon: true,
  },
  {
    key: "nightAudit",
    label: "Cierre de día",
    description: "Auditoría nocturna: cierra la jornada, consolida y rueda la fecha de negocio.",
    category: "money",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/cierre-dia",
    comingSoon: true,
  },
  {
    key: "fiscalInvoicing",
    label: "Facturación fiscal",
    description: "Factura legal (SENIAT/impuestos), notas de crédito y series de facturación sobre el folio.",
    category: "money",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/facturacion",
    comingSoon: true,
  },
  {
    key: "channelManager",
    label: "Canales / OTAs",
    description: "Sincroniza disponibilidad y tarifas con Booking, Expedia y Airbnb.",
    category: "growth",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/canales",
    comingSoon: true,
  },
  {
    key: "advancedRates",
    label: "Planes de tarifa",
    description: "Planes (con desayuno, no reembolsable) y restricciones (estancia mínima, cerrado a llegada) sobre las temporadas.",
    category: "money",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/planes-tarifa",
    comingSoon: true,
  },
  {
    key: "guestCrm",
    label: "CRM de huéspedes",
    description: "Histórico y preferencias del huésped, fidelización por puntos y campañas.",
    category: "growth",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/crm",
    comingSoon: true,
  },
  {
    key: "groupBookings",
    label: "Grupos y bloqueos",
    description: "Reservas de grupo (varias habitaciones, un titular) y bloqueo de habitaciones por eventos.",
    category: "operation",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/grupos",
    comingSoon: true,
  },
  {
    key: "resortServices",
    label: "Servicios y actividades",
    description: "Spa, tours, restaurante con reserva, alquiler y clases reservables con cupo y horario.",
    category: "operation",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/servicios",
    comingSoon: true,
  },
  {
    key: "resortCharges",
    label: "Cargo resort a habitación",
    description: "Cargo a la habitación desde cualquier punto del resort (bar, spa, tienda) con firma o pulsera/QR.",
    category: "money",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/cargos-resort",
    comingSoon: true,
  },
  {
    key: "hotelPackages",
    label: "Paquetes / todo incluido",
    description: "Habitación + comidas + actividades vendidas como un solo producto (base para all-inclusive).",
    category: "growth",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/paquetes",
    comingSoon: true,
  },
  {
    key: "waiterConfirmation",
    label: "Confirmación por mesonero",
    description: "Revisión del personal para productos que requieren confirmación antes de avanzar en cocina o entrega.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "waiterConfirmationModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/mesonero",
    comingSoon: false,
  },
  {
    key: "kitchenItems",
    label: "Cocina por producto",
    description: "Vista operativa para agrupar productos activos por cantidad, mesa, notas, adicionales e ingredientes removidos.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "kitchenItemsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/cocina-productos",
  },
  {
    key: "tickets",
    label: "Tickets de impresión",
    description: "Tickets de cocina, caja, delivery y cuentas abiertas para imprimir desde el navegador.",
    category: "operation",
    minimumPlan: "complete",
    ownerConfigKey: "ticketsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/tickets",
  },
  {
    key: "splitBill",
    label: "Separar cuenta",
    description: "Divide el total de una cuenta entre varias personas (partes iguales o montos personalizados) y cobra parte por parte desde el cobro de la cuenta.",
    category: "money",
    minimumPlan: "complete",
    ownerConfigKey: "splitBillModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    comingSoon: false,
  },
  {
    key: "serviceChargeTips",
    label: "Propina y servicio",
    description: "Base para propina sugerida, propina personalizada y cargo de servicio configurable.",
    category: "money",
    minimumPlan: "complete",
    ownerConfigKey: "serviceChargeTipsModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    comingSoon: true,
  },
  {
    key: "suppliers",
    label: "Proveedores",
    description: "Lista de proveedores del local con contacto y teléfono. Base para historial de compras y relación con inventario.",
    category: "management",
    minimumPlan: "complete",
    ownerConfigKey: "suppliersModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/proveedores",
    comingSoon: false,
  },
  {
    key: "supplierPurchases",
    label: "Compras",
    description: "Registro de compras a proveedores, pagos iniciales, vencimientos y relación con inventario.",
    category: "money",
    minimumPlan: "complete",
    ownerConfigKey: "supplierPurchasesModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/compras",
    comingSoon: false,
  },
  {
    key: "accountsPayable",
    label: "Cuentas por pagar",
    description: "Deudas a proveedores: lo que debes por proveedor, compras pendientes o parciales, vencidas y próximas a vencer, con abonos rápidos.",
    category: "money",
    minimumPlan: "complete",
    ownerConfigKey: "accountsPayableModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/cuentas-por-pagar",
    comingSoon: false,
  },
  {
    key: "subrecipes",
    label: "Subrecetas",
    description: "Recetas base reutilizables (carnes, mezclas, masas, salsas) hechas con insumos del inventario, con costo calculado por rendimiento.",
    category: "management",
    minimumPlan: "complete",
    ownerConfigKey: "subrecipesModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/subrecetas",
    comingSoon: false,
  },
  {
    key: "auditLog",
    label: "Auditoría de acciones",
    description: "Registro operativo básico para cambios sensibles, edición de inventario, cierres y acciones administrativas.",
    category: "management",
    routePath: "/local-santo/auditoria",
    minimumPlan: "complete",
    ownerConfigKey: "auditLogModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    comingSoon: false,
  },
  {
    key: "visualEditor",
    label: "Editor visual",
    description: "Paletas, colores, tarjetas, botones y vista previa conectada con la página pública.",
    category: "growth",
    minimumPlan: "complete",
    ownerConfigKey: "visualEditorModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/configuracion",
    comingSoon: false,
  },
  {
    key: "trainingMode",
    label: "Modo entrenamiento",
    description: "Interruptor global de práctica: mientras está activo, los pedidos nuevos son de prueba y no afectan inventario, reportes ni cierre. Ideal para entrenar personal.",
    category: "internal",
    minimumPlan: "complete",
    ownerConfigKey: "trainingModeModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    comingSoon: false,
  },
  {
    key: "advancedReports",
    label: "Reportes avanzados",
    description: "Lecturas más completas para crecimiento, comparación y análisis del negocio.",
    category: "growth",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
  },
  {
    key: "futureModules",
    label: "Módulos futuros premium",
    description: "Preparación para nuevas funciones premium sin rehacer la estructura de planes.",
    category: "growth",
    minimumPlan: "complete",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    comingSoon: true,
  },
  {
    key: "branches",
    label: "Sucursales",
    description: "Administración de sedes, configuración por sucursal y separación operativa multi-sede.",
    category: "management",
    minimumPlan: "complete",
    ownerConfigKey: "branchesModuleEnabled",
    visibleForOwnerSettings: true,
    visibleForSupport: true,
    routePath: "/local-santo/sucursales",
    comingSoon: false,
  },
  {
    key: "support",
    label: "Soporte privado",
    description: "Centro privado para revisar entrega, variables y plan del cliente.",
    category: "internal",
    minimumPlan: "internal",
    visibleForOwnerSettings: false,
    visibleForSupport: true,
    routePath: "/local-santo/soporte",
  },
]

function uniqueModules(modules: LocalModuleKey[]) {
  return Array.from(new Set(modules.filter(isKnownLocalModuleKey)))
}

export function isKnownLocalPlanKey(value: unknown): value is LocalPlanKey {
  return LOCAL_PLAN_KEYS.includes(value as LocalPlanKey)
}

export function isKnownLocalModuleKey(value: unknown): value is LocalModuleKey {
  return LOCAL_MODULE_KEYS.includes(value as LocalModuleKey)
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value

  const normalized = String(value || "").trim().toLowerCase()

  if (["true", "1", "si", "sí", "activo", "activa", "on"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

export function normalizeLocalPlanKey(value: unknown): LocalPlanKey {
  return isKnownLocalPlanKey(value) ? value : "complete"
}

export function normalizeLocalPlanMode(value: unknown): LocalPlanMode {
  return value === "custom" ? "custom" : "plan"
}

export function normalizeLocalModuleList(value: unknown): LocalModuleKey[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const cleanValue = value.trim()

          if (!cleanValue) return []

          try {
            const parsedValue = JSON.parse(cleanValue)

            return Array.isArray(parsedValue) ? parsedValue : cleanValue.split(/[;,|]/g)
          } catch {
            return cleanValue.split(/[;,|]/g)
          }
        })()
      : []

  const normalized = rawList
    .map((item) => String(item || "").trim())
    .filter(isKnownLocalModuleKey)

  return uniqueModules(normalized)
}

export function getLocalPlanDefinition(planKey: unknown) {
  const normalizedPlan = normalizeLocalPlanKey(planKey)

  return (
    LOCAL_PLAN_DEFINITIONS.find((plan) => plan.key === normalizedPlan) ||
    LOCAL_PLAN_DEFINITIONS[LOCAL_PLAN_DEFINITIONS.length - 1]
  )
}

export function getLocalModuleDefinition(moduleKey: LocalModuleKey) {
  return (
    LOCAL_MODULE_DEFINITIONS.find((moduleDefinition) => moduleDefinition.key === moduleKey) ||
    LOCAL_MODULE_DEFINITIONS[0]
  )
}

export function getPlanLabel(planKey: unknown) {
  return getLocalPlanDefinition(planKey).label
}

export function getShortPlanLabel(planKey: unknown) {
  return getLocalPlanDefinition(planKey).shortLabel
}

export function getIncludedModulesForPlan(planKey: unknown) {
  const plan = getLocalPlanDefinition(planKey)

  return uniqueModules(plan.includedModules)
}

export function getMinimumPlanLabel(planKey: LocalPlanKey | "internal") {
  if (planKey === "internal") return "Uso interno"

  return PLAN_LABELS[planKey]
}

export function getEffectiveIncludedModules(config: LocalPlanConfigLike) {
  const plan = normalizeLocalPlanKey(config.membershipPlan)
  const mode = normalizeLocalPlanMode(config.membershipPlanMode)
  const baseIncluded = getIncludedModulesForPlan(plan)

  if (mode !== "custom") {
    return baseIncluded
  }

  const customIncluded = normalizeLocalModuleList(config.customIncludedModules)
  const customBlocked = normalizeLocalModuleList(config.customBlockedModules)
  const includedSet = new Set<LocalModuleKey>(baseIncluded)

  customIncluded.forEach((moduleKey) => includedSet.add(moduleKey))
  customBlocked.forEach((moduleKey) => includedSet.delete(moduleKey))

  includedSet.add("settings")
  includedSet.add("businessBasicConfig")
  includedSet.add("publicMenu")
  includedSet.add("publicCart")
  includedSet.add("publicWhatsapp")

  return uniqueModules(Array.from(includedSet))
}

export function getModuleEnabledByOwner(
  config: LocalPlanConfigLike,
  moduleKey: LocalModuleKey
) {
  if (moduleKey === "ownerDashboard") {
    return normalizeBoolean(config.ownerDashboardModuleEnabled, true)
  }

  if (moduleKey === "cashier") {
    return normalizeBoolean(config.cashierModuleEnabled, true)
  }

  if (moduleKey === "kitchen") {
    return normalizeBoolean(config.kitchenModuleEnabled, true)
  }

  if (moduleKey === "delivery") {
    return (
      normalizeBoolean(config.deliveryEnabled, true) &&
      normalizeBoolean(config.deliveryModuleEnabled, true)
    )
  }

  if (moduleKey === "history") {
    return normalizeBoolean(config.historyModuleEnabled, true)
  }

  if (moduleKey === "expenses") {
    return normalizeBoolean(config.expensesModuleEnabled, true)
  }

  if (moduleKey === "promotions") {
    return normalizeBoolean(config.promotionModuleEnabled, true)
  }

  if (moduleKey === "featuredProducts") {
    return normalizeBoolean(config.featuredProductsModuleEnabled, true)
  }

  if (moduleKey === "menuProducts") {
    return normalizeBoolean(config.menuProductsModuleEnabled, true)
  }

  if (moduleKey === "customers") {
    return normalizeBoolean(config.customersModuleEnabled, true)
  }

  if (moduleKey === "inventory") {
    return normalizeBoolean(config.inventoryModuleEnabled, true)
  }

  if (moduleKey === "inventoryAlerts") {
    return normalizeBoolean(config.inventoryAlertsModuleEnabled, true)
  }

  if (moduleKey === "advancedMenu") {
    return normalizeBoolean(config.advancedMenuModuleEnabled, false)
  }

  if (moduleKey === "productVariations") {
    return normalizeBoolean(config.productVariationsModuleEnabled, false)
  }

  if (moduleKey === "productAddons") {
    return normalizeBoolean(config.productAddonsModuleEnabled, false)
  }

  if (moduleKey === "productBuilder") {
    return normalizeBoolean(config.productBuilderModuleEnabled, false)
  }

  if (moduleKey === "productCombos") {
    return normalizeBoolean(config.productCombosModuleEnabled, false)
  }

  if (moduleKey === "productAvailability") {
    return normalizeBoolean(config.productAvailabilityModuleEnabled, false)
  }

  if (moduleKey === "salesChannels") {
    return normalizeBoolean(config.salesChannelsModuleEnabled, false)
  }

  if (moduleKey === "paymentProofs") {
    return normalizeBoolean(config.paymentProofsModuleEnabled, false)
  }

  if (moduleKey === "openAccounts") {
    return normalizeBoolean(config.openAccountsModuleEnabled, false)
  }

  if (moduleKey === "tables") {
    return normalizeBoolean(config.tablesModuleEnabled, false)
  }

  if (moduleKey === "qrTables") {
    return normalizeBoolean(config.qrTablesModuleEnabled, false)
  }

  if (moduleKey === "reservations") {
    return normalizeBoolean(config.reservationsModuleEnabled, false)
  }

  if (moduleKey === "rooms") {
    return normalizeBoolean(config.roomsModuleEnabled, false)
  }

  if (moduleKey === "hotelReservations") {
    return normalizeBoolean(config.hotelReservationsModuleEnabled, false)
  }

  if (moduleKey === "folio") {
    return normalizeBoolean(config.folioModuleEnabled, false)
  }

  if (moduleKey === "housekeeping") {
    return normalizeBoolean(config.housekeepingModuleEnabled, false)
  }

  if (moduleKey === "rateSeasons") {
    return normalizeBoolean(config.rateSeasonsModuleEnabled, false)
  }

  if (moduleKey === "hotelReports") {
    return normalizeBoolean(config.hotelReportsModuleEnabled, false)
  }

  if (moduleKey === "bookingEngine") {
    return normalizeBoolean(config.bookingEngineModuleEnabled, false)
  }

  if (moduleKey === "waiterConfirmation") {
    return normalizeBoolean(config.waiterConfirmationModuleEnabled, false)
  }

  if (moduleKey === "kitchenItems") {
    return normalizeBoolean(config.kitchenItemsModuleEnabled, false)
  }

  if (moduleKey === "tickets") {
    return normalizeBoolean(config.ticketsModuleEnabled, false)
  }

  if (moduleKey === "splitBill") {
    return normalizeBoolean(config.splitBillModuleEnabled, false)
  }

  if (moduleKey === "serviceChargeTips") {
    return normalizeBoolean(config.serviceChargeTipsModuleEnabled, false)
  }

  if (moduleKey === "suppliers") {
    return normalizeBoolean(config.suppliersModuleEnabled, false)
  }

  if (moduleKey === "supplierPurchases") {
    return normalizeBoolean(config.supplierPurchasesModuleEnabled, false)
  }

  if (moduleKey === "accountsPayable") {
    return normalizeBoolean(config.accountsPayableModuleEnabled, false)
  }

  if (moduleKey === "subrecipes") {
    return normalizeBoolean(config.subrecipesModuleEnabled, false)
  }

  if (moduleKey === "auditLog") {
    // Default true: coincide con DEFAULT_BUSINESS_CONFIG (config del dueño). Con
    // el default en false, el interruptor se veía encendido pero el menú escondía
    // Auditoría (el negocio nunca había guardado la clave). Sigue gated por plan.
    return normalizeBoolean(config.auditLogModuleEnabled, true)
  }

  if (moduleKey === "visualEditor") {
    return normalizeBoolean(config.visualEditorModuleEnabled, false)
  }

  if (moduleKey === "trainingMode") {
    return normalizeBoolean(config.trainingModeModuleEnabled, false)
  }

  if (moduleKey === "branches") {
    return normalizeBoolean(config.branchesModuleEnabled, true)
  }

  if (moduleKey === "sounds") {
    return normalizeBoolean(config.soundEnabled, true)
  }

  return true
}

export function getModulePlanAccess(
  config: LocalPlanConfigLike,
  moduleKey: LocalModuleKey
): LocalModulePlanAccess {
  const moduleDefinition = getLocalModuleDefinition(moduleKey)
  const plan = normalizeLocalPlanKey(config.membershipPlan)
  const planMode = normalizeLocalPlanMode(config.membershipPlanMode)
  const planDefinition = getLocalPlanDefinition(plan)
  const baseIncluded = getIncludedModulesForPlan(plan).includes(moduleKey)
  const customIncluded = normalizeLocalModuleList(config.customIncludedModules).includes(moduleKey)
  const customBlocked = normalizeLocalModuleList(config.customBlockedModules).includes(moduleKey)
  const effectiveIncludedModules = getEffectiveIncludedModules(config)
  const isInternal = moduleDefinition.minimumPlan === "internal"
  const includedInPlan = isInternal ? true : effectiveIncludedModules.includes(moduleKey)
  const enabledByOwner = getModuleEnabledByOwner(config, moduleKey)

  return {
    moduleKey,
    label: moduleDefinition.label,
    description: moduleDefinition.description,
    category: moduleDefinition.category,
    minimumPlan: moduleDefinition.minimumPlan,
    minimumPlanLabel: getMinimumPlanLabel(moduleDefinition.minimumPlan),
    plan,
    planLabel: planDefinition.label,
    planMode,
    baseIncluded,
    customIncluded,
    customBlocked,
    includedInPlan,
    enabledByOwner,
    effectiveEnabled: includedInPlan && enabledByOwner,
    lockedByPlan: !includedInPlan,
    ownerConfigKey: moduleDefinition.ownerConfigKey,
    routePath: moduleDefinition.routePath,
    comingSoon: moduleDefinition.comingSoon,
  }
}

export function getVisibleOwnerSettingModules() {
  return LOCAL_MODULE_DEFINITIONS.filter(
    (moduleDefinition) => moduleDefinition.visibleForOwnerSettings
  )
}

export function getVisibleSupportModules() {
  return LOCAL_MODULE_DEFINITIONS.filter(
    (moduleDefinition) => moduleDefinition.visibleForSupport
  )
}

export function getPlanModuleMatrix(config: LocalPlanConfigLike) {
  return LOCAL_MODULE_DEFINITIONS.map((moduleDefinition) =>
    getModulePlanAccess(config, moduleDefinition.key)
  )
}
