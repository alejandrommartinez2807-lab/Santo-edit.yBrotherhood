"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Save, Table2, Trash2 } from "lucide-react";

// Editor ÚNICO de mesas (pedido del dueño 2026-07-25): crear, renombrar,
// ordenar, activar/desactivar y anotar mesas se hace solo aquí, en el módulo
// "Mesas y QR", con el selector de sede de la página. Antes vivía repartido
// entre Configuración (mesas generales) y Sucursales (mesas propias), que era
// justo la confusión que el dueño reportó.
//
// Dos destinos, según lo que elija el dueño para la sede abierta:
//  - "Heredar las generales": guarda en business_config.localTables (afecta a
//    TODAS las sedes que hereden). Se avisa en pantalla.
//  - "Mesas propias": guarda en branchConfigs[sede].localTables vía
//    PATCH /api/branches/[id]/config. Solo esa sucursal.
// Los pedidos, cuentas abiertas y QR no se tocan: siguen leyendo el nombre de
// la mesa, que es lo que relaciona todo.

const OWNER_STORAGE_KEY = "santo_perrito_owner_session";

export type EditableTable = {
  name: string;
  area: string;
  sortOrder: number;
  isActive: boolean;
  note: string;
};

type RawTable = {
  name?: unknown;
  area?: unknown;
  sortOrder?: unknown;
  isActive?: unknown;
  note?: unknown;
};

// Comparación de nombres de mesa igual a la del servidor: sin acentos, sin
// mayúsculas y sin espacios de sobra. El servidor descarta mesas repetidas con
// ese criterio, así que el editor tiene que usar el mismo para avisar antes.
export function normalizeTableKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// Mesas OCUPADAS (cuenta abierta o pedidos activos) que desaparecerían al
// guardar: o las renombraron o las quitaron. Como pedidos, cuentas y QR se
// relacionan por el NOMBRE de la mesa, dejarlas ir deja esa cuenta colgando de
// un nombre que ya no existe. Devuelve los nombres afectados (vacío = seguro).
export function getBusyTablesLost(
  loadedNames: string[],
  nextNames: string[],
  busyNames: string[],
): string[] {
  const busy = new Set(busyNames.map(normalizeTableKey).filter(Boolean));
  const next = new Set(nextNames.map(normalizeTableKey).filter(Boolean));

  return loadedNames.filter((name) => {
    const key = normalizeTableKey(name);
    return Boolean(key) && busy.has(key) && !next.has(key);
  });
}

function getOwnerPassword() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(OWNER_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-admin-password": getOwnerPassword(),
  };
}

export function toEditableTables(value: unknown): EditableTable[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw, index): EditableTable | null => {
      const table = (raw && typeof raw === "object" ? raw : { name: raw }) as RawTable;
      const name = String(table.name || "").trim();
      if (!name) return null;

      const sortOrder = Number(table.sortOrder);

      return {
        name,
        area: String(table.area || "").trim(),
        sortOrder: Number.isFinite(sortOrder) && sortOrder > 0 ? Math.round(sortOrder) : index + 1,
        isActive: table.isActive !== false,
        note: String(table.note || "").trim(),
      };
    })
    .filter((table): table is EditableTable => Boolean(table));
}

// Payload de guardado: se omiten los campos vacíos para no ensuciar la config.
function toSavedTables(tables: EditableTable[]) {
  return tables
    .map((table, index) => ({
      name: table.name.trim(),
      ...(table.area.trim() ? { area: table.area.trim() } : {}),
      sortOrder: Number.isFinite(table.sortOrder) && table.sortOrder > 0
        ? Math.round(table.sortOrder)
        : index + 1,
      isActive: table.isActive,
      ...(table.note.trim() ? { note: table.note.trim() } : {}),
    }))
    .filter((table) => table.name);
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || "Respuesta inválida" };
  }
}

