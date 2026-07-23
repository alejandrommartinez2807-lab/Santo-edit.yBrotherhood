"use client"

// Sección "Opciones avanzadas" DENTRO del editor de menú básico (lote v6
// fase B): variaciones estructuradas, adicionales con precio/categoría/máx,
// ingredientes con vínculo a inventario, combos y plantilla de hamburguesa.
// Reusa la lógica y los builders del menú avanzado (../menu-avanzado); el
// estado vive en el padre (menu/page.tsx) y se guarda con el mismo botón
// "Guardar producto". La página /local-santo/menu-avanzado quedó retirada
// como acceso aparte (redirige aquí).

import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react"
import { type ProductSalesChannel, type ProductType } from "@/data/products"
import {
  buildConfigWarnings,
  randomRowId,
  type AdvancedForm,
  type ComboItemRow,
  type InventoryOption,
  type OptionValue,
  type VariationGroup,
} from "../menu-avanzado/domain"
import {
  buildBurgerTemplateAddons,
  buildBurgerTemplateVariations,
} from "../menu-avanzado/burgerTemplate"
import {
  AddonsBuilder,
  AdvancedTextArea,
  ComboBuilder,
  IngredientsBuilder,
  VariationsBuilder,
  type ComboProductOption,
} from "../menu-avanzado/components"

