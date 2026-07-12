"use client"

// Componentes visuales del editor de menú avanzado. Reciben todo por props;
// el estado y las llamadas al servidor viven en page.tsx.

import { type ReactNode } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import {
  numberFromInput,
  type ComboItemRow,
  type InventoryOption,
  type OptionValue,
  type VariationGroup,
} from "./domain"

export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] p-3 text-[var(--brand-primary)]">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black leading-tight">{value}</p>
    </div>
  )
}

export function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: "text" | "decimal" | "numeric"
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
      />
    </div>
  )
}

export function AdvancedTextArea({
  label,
  value,
  onChange,
  placeholder,
  helper,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helper?: string
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={7}
        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold leading-6 text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
      />
      {helper && (
        <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/58">
          {helper}
        </p>
      )}
    </div>
  )
}

export function ToggleCard({
  title,
  description,
  checked,
  onChange,
  activeLabel,
  inactiveLabel,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  activeLabel: string
  inactiveLabel: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`group flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.99] ${
        checked
          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_3px_0_rgba(var(--brand-primary-rgb),0.10)]"
          : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:border-[var(--brand-primary)] hover:bg-yellow-50"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-xs font-black uppercase leading-tight tracking-[0.13em]">
          {title}
        </span>
        <span className="mt-1 block text-xs font-bold leading-5 text-[var(--brand-ink-2)]/58">
          {description}
        </span>
      </span>

      <span
        className={`inline-flex h-8 shrink-0 items-center rounded-xl border-2 px-3 text-[0.58rem] font-black uppercase tracking-[0.09em] ${
          checked
            ? "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]"
            : "border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] text-[var(--brand-primary)]/65"
        }`}
      >
        {checked ? activeLabel : inactiveLabel}
      </span>
    </button>
  )
}

const ROW_INPUT_CLASS =
  "w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/40 focus:border-[var(--brand-primary)]"

const SECTION_CLASS =
  "rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4"

function SectionHeader({
  title,
  helper,
  onAdd,
  addLabel,
}: {
  title: string
  helper?: string
  onAdd: () => void
  addLabel: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          {title}
        </p>
        {helper && (
          <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/58">{helper}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink)]"
      >
        <Plus size={14} />
        {addLabel}
      </button>
    </div>
  )
}

function IconButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[var(--brand-primary)]/30 bg-white text-[var(--brand-primary)] disabled:opacity-35"
    >
      {children}
    </button>
  )
}

export function VariationsBuilder({
  groups,
  onAddGroup,
  onUpdateGroup,
  onRemoveGroup,
  onMoveGroup,
  onAddValue,
  onUpdateValue,
  onRemoveValue,
}: {
  groups: VariationGroup[]
  onAddGroup: () => void
  onUpdateGroup: (index: number, patch: Partial<VariationGroup>) => void
  onRemoveGroup: (index: number) => void
  onMoveGroup: (index: number, direction: -1 | 1) => void
  onAddValue: (groupIndex: number) => void
  onUpdateValue: (groupIndex: number, valueIndex: number, patch: Partial<OptionValue>) => void
  onRemoveValue: (groupIndex: number, valueIndex: number) => void
}) {
  return (
    <div className={SECTION_CLASS}>
      <SectionHeader
        title="Variaciones"
        helper="Grupos de opciones (tamaño, proteína…). Define si es de selección única o múltiple, si es obligatorio y su ajuste de precio."
        onAdd={onAddGroup}
        addLabel="Agregar grupo"
      />

      {groups.length === 0 && (
        <p className="mt-3 text-sm font-bold text-[var(--brand-ink-2)]/55">
          Sin grupos de variación. Agrega uno para ofrecer opciones al cliente.
        </p>
      )}

      <div className="mt-3 space-y-4">
        {groups.map((group, groupIndex) => (
          <div key={group.id || groupIndex} className="rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={group.name}
                onChange={(event) => onUpdateGroup(groupIndex, { name: event.target.value })}
                placeholder="Nombre del grupo (ej: Tamaño)"
                className={`${ROW_INPUT_CLASS} flex-1 min-w-[160px]`}
              />
              <IconButton onClick={() => onMoveGroup(groupIndex, -1)} label="Subir grupo" disabled={groupIndex === 0}>
                <ChevronUp size={16} />
              </IconButton>
              <IconButton onClick={() => onMoveGroup(groupIndex, 1)} label="Bajar grupo" disabled={groupIndex === groups.length - 1}>
                <ChevronDown size={16} />
              </IconButton>
              <IconButton onClick={() => onRemoveGroup(groupIndex)} label="Eliminar grupo">
                <Trash2 size={16} />
              </IconButton>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-xl border-2 border-[var(--brand-primary)]/25">
                {(["single", "multiple"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onUpdateGroup(groupIndex, { type })}
                    className={`px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] ${
                      group.type === type
                        ? "bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                        : "bg-white text-[var(--brand-primary)]"
                    }`}
                  >
                    {type === "single" ? "Única" : "Múltiple"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onUpdateGroup(groupIndex, { required: !group.required })}
                className={`rounded-xl border-2 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] ${
                  group.required
                    ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                    : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)]"
                }`}
              >
                {group.required ? "Obligatorio" : "Opcional"}
              </button>

              {group.type === "multiple" && (
                <label className="inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                  Máx
                  <input
                    value={group.maxSelections ? String(group.maxSelections) : ""}
                    onChange={(event) =>
                      onUpdateGroup(groupIndex, { maxSelections: Math.round(numberFromInput(event.target.value)) })
                    }
                    inputMode="numeric"
                    placeholder="0"
                    className={`${ROW_INPUT_CLASS} w-16`}
                  />
                </label>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {group.values.map((value, valueIndex) => (
                <div key={value.id || valueIndex} className="flex flex-wrap items-center gap-2">
                  <input
                    value={value.name}
                    onChange={(event) => onUpdateValue(groupIndex, valueIndex, { name: event.target.value })}
                    placeholder="Opción (ej: Grande)"
                    className={`${ROW_INPUT_CLASS} flex-1 min-w-[140px]`}
                  />
                  <label className="inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                    ± USD
                    <input
                      value={value.priceDelta ? String(value.priceDelta) : ""}
                      onChange={(event) =>
                        onUpdateValue(groupIndex, valueIndex, { priceDelta: numberFromInput(event.target.value) })
                      }
                      inputMode="decimal"
                      placeholder="0"
                      className={`${ROW_INPUT_CLASS} w-20`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onUpdateValue(groupIndex, valueIndex, { isActive: value.isActive === false })}
                    className={`rounded-lg border-2 px-2 py-1.5 text-[0.55rem] font-black uppercase tracking-[0.08em] ${
                      value.isActive === false
                        ? "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-primary)]/55"
                        : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]"
                    }`}
                  >
                    {value.isActive === false ? "Pausada" : "Activa"}
                  </button>
                  <IconButton onClick={() => onRemoveValue(groupIndex, valueIndex)} label="Eliminar opción">
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              ))}

              <button
                type="button"
                onClick={() => onAddValue(groupIndex)}
                className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-[var(--brand-primary)]/40 bg-white px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]"
              >
                <Plus size={13} />
                Agregar opción
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AddonsBuilder({
  addons,
  onAdd,
  onUpdate,
  onRemove,
}: {
  addons: OptionValue[]
  onAdd: () => void
  onUpdate: (index: number, patch: Partial<OptionValue>) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className={SECTION_CLASS}>
      <SectionHeader
        title="Adicionales"
        helper="Extras que el cliente puede sumar (con precio, categoría y cantidad máxima)."
        onAdd={onAdd}
        addLabel="Agregar adicional"
      />

      {addons.length === 0 && (
        <p className="mt-3 text-sm font-bold text-[var(--brand-ink-2)]/55">
          Sin adicionales. Agrega uno para permitir extras pagados.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {addons.map((addon, index) => (
          <div key={addon.id || index} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white p-2">
            <input
              value={addon.name}
              onChange={(event) => onUpdate(index, { name: event.target.value })}
              placeholder="Nombre (ej: Tocineta)"
              className={`${ROW_INPUT_CLASS} flex-1 min-w-[150px]`}
            />
            <input
              value={addon.category || ""}
              onChange={(event) => onUpdate(index, { category: event.target.value })}
              placeholder="Categoría"
              className={`${ROW_INPUT_CLASS} w-28`}
            />
            <label className="inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
              USD
              <input
                value={addon.price ? String(addon.price) : ""}
                onChange={(event) => onUpdate(index, { price: numberFromInput(event.target.value) })}
                inputMode="decimal"
                placeholder="0"
                className={`${ROW_INPUT_CLASS} w-20`}
              />
            </label>
            <label className="inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
              Máx
              <input
                value={addon.maxQuantity ? String(addon.maxQuantity) : ""}
                onChange={(event) => onUpdate(index, { maxQuantity: Math.round(numberFromInput(event.target.value)) })}
                inputMode="numeric"
                placeholder="1"
                className={`${ROW_INPUT_CLASS} w-16`}
              />
            </label>
            <IconButton onClick={() => onRemove(index)} label="Eliminar adicional">
              <Trash2 size={15} />
            </IconButton>
          </div>
        ))}
      </div>
    </div>
  )
}

export function IngredientsBuilder({
  title,
  helper,
  rows,
  inventoryOptions,
  showExtraPrice,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string
  helper?: string
  rows: OptionValue[]
  inventoryOptions: InventoryOption[]
  showExtraPrice: boolean
  onAdd: () => void
  onUpdate: (index: number, patch: Partial<OptionValue>) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className={SECTION_CLASS}>
      <SectionHeader title={title} helper={helper} onAdd={onAdd} addLabel="Agregar ingrediente" />

      {rows.length === 0 && (
        <p className="mt-3 text-sm font-bold text-[var(--brand-ink-2)]/55">Sin ingredientes registrados.</p>
      )}

      <div className="mt-3 space-y-2">
        {rows.map((row, index) => (
          <div key={row.id || index} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white p-2">
            <input
              value={row.name}
              onChange={(event) => onUpdate(index, { name: event.target.value })}
              placeholder="Ingrediente"
              className={`${ROW_INPUT_CLASS} flex-1 min-w-[150px]`}
            />

            {inventoryOptions.length > 0 && (
              <select
                value={row.inventoryItemId || ""}
                onChange={(event) => {
                  const item = inventoryOptions.find((option) => option.id === event.target.value)
                  onUpdate(index, {
                    inventoryItemId: item ? item.id : null,
                    inventoryUnit: item ? item.unit : "",
                  })
                }}
                className={`${ROW_INPUT_CLASS} w-44`}
              >
                <option value="">Sin vínculo de inventario</option>
                {inventoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.unit ? ` (${option.unit})` : ""}
                  </option>
                ))}
              </select>
            )}

            {inventoryOptions.length > 0 && row.inventoryItemId && (
              <label className="inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                Cant.
                <input
                  value={row.inventoryQuantity ? String(row.inventoryQuantity) : ""}
                  onChange={(event) => onUpdate(index, { inventoryQuantity: numberFromInput(event.target.value) })}
                  inputMode="decimal"
                  placeholder="1"
                  title={`Cantidad de insumo por unidad vendida${row.inventoryUnit ? ` (${row.inventoryUnit})` : ""}`}
                  className={`${ROW_INPUT_CLASS} w-16`}
                />
              </label>
            )}

            {showExtraPrice && (
              <label className="inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                Extra USD
                <input
                  value={row.extraPrice ? String(row.extraPrice) : ""}
                  onChange={(event) => onUpdate(index, { extraPrice: numberFromInput(event.target.value) })}
                  inputMode="decimal"
                  placeholder="0"
                  className={`${ROW_INPUT_CLASS} w-20`}
                />
              </label>
            )}

            <IconButton onClick={() => onRemove(index)} label="Eliminar ingrediente">
              <Trash2 size={15} />
            </IconButton>
          </div>
        ))}
      </div>
    </div>
  )
}

export type ComboProductOption = {
  id: number
  name: string
  price: number
}

export function ComboBuilder({
  rows,
  productOptions,
  onAdd,
  onUpdate,
  onRemove,
}: {
  rows: ComboItemRow[]
  productOptions: ComboProductOption[]
  onAdd: () => void
  onUpdate: (index: number, patch: Partial<ComboItemRow>) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className={SECTION_CLASS}>
      <SectionHeader
        title="Artículos del combo"
        helper="Define qué productos del menú componen este combo y en qué cantidad. El precio del combo sigue siendo el precio fijo del producto."
        onAdd={onAdd}
        addLabel="Agregar artículo"
      />

      {rows.length === 0 && (
        <p className="mt-3 text-sm font-bold text-[var(--brand-ink-2)]/55">
          Sin artículos. Agrega los productos que incluye el combo para que cocina y caja vean su composición.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {rows.map((row, index) => (
          <div key={row.id || index} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white p-2">
            <select
              value={row.productId ? String(row.productId) : ""}
              onChange={(event) => {
                const product = productOptions.find(
                  (option) => String(option.id) === event.target.value,
                )
                onUpdate(index, {
                  productId: product ? product.id : undefined,
                  name: product ? product.name : row.name,
                })
              }}
              className={`${ROW_INPUT_CLASS} w-56`}
            >
              <option value="">Artículo libre (sin vínculo)</option>
              {productOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.name}
                </option>
              ))}
            </select>
            <input
              value={row.name}
              onChange={(event) => onUpdate(index, { name: event.target.value })}
              placeholder="Nombre visible (ej: Hamburguesa clásica)"
              className={`${ROW_INPUT_CLASS} flex-1 min-w-[150px]`}
            />
            <label className="inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
              Cant.
              <input
                value={row.quantity ? String(row.quantity) : ""}
                onChange={(event) => onUpdate(index, { quantity: Math.round(numberFromInput(event.target.value)) })}
                inputMode="numeric"
                placeholder="1"
                className={`${ROW_INPUT_CLASS} w-16`}
              />
            </label>
            <IconButton onClick={() => onRemove(index)} label="Eliminar artículo">
              <Trash2 size={15} />
            </IconButton>
          </div>
        ))}
      </div>
    </div>
  )
}