export default function LocalTablesEditor({
  branchId,
  branchName,
  hasMultipleBranches,
  busyTableNames = [],
  onSaved,
}: {
  branchId: string | null;
  branchName: string;
  hasMultipleBranches: boolean;
  // Mesas de ESTA sede con cuenta abierta o pedidos activos ahora mismo.
  // Todo (pedidos, cuentas y QR) se relaciona por el NOMBRE de la mesa, así
  // que renombrarla o quitarla mientras está ocupada deja su cuenta huérfana:
  // el mapa ya no la encuentra y caja no la ve en esa mesa.
  busyTableNames?: string[];
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  // ¿La sede tiene mesas PROPIAS? false = hereda las generales del negocio.
  const [ownTables, setOwnTables] = useState(false);
  // Lo que está GUARDADO hoy (distinto de lo elegido en pantalla): si la sede
  // ya tiene mesas propias, editar "las generales" no cambia nada en ESTA
  // sede hasta que se toque "Volver a las generales". Hay que decirlo.
  const [savedOwnTables, setSavedOwnTables] = useState(false);
  const [tables, setTables] = useState<EditableTable[]>([]);
  // Nombres tal como estaban al cargar: sirven para detectar renombres.
  const [loadedNames, setLoadedNames] = useState<string[]>([]);
  const [globalTables, setGlobalTables] = useState<EditableTable[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  // Descarta respuestas viejas si el dueño cambia de sede a mitad de carga:
  // sin esto, la respuesta lenta de la sede anterior podía pintar SUS mesas
  // sobre la sede nueva y un "Guardar" las escribiría en la sucursal
  // equivocada. Mismo blindaje que ya tenía el panel de Sucursales.
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    if (!branchId) return;

    const seq = ++seqRef.current;
    setLoading(true);
    setError("");
    setOkMsg("");

    try {
      const [globalResponse, branchResponse] = await Promise.all([
        fetch("/api/business-config", { headers: authHeaders(), cache: "no-store" }),
        fetch(`/api/branches/${branchId}/config`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
      ]);

      // Solo el dueño puede editar mesas: sin permiso el panel queda de lectura
      // (el resto del módulo — mapa, estado y QR — sigue funcionando igual).
      if (globalResponse.status === 401 || globalResponse.status === 403 ||
          branchResponse.status === 401 || branchResponse.status === 403) {
        if (seq !== seqRef.current) return;
        setCanEdit(false);
        return;
      }

      const globalData = await readJson(globalResponse);
      const branchData = await readJson(branchResponse);

      if (!globalResponse.ok) throw new Error(globalData.error || "No se pudo cargar la configuración");
      if (!branchResponse.ok) throw new Error(branchData.error || "No se pudo cargar la sede");

      const global = toEditableTables(globalData.businessConfig?.localTables);
      const branchOwn = branchData.branchConfig?.localTables;
      const hasOwn = Array.isArray(branchOwn);

      if (seq !== seqRef.current) return;

      setCanEdit(true);
      setGlobalTables(global);
      setOwnTables(hasOwn);
      setSavedOwnTables(hasOwn);
      const inUse = hasOwn ? toEditableTables(branchOwn) : global;
      setTables(inUse);
      setLoadedNames(inUse.map((table) => table.name));
    } catch (loadError) {
      if (seq !== seqRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las mesas");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  function updateTable(index: number, patch: Partial<EditableTable>) {
    setTables((current) => current.map((table, i) => (i === index ? { ...table, ...patch } : table)));
  }

  function addTable() {
    setTables((current) => [
      ...current,
      {
        name: `Mesa ${current.length + 1}`,
        area: "Principal",
        sortOrder: current.length + 1,
        isActive: true,
        note: "",
      },
    ]);
  }

  // Cambiar entre heredadas y propias solo mueve el DESTINO del guardado: la
  // lista visible arranca de lo que la sede está usando hoy, para que nadie
  // pierda sus mesas al tocar el botón.
  function switchToInherited() {
    setOwnTables(false);
    setTables(globalTables);
    setOkMsg("");
  }

  function switchToOwn() {
    setOwnTables(true);
    setTables((current) => (current.length ? current : globalTables));
    setOkMsg("");
  }

  async function save() {
    const cleaned = toSavedTables(tables);

    if (!cleaned.length) {
      setError("Deja al menos una mesa con nombre.");
      return;
    }

    const names = new Set<string>();
    for (const table of cleaned) {
      const key = normalizeTableKey(table.name);
      if (names.has(key)) {
        setError(`Hay dos mesas con el mismo nombre (“${table.name}”). Los pedidos y las cuentas se relacionan por el nombre, así que deben ser distintos.`);
        return;
      }
      names.add(key);
    }

    // Guarda de mesas OCUPADAS: si una mesa con cuenta abierta o pedidos
    // activos desaparece de la lista (renombrada o quitada), su cuenta queda
    // colgando de un nombre que ya no existe. Se bloquea y se explica.
    const gone = getBusyTablesLost(
      loadedNames,
      cleaned.map((table) => table.name),
      busyTableNames,
    );

    if (gone.length) {
      setError(
        `No se puede guardar: ${gone.join(", ")} ${gone.length === 1 ? "tiene" : "tienen"} cuenta abierta o pedidos activos ahora mismo. Todo se relaciona por el nombre de la mesa, así que al renombrarla o quitarla esa cuenta quedaría colgando. Ciérrala en Caja primero y vuelve.`,
      );
      return;
    }

    setSaving(true);
    setError("");
    setOkMsg("");

    try {
      const response = ownTables
        ? await fetch(`/api/branches/${branchId}/config`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ branchConfig: { localTables: cleaned } }),
          })
        : await fetch("/api/business-config", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ businessConfig: { localTables: cleaned } }),
          });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "No se pudieron guardar las mesas");

      // El servidor ignora las mesas si el plan no incluye el módulo: en ese
      // caso NO se puede decir "guardadas" (el dueño volvería y estarían como
      // antes sin entender por qué).
      const savedList = ownTables
        ? data.branchConfig?.localTables
        : data.businessConfig?.localTables;
      // Comparación por nombres ORDENADOS: el servidor devuelve las mesas
      // ordenadas por su número de orden, que no tiene por qué coincidir con
      // el orden de las filas en pantalla.
      const sortedNames = (list: { name: string }[]) =>
        list
          .map((table) => normalizeTableKey(table.name))
          .sort()
          .join("|");
      const savedNames = sortedNames(toEditableTables(savedList));
      const sentNames = sortedNames(cleaned);
      if (Array.isArray(savedList) && savedNames !== sentNames) {
        setError(
          "El servidor no guardó las mesas: tu plan no incluye el módulo de Mesas. Actívalo o pide el cambio de plan.",
        );
        return;
      }

      setOkMsg(
        ownTables
          ? `Mesas propias de ${branchName || "la sede"} guardadas.`
          : "Mesas generales guardadas (las usan todas las sedes que heredan).",
      );
      onSaved?.();
      void load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar las mesas");
    } finally {
      setSaving(false);
    }
  }

  async function useInheritedAgain() {
    if (
      !window.confirm(
        `¿Volver a las mesas generales en ${branchName || "esta sede"}?\n\nSe borran las mesas propias de esta sucursal y pasa a usar las del negocio. Los pedidos y cuentas ya registrados no se tocan.`,
      )
    )
      return;

    setSaving(true);
    setError("");
    setOkMsg("");

    try {
      const response = await fetch(`/api/branches/${branchId}/config`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ branchConfig: { localTables: null } }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "No se pudo volver a las mesas generales");

      setOkMsg("Esta sede volvió a usar las mesas generales.");
      onSaved?.();
      void load();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[#1a1a1a] outline-none focus:border-[var(--brand-primary)]";
  const labelClass =
    "text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]";

  if (!canEdit) {
    return (
      <section className="rounded-[1.5rem] border-4 border-[var(--brand-primary)] bg-white p-5 print:hidden">
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          <Table2 size={16} /> Crear y editar mesas
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
          Solo el dueño puede crear o editar mesas. Puedes seguir usando el mapa
          de mesas y los QR de arriba con normalidad.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border-4 border-[var(--brand-primary)] bg-white p-5 shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)] print:hidden">
      <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        <Table2 size={16} /> Crear y editar mesas
      </p>
      <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
        Estos nombres son los que ve el cliente al pedir desde la mesa y los que
        usan el mapa de arriba, las cuentas abiertas y los QR. Para esconder una
        mesa sin perder su historial, déjala inactiva en vez de quitarla.
      </p>

      {hasMultipleBranches ? (
        <div className="mt-4">
          <p className={labelClass}>¿De dónde salen las mesas de {branchName || "esta sede"}?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={switchToInherited}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                !ownTables
                  ? "border-green-600/30 bg-green-50 text-green-700"
                  : "border-[var(--brand-primary)]/25 bg-white text-[#1a1a1a]/60"
              }`}
            >
              Mesas generales
            </button>
            <button
              type="button"
              onClick={switchToOwn}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                ownTables
                  ? "border-green-600/30 bg-green-50 text-green-700"
                  : "border-[var(--brand-primary)]/25 bg-white text-[#1a1a1a]/60"
              }`}
            >
              Mesas propias de esta sede
            </button>
          </div>
          <p className="mt-2 rounded-xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/75">
            {ownTables
              ? `Al guardar, estas mesas quedan SOLO en ${branchName || "esta sede"}. Las demás sucursales no cambian.`
              : "Ojo: al guardar cambias las mesas GENERALES del negocio, o sea las de todas las sedes que no tengan mesas propias."}
          </p>

          {/* Duda típica del dueño: si las dos sedes comparten los nombres de
              mesa, ¿se le mezclan las cuentas? No. */}
          <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
            Aunque dos sedes tengan mesas con el mismo nombre, <strong>no se
            mezclan</strong>: cada sucursal tiene su propio QR, sus propios
            pedidos y sus propias cuentas abiertas.
          </p>

          {!ownTables && savedOwnTables ? (
            // Trampa fácil de caer: la sede tiene mesas propias guardadas, así
            // que editar las generales NO se va a ver en ella hasta soltar el
            // override con "Volver a las generales".
            <p className="mt-2 rounded-xl border-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs font-black leading-5 text-amber-800">
              ⚠️ {branchName || "Esta sede"} todavía tiene mesas propias
              guardadas: lo que cambies aquí NO se le va a ver hasta que toques
              “Volver a las generales”.
            </p>
          ) : null}
        </div>
      ) : null}

      {loading || !branchId ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
          <Loader2 className="animate-spin" size={16} /> Cargando mesas…
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3">
            {tables.map((table, index) => (
              <div
                key={index}
                className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3"
              >
                <div className="grid gap-2 lg:grid-cols-[1.2fr_1fr_90px_auto] lg:items-end">
                  <div>
                    <label className={labelClass} htmlFor={`mesa-nombre-${index}`}>
                      Nombre de la mesa
                    </label>
                    <input
                      id={`mesa-nombre-${index}`}
                      value={table.name}
                      onChange={(event) => updateTable(index, { name: event.target.value })}
                      placeholder={`Mesa ${index + 1}`}
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor={`mesa-area-${index}`}>
                      Área
                    </label>
                    <input
                      id={`mesa-area-${index}`}
                      value={table.area}
                      onChange={(event) => updateTable(index, { area: event.target.value })}
                      placeholder="Principal, terraza, barra…"
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor={`mesa-orden-${index}`}>
                      Orden
                    </label>
                    <input
                      id={`mesa-orden-${index}`}
                      type="number"
                      min={1}
                      value={table.sortOrder}
                      onChange={(event) =>
                        updateTable(index, {
                          sortOrder: Number(event.target.value) > 0
                            ? Math.round(Number(event.target.value))
                            : index + 1,
                        })
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setTables((current) => current.filter((_, i) => i !== index))}
                    disabled={tables.length <= 1}
                    title="Quitar mesa"
                    className="inline-flex items-center justify-center gap-1 rounded-xl border-2 border-red-200 bg-white px-3 py-2.5 text-xs font-black uppercase text-red-600 disabled:opacity-40"
                  >
                    <Trash2 size={15} /> Quitar
                  </button>
                </div>

                <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <label className={labelClass} htmlFor={`mesa-nota-${index}`}>
                      Nota interna (opcional)
                    </label>
                    <input
                      id={`mesa-nota-${index}`}
                      value={table.note}
                      onChange={(event) => updateTable(index, { note: event.target.value })}
                      placeholder="Cerca de caja, terraza, reservada…"
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>

                  <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={table.isActive}
                      onChange={(event) => updateTable(index, { isActive: event.target.checked })}
                      className="h-5 w-5 accent-[var(--brand-primary)]"
                    />
                    <span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                      Mesa activa
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addTable}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[var(--brand-primary)] bg-white px-4 py-2.5 text-xs font-black uppercase text-[var(--brand-primary)]"
            >
              <Plus size={15} /> Agregar mesa
            </button>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-black uppercase text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Guardar mesas
            </button>

            {hasMultipleBranches && ownTables ? (
              <button
                type="button"
                onClick={useInheritedAgain}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[var(--brand-primary)]/30 bg-white px-4 py-2.5 text-xs font-black uppercase text-[var(--brand-ink-2)]/70 disabled:opacity-50"
              >
                Volver a las generales
              </button>
            ) : null}
          </div>
        </>
      )}

      {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
      {okMsg ? <p className="mt-3 text-sm font-bold text-green-700">{okMsg}</p> : null}
    </section>
  );
}