export function AdvancedOptionsSection({
  form,
  onChange,
  productType,
  salesChannels,
  productOptions,
  inventoryOptions,
  isExpanded,
  onToggle,
}: {
  form: AdvancedForm
  onChange: (next: AdvancedForm) => void
  // Tipo y canales viven en el formulario básico (una sola fuente): aquí solo
  // se usan para las advertencias y para mostrar el builder de combos.
  productType: ProductType
  salesChannels: ProductSalesChannel[]
  productOptions: ComboProductOption[]
  inventoryOptions: InventoryOption[]
  isExpanded: boolean
  onToggle: () => void
}) {
  function update<K extends keyof AdvancedForm>(field: K, value: AdvancedForm[K]) {
    onChange({ ...form, [field]: value })
  }

  const warnings = buildConfigWarnings({ ...form, productType, salesChannels })

  const configuredCount =
    form.variations.reduce((total, group) => total + group.values.length, 0) +
    form.addons.length +
    form.includedIngredients.length +
    form.removableIngredients.length +
    form.comboItems.length

  // --- Plantilla de hamburguesa (proteína + custom fries + extras) ---
  function applyBurgerTemplate() {
    const hasContent = form.variations.length > 0 || form.addons.length > 0
    if (
      hasContent &&
      typeof window !== "undefined" &&
      !window.confirm(
        "Esto reemplaza las variaciones y extras actuales por la plantilla de hamburguesa (proteína, custom fries y extras). ¿Continuar?",
      )
    ) {
      return
    }

    onChange({
      ...form,
      variations: buildBurgerTemplateVariations(),
      addons: buildBurgerTemplateAddons(),
      inventoryDiscountEnabled: true,
    })
  }

  // --- Variaciones (grupos + valores) ---
  function addVariationGroup() {
    update("variations", [
      ...form.variations,
      {
        id: randomRowId("grupo"),
        name: "",
        type: "single",
        required: false,
        minSelections: 0,
        maxSelections: 1,
        values: [],
        sortOrder: form.variations.length + 1,
      },
    ])
  }

  function updateVariationGroup(index: number, patch: Partial<VariationGroup>) {
    update(
      "variations",
      form.variations.map((group, groupIndex) => {
        if (groupIndex !== index) return group
        const next = { ...group, ...patch }
        if (next.type === "single") next.maxSelections = 1
        return next
      }),
    )
  }

  function removeVariationGroup(index: number) {
    update("variations", form.variations.filter((_, groupIndex) => groupIndex !== index))
  }

  function moveVariationGroup(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= form.variations.length) return
    const next = [...form.variations]
    ;[next[index], next[target]] = [next[target], next[index]]
    update("variations", next)
  }

  function addVariationValue(groupIndex: number) {
    update(
      "variations",
      form.variations.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              values: [
                ...group.values,
                { id: randomRowId("opcion"), name: "", priceDelta: 0, isActive: true },
              ],
            }
          : group,
      ),
    )
  }

  function updateVariationValue(groupIndex: number, valueIndex: number, patch: Partial<OptionValue>) {
    update(
      "variations",
      form.variations.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              values: group.values.map((value, vIndex) =>
                vIndex === valueIndex ? { ...value, ...patch } : value,
              ),
            }
          : group,
      ),
    )
  }

  function removeVariationValue(groupIndex: number, valueIndex: number) {
    update(
      "variations",
      form.variations.map((group, index) =>
        index === groupIndex
          ? { ...group, values: group.values.filter((_, vIndex) => vIndex !== valueIndex) }
          : group,
      ),
    )
  }

  // --- Adicionales ---
  function addAddon() {
    update("addons", [
      ...form.addons,
      { id: randomRowId("adicional"), name: "", price: 0, category: "", maxQuantity: 1, isActive: true },
    ])
  }

  function updateAddon(index: number, patch: Partial<OptionValue>) {
    update(
      "addons",
      form.addons.map((addon, addonIndex) => (addonIndex === index ? { ...addon, ...patch } : addon)),
    )
  }

  function removeAddon(index: number) {
    update("addons", form.addons.filter((_, addonIndex) => addonIndex !== index))
  }

  // --- Artículos del combo ---
  function addComboItem() {
    update("comboItems", [
      ...form.comboItems,
      { id: randomRowId("combo"), name: "", productId: undefined, quantity: 1 },
    ])
  }

  function updateComboItem(index: number, patch: Partial<ComboItemRow>) {
    update(
      "comboItems",
      form.comboItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function removeComboItem(index: number) {
    update("comboItems", form.comboItems.filter((_, itemIndex) => itemIndex !== index))
  }

  // --- Ingredientes (incluidos / removibles) ---
  function addIngredient(field: "includedIngredients" | "removableIngredients") {
    const mode = field === "includedIngredients" ? "included" : "removable"
    update(field, [
      ...form[field],
      {
        id: randomRowId(mode),
        name: "",
        included: mode === "included",
        removable: mode === "removable",
        extraPrice: 0,
        inventoryItemId: null,
        inventoryUnit: "",
        inventoryQuantity: 0,
        isActive: true,
      },
    ])
  }

  function updateIngredient(
    field: "includedIngredients" | "removableIngredients",
    index: number,
    patch: Partial<OptionValue>,
  ) {
    update(
      field,
      form[field].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function removeIngredient(field: "includedIngredients" | "removableIngredients", index: number) {
    update(field, form[field].filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div id="opciones-avanzadas" className="rounded-2xl border-2 border-[var(--brand-primary)]/35 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <SlidersHorizontal size={18} className="shrink-0 text-[var(--brand-primary)]" />
          <span className="min-w-0">
            <span className="block text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              Opciones avanzadas
            </span>
            <span className="mt-0.5 block text-[0.72rem] font-bold leading-4 text-[#1a1a1a]/60">
              Variaciones con precio, extras, ingredientes con inventario y combos
              {configuredCount > 0 ? ` · ${configuredCount} opción(es) configurada(s)` : " · sin configurar"}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-[var(--brand-primary)]">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t-2 border-[var(--brand-primary)]/15 p-4">
          {/* Plantilla de hamburguesa de un clic (pedido del dueño 2026-07-22). */}
          <div className="rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/50 bg-[var(--brand-cream)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                  Plantilla de hamburguesa
                </p>
                <p className="mt-1 text-[0.72rem] font-bold leading-4 text-[var(--brand-ink-2)]/70">
                  Carga de un clic el grupo &quot;Escoge tu proteína&quot;, las custom
                  fries y los 11 extras. Luego ajustas precios o quitas lo que no
                  quieras y guardas el producto.
                </p>
              </div>
              <button
                type="button"
                onClick={applyBurgerTemplate}
                className="shrink-0 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] active:scale-95"
              >
                Cargar plantilla de hamburguesa
              </button>
            </div>
          </div>

          {productType === "combo" && (
            <ComboBuilder
              rows={form.comboItems}
              productOptions={productOptions}
              onAdd={addComboItem}
              onUpdate={updateComboItem}
              onRemove={removeComboItem}
            />
          )}

          <VariationsBuilder
            groups={form.variations}
            onAddGroup={addVariationGroup}
            onUpdateGroup={updateVariationGroup}
            onRemoveGroup={removeVariationGroup}
            onMoveGroup={moveVariationGroup}
            onAddValue={addVariationValue}
            onUpdateValue={updateVariationValue}
            onRemoveValue={removeVariationValue}
          />

          <AddonsBuilder
            addons={form.addons}
            onAdd={addAddon}
            onUpdate={updateAddon}
            onRemove={removeAddon}
          />

          <IngredientsBuilder
            title="Ingredientes incluidos"
            helper="Ingredientes base del producto. Vincúlalos a un insumo para descontar stock."
            rows={form.includedIngredients}
            inventoryOptions={inventoryOptions}
            showExtraPrice={false}
            onAdd={() => addIngredient("includedIngredients")}
            onUpdate={(index, patch) => updateIngredient("includedIngredients", index, patch)}
            onRemove={(index) => removeIngredient("includedIngredients", index)}
          />

          <IngredientsBuilder
            title="Ingredientes removibles / extras"
            helper="Lo que el cliente puede quitar o agregar. Usa precio extra si cobrar el añadido."
            rows={form.removableIngredients}
            inventoryOptions={inventoryOptions}
            showExtraPrice
            onAdd={() => addIngredient("removableIngredients")}
            onUpdate={(index, patch) => updateIngredient("removableIngredients", index, patch)}
            onRemove={(index) => removeIngredient("removableIngredients", index)}
          />

          <AdvancedTextArea
            label="Nota interna de reglas"
            value={form.internalRulesNote}
            onChange={(value) => update("internalRulesNote", value)}
            placeholder="Ej: Confirmar disponibilidad de tocineta antes de aceptar adicionales."
            helper="Esta nota queda guardada como regla interna del producto (no la ve el cliente)."
          />

          {warnings.length > 0 && (
            <div className="rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-amber)]">
                Revisión recomendada
              </p>
              <ul className="mt-2 space-y-1 text-sm font-bold leading-6 text-[#5a3700]">
                {warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
