"use client";

// Selector de sede compacto para el flujo público del cliente (Fase 3 del
// plan de sedes): se monta arriba del registro de pedido y de la consulta de
// cuentas. Comparte la sede elegida con el resto de la app vía branchClient
// (localStorage + evento), de modo que AuthBridge adjunta x-branch-id a las
// llamadas /api y todo queda scopeado a esa sede.

import { useEffect, useMemo, useState } from "react";
import { MapPin, Store } from "lucide-react";
import {
  BRANCH_CHANGE_EVENT,
  getSelectedBranchId,
  setSelectedBranchId,
} from "@/lib/branchClient";
import { resolvePreferredPublicBranchId } from "@/lib/publicBranchSelection";
import type { PublicBranch } from "@/components/cartTypes";

type PublicBranchesResponse = {
  ok?: boolean;
  branches?: PublicBranch[];
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function getBranchFromUrl() {
  if (typeof window === "undefined") return "";
  try {
    return cleanText(new URLSearchParams(window.location.search).get("branch"));
  } catch {
    return "";
  }
}

function updateUrlBranch(branchId: string) {
  if (typeof window === "undefined" || !branchId) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("branch", branchId);
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* sin acceso a la URL */
  }
}

export type PublicBranchSelection = {
  branches: PublicBranch[];
  selectedBranchId: string;
  selectedBranch: PublicBranch | null;
  loading: boolean;
  // Con varias sedes y ninguna elegida, el cliente debe escoger antes de
  // ver mesas o registrar el pedido.
  needsSelection: boolean;
  selectBranch: (branchId: string) => void;
};

export function usePublicBranchSelection(): PublicBranchSelection {
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const response = await fetch("/api/public/branches", { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as PublicBranchesResponse;
        if (!response.ok || data.ok === false) return;

        const activeBranches = Array.isArray(data.branches)
          ? data.branches.filter((branch) => branch.isActive !== false)
          : [];
        const preferred = resolvePreferredPublicBranchId(activeBranches, [
          getBranchFromUrl(),
          getSelectedBranchId(),
        ]);

        if (ignore) return;

        setBranches(activeBranches);
        setSelectedBranchIdState(preferred);

        // Sanea la sede guardada en este dispositivo: si ya no existe o está
        // inactiva (p. ej. un id viejo de otro despliegue), se limpia para que
        // AuthBridge no la siga adjuntando a cada /api con el menú equivocado.
        const storedBranchId = cleanText(getSelectedBranchId());
        if (preferred !== storedBranchId) {
          setSelectedBranchId(preferred || null);
        }
        if (preferred) updateUrlBranch(preferred);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    // Si otro componente de la misma página cambia la sede, sincronizamos.
    const onChange = () => {
      setSelectedBranchIdState(cleanText(getSelectedBranchId()));
    };
    window.addEventListener(BRANCH_CHANGE_EVENT, onChange);

    return () => {
      ignore = true;
      window.removeEventListener(BRANCH_CHANGE_EVENT, onChange);
    };
  }, []);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) || null,
    [branches, selectedBranchId],
  );

  function selectBranch(branchId: string) {
    const cleanId = cleanText(branchId);
    if (!cleanId || cleanId === selectedBranchId) return;
    if (!branches.some((branch) => branch.id === cleanId)) return;

    setSelectedBranchIdState(cleanId);
    setSelectedBranchId(cleanId);
    updateUrlBranch(cleanId);
  }

  return {
    branches,
    selectedBranchId,
    selectedBranch,
    loading,
    needsSelection: !loading && branches.length > 1 && !selectedBranchId,
    selectBranch,
  };
}

export default function PublicBranchPicker({
  selection,
  label = "Sede",
}: {
  selection: PublicBranchSelection;
  label?: string;
}) {
  const { branches, selectedBranchId, selectedBranch, loading, needsSelection, selectBranch } =
    selection;

  // Sin sedes configuradas (o mientras carga) no ocupamos espacio.
  if (loading || branches.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        needsSelection
          ? "border-[var(--brand-primary)] bg-[rgba(var(--brand-primary-rgb),0.12)]"
          : "border-[var(--brand-border)] bg-[var(--brand-surface-2)]"
      }`}
    >
      <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        <Store size={15} />
        {label}
      </p>

      {branches.length === 1 ? (
        <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/75">
          {selectedBranch?.name || branches[0].name}
        </p>
      ) : (
        <>
          <select
            value={selectedBranchId}
            onChange={(event) => selectBranch(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--brand-border)] bg-black px-4 py-3 text-sm font-black text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="" disabled>
              Elige tu sede…
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>

          {needsSelection ? (
            <p className="mt-2 text-sm font-bold leading-5 text-[var(--brand-ink)]/75">
              Elige la sede donde estás para continuar.
            </p>
          ) : null}
        </>
      )}

      {selectedBranch?.address ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[0.7rem] font-bold text-[var(--brand-ink-2)]/60">
          <MapPin size={12} /> {selectedBranch.address}
        </p>
      ) : null}
    </div>
  );
}
