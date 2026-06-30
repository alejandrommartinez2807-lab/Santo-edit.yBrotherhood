export type ProductPaymentMode = "divisa" | "mixto"

export type ProductType = "normal" | "variations" | "addons" | "buildable" | "combo"

export type ProductSalesChannel = "local" | "takeaway" | "delivery"

export type Product = {
  id: number
  name: string
  category: string
  description: string
  price: number
  image: string
  paymentMode: ProductPaymentMode
  isActive?: boolean
  isFeatured?: boolean
  sortOrder?: number
  productType?: ProductType
  salesChannels?: ProductSalesChannel[]
  variations?: unknown[]
  addons?: unknown[]
  includedIngredients?: unknown[]
  removableIngredients?: unknown[]
  selectionRules?: Record<string, unknown>
  preparationMinutes?: number
  requiresWaiterConfirmation?: boolean
  inventoryDiscountEnabled?: boolean
  premiumSummary?: string
  /** Tasa de IVA del producto (16 / 8 / 0 = exento). null = usa la default del negocio. */
  ivaRate?: number | null
}

export const categories = [
  "Todos",
  "Combos",
  "Perritos",
  "Salchipapas",
  "Raciones",
  "Bebidas",
]

export const products: Product[] = [
  {
    id: 1,
    name: "Combo Clásico",
    category: "Combos",
    description:
      "4 Perros Clásicos + 1 refresco de 1 litro. Pago en Zelle o efectivo.",
    price: 10,
    image: "/combo-normal.png",
    paymentMode: "divisa",
    isActive: true,
    isFeatured: true,
    sortOrder: 1,
  },
  {
    id: 2,
    name: "Combo Cachón",
    category: "Combos",
    description:
      "4 Santo Cachón + 1 refresco de 2 litros. Pago en Zelle o efectivo.",
    price: 15,
    image: "/combo-cachon.png",
    paymentMode: "divisa",
    isActive: true,
    isFeatured: true,
    sortOrder: 2,
  },
  {
    id: 3,
    name: "Clásico",
    category: "Perritos",
    description:
      "Pan, salchicha, papas, cebolla, ensalada, maíz, queso amarillo y salsas de la casa.",
    price: 3,
    image: "/perroclasico.png",
    paymentMode: "mixto",
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 4,
    name: "Santo Cachón",
    category: "Perritos",
    description:
      "Pan, doble salchicha, papas, cebolla, ensalada, maíz, tocineta, queso amarillo y salsas de la casa.",
    price: 3.5,
    image: "/Santocachon.png",
    paymentMode: "mixto",
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 5,
    name: "Santo Perrito",
    category: "Perritos",
    description:
      "Pan, salchicha, papas, cebolla, salsa de la casa al estilo ranch, salsa estrella a base de tocineta y parmesano, tocineta, queso amarillo o parmesano.",
    price: 3.5,
    image: "/Santoperrito.png",
    paymentMode: "mixto",
    isActive: true,
    isFeatured: true,
    sortOrder: 5,
  },
  {
    id: 6,
    name: "Salchipapa Sencilla",
    category: "Salchipapas",
    description: "Papas fritas, salchicha y queso cheddar fundido.",
    price: 5,
    image: "/salchipapa.png",
    paymentMode: "mixto",
    isActive: true,
    sortOrder: 6,
  },
  {
    id: 7,
    name: "Salchipapa Especial",
    category: "Salchipapas",
    description:
      "Papas fritas, salchicha, tocineta, queso cheddar y queso amarillo.",
    price: 7,
    image: "/salchipapaespecial.png",
    paymentMode: "mixto",
    isActive: true,
    sortOrder: 7,
  },
  {
    id: 8,
    name: "Nuggets de Pollo",
    category: "Raciones",
    description: "Nuggets de pollo con papas fritas.",
    price: 5,
    image: "/nuggetspollo.png",
    paymentMode: "mixto",
    isActive: true,
    sortOrder: 8,
  },
  {
    id: 9,
    name: "Ración de Papas Fritas",
    category: "Raciones",
    description:
      "Ración de papas fritas doradas y crujientes para acompañar tu pedido.",
    price: 3,
    image: "/papasfritas.png",
    paymentMode: "mixto",
    isActive: true,
    sortOrder: 9,
  },
  {
    id: 10,
    name: "Refresco Botella",
    category: "Bebidas",
    description: "Refresco frío en botella para acompañar tu pedido.",
    price: 1,
    image: "/refresco-pequeno.png",
    paymentMode: "mixto",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: 11,
    name: "Refresco 1LT",
    category: "Bebidas",
    description: "Refresco de 1 litro ideal para compartir.",
    price: 2,
    image: "/refresco1litros.png",
    paymentMode: "mixto",
    isActive: true,
    sortOrder: 11,
  },
  {
    id: 12,
    name: "Nestea",
    category: "Bebidas",
    description: "Bebida refrescante venezolana.",
    price: 3,
    image: "/nete.png",
    paymentMode: "mixto",
    isActive: true,
    sortOrder: 12,
  },
]
