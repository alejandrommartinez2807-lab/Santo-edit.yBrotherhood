// Inventario ESPERADO independiente: stock teórico por insumo/sede calculado
// desde el guion (cargas + compras − consumos por receta + devoluciones
// válidas). Al final de cada día se compara contra inventory_items real.
import { readJson, writeJson } from "./evidence-writer.mjs"

const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000

export function loadInventoryBook() {
  return readJson("inventario-esperado.json") || { items: {} }
}

export function saveInventoryBook(book) {
  writeJson("inventario-esperado.json", book)
}

function keyOf(branchId, itemId) {
  return `${branchId}:${itemId}`
}

export function initItem(book, { branchId, itemId, name, unit, quantity }) {
  book.items[keyOf(branchId, itemId)] = {
    name,
    unit,
    branchId,
    itemId,
    expected: round3(quantity),
    movements: [{ type: "Carga inicial", qty: quantity }],
  }
}

export function applyMove(book, { branchId, itemId, type, qty }) {
  const item = book.items[keyOf(branchId, itemId)]
  if (!item) throw new Error(`inventario esperado: insumo desconocido ${itemId} en ${branchId}`)
  item.expected = round3(item.expected + qty)
  item.movements.push({ type, qty: round3(qty) })
}

// Consumo por receta: recipes = { productId → [{itemId, quantity}] }
export function consumeRecipe(book, { branchId, recipes, productId, count }) {
  const ingredients = recipes[productId] || []
  for (const ing of ingredients) {
    applyMove(book, { branchId, itemId: ing.itemId, type: "Consumo", qty: -ing.quantity * count })
  }
}

export function returnRecipe(book, { branchId, recipes, productId, count }) {
  const ingredients = recipes[productId] || []
  for (const ing of ingredients) {
    applyMove(book, { branchId, itemId: ing.itemId, type: "Devolución", qty: ing.quantity * count })
  }
}

export function expectedOf(book, branchId, itemId) {
  return book.items[keyOf(branchId, itemId)]?.expected
}

export { round3 }
