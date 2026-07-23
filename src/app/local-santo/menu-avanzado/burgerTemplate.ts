// Plantilla de hamburguesa para el editor de menú avanzado (pedido del dueño
// 2026-07-22). El botón "Cargar plantilla de hamburguesa" llena el formulario
// con esta estructura; el dueño luego edita precios/deltas o quita lo que no
// quiera (dejar el producto "normal" = borrar las variaciones/extras).
//
// Es la misma estructura que aplicó el script `brotherhood-burger-template-all.mjs`
// a las 62 burgers, pero ahora VISIBLE y editable con un clic desde el editor.

import { randomRowId, type OptionValue, type VariationGroup } from "./domain"

// Proteínas: deltas en 0 (el dueño ajusta). Grupo obligatorio de 1.
const PROTEINS = [
  "Smash patty",
  "Big patty",
  "Lil chicken",
  "Chicken crispy",
  "Veggie Patty",
]

// Custom fries: acompañante opcional (1). Precio 0 por defecto.
const CUSTOM_FRIES = ["Cheddar bacon", "Cheddar wurst", "Cheddar jalapeño"]

// Extras con costo (adicionales). Precios sugeridos de arranque; el dueño los
// ajusta en Menú avanzado.
const EXTRAS: { name: string; price: number; maxQuantity: number }[] = [
  { name: "Tocineta", price: 1.5, maxQuantity: 2 },
  { name: "Chorizo", price: 1.5, maxQuantity: 2 },
  { name: "Queso americano", price: 1, maxQuantity: 2 },
  { name: "Ensalada clásica", price: 1, maxQuantity: 1 },
  { name: "Champiñón", price: 1.5, maxQuantity: 2 },
  { name: "Pepinillos", price: 0.5, maxQuantity: 1 },
  { name: "Cebolla caramelizada", price: 1, maxQuantity: 1 },
  { name: "Cebolla asada", price: 1, maxQuantity: 1 },
  { name: "Salsa SPAY (picante medio)", price: 1, maxQuantity: 1 },
  { name: "Cheddar crema", price: 1.5, maxQuantity: 2 },
  { name: "Papas fritas", price: 3, maxQuantity: 1 },
]

function buildProteinValues(): OptionValue[] {
  return PROTEINS.map((name, index) => ({
    id: randomRowId("val"),
    name,
    priceDelta: 0,
    isActive: true,
    sortOrder: index + 1,
  }))
}

function buildCustomFriesValues(): OptionValue[] {
  return CUSTOM_FRIES.map((name, index) => ({
    id: randomRowId("val"),
    name,
    priceDelta: 0,
    isActive: true,
    sortOrder: index + 1,
  }))
}

export function buildBurgerTemplateVariations(): VariationGroup[] {
  return [
    {
      id: randomRowId("grp"),
      name: "Escoge tu proteína",
      type: "single",
      required: true,
      minSelections: 1,
      maxSelections: 1,
      values: buildProteinValues(),
      sortOrder: 1,
    },
    {
      id: randomRowId("grp"),
      name: "Custom fries (para acompañar)",
      type: "single",
      required: false,
      minSelections: 0,
      maxSelections: 1,
      values: buildCustomFriesValues(),
      sortOrder: 2,
    },
  ]
}

export function buildBurgerTemplateAddons(): OptionValue[] {
  return EXTRAS.map((extra, index) => ({
    id: randomRowId("add"),
    name: extra.name,
    price: extra.price,
    maxQuantity: extra.maxQuantity,
    isActive: true,
    sortOrder: index + 1,
  }))
}
