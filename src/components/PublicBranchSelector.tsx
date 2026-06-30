"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, RefreshCw, Store } from "lucide-react";
import {
  BRANCH_CHANGE_EVENT,
  getSelectedBranchId,
  setSelectedBranchId,
} from "@/lib/branchClient";
import type { PublicBranch } from "@/components/cartTypes";

type PublicBranchesResponse = {
  ok?: boolean;
  branches?: PublicBranch[];
  selectedBranchId?: string | null;
  selectedBranch?: PublicBranch | null;
  branchCount?: number;
  requiresBranchSelection?: boolean;
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

  const url = new URL(window.location.href);
  url.searchParams.set("branch", branchId);
  window.history.replaceState(null, "", url.toString());
}

export default function PublicBranchSelector() {
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadBranches() {
      try {
        setLoading(true);
        const response = await fetch("/api/public/branches", { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as PublicBranchesResponse;
        if (!response.ok || data.ok === false) return;

        const activeBranches = Array.isArray(data.branches)
          ? data.branches.filter((branch) => branch.isActive !== false)
          : [];
        const urlBranch = getBranchFromUrl();
        const storedBranch = cleanText(getSelectedBranchId());
        const preferred =
          [urlBranch, storedBranch, cleanText(data.selectedBranchId)]
            .filter(Boolean)
            .find((candidate) => activeBranches.some((branch) => branch.id === candidate)) ||
          activeBranches[0]?.id ||
          "";

        if (ignore) return;

        setBranches(activeBranches);
        setSelectedBranchIdState(preferred);

        if (preferred) {
          setSelectedBranchId(preferred);
          updateUrlBranch(preferred);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadBranches();

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

  if (loading || branches.length === 0) return null;

  function changeBranch(branchId: string) {
    if (!branchId || branchId === selectedBranchId) return;
    setIsChanging(true);
    setSelectedBranchId(branchId);
    updateUrlBranch(branchId);
    window.location.reload();
  }

  return (
    <section className="border-b-2 border-[var(--brand-primary)]/10 bg-white/85 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Store size={20} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              Estás comprando en: {selectedBranch?.name || "sede por confirmar"}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
              {selectedBranch?.address ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {selectedBranch.address}
                </span>
              ) : null}
              {selectedBranch?.zone ? <span>Zona: {selectedBranch.zone}</span> : null}
              {selectedBranch?.estimatedTimeText ? (
                <span>Tiempo estimado: {selectedBranch.estimatedTimeText}</span>
              ) : null}
              {!selectedBranch?.address && !selectedBranch?.zone && !selectedBranch?.estimatedTimeText ? (
                <span>El pedido se guardará con esta sede.</span>
              ) : null}
            </p>
          </div>
        </div>

        {branches.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
              Cambiar sede
            </label>
            <select
              value={selectedBranchId}
              disabled={isChanging}
              onChange={(event) => changeBranch(event.target.value)}
              className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[var(--brand-primary)] outline-none focus:border-[var(--brand-accent)] disabled:opacity-60"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {isChanging ? <RefreshCw className="animate-spin text-[var(--brand-primary)]" size={16} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
