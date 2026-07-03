"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { BRAND } from "@/lib/brand";
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  MessageCircle,
  Printer,
  QrCode,
  Store,
  Table2,
} from "lucide-react";
import {
  DEFAULT_LOCAL_TABLES,
  normalizeLocalTablesForMap,
  type LocalTableMapItem,
} from "@/components/local/LocalTablesMap";
import {
  BRANCH_CHANGE_EVENT,
  fetchActiveBranches,
  getSelectedBranchId,
  type StaffBranch,
} from "@/lib/branchClient";

type LocalTableQrLinksPanelProps = {
  tables: LocalTableMapItem[];
  title?: string;
  description?: string;
  compact?: boolean;
  baseUrl?: string;
  showQrImages?: boolean;
  showBatchActions?: boolean;
  showPrintButton?: boolean;
  showManagementLink?: boolean;
  managementHref?: string;
};

type CopiedState = {
  tableName: string;
  action: "link" | "message" | "all" | "allMessages";
} | null;

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function getTableToken(table: LocalTableMapItem) {
  return cleanText(table.id || table.name).replace(/^\/+|\/+$/g, "") || cleanText(table.name) || "mesa";
}

function buildTablePath(table: LocalTableMapItem, branchId: string | null) {
  const suffix = branchId ? `?branch=${encodeURIComponent(branchId)}` : "";
  return `/mesa/${encodeURIComponent(getTableToken(table))}${suffix}`;
}

function buildDirectMenuPath(table: LocalTableMapItem, branchId: string | null) {
  const suffix = branchId ? `&branch=${encodeURIComponent(branchId)}` : "";
  return `/?mesa=${encodeURIComponent(getTableToken(table))}${suffix}`;
}

function joinBaseUrl(baseUrl: string, path: string) {
  const cleanBase = cleanText(baseUrl).replace(/\/+$/g, "");

  if (!cleanBase) return path;

  return `${cleanBase}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildTableMessage(table: LocalTableMapItem, link: string) {
  return [
    `${BRAND.shortName} · ${table.name}`,
    "Abre el menú desde esta mesa y registra tu pedido:",
    link,
  ].join("\n");
}

function buildQrImageUrl(link: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=16&data=${encodeURIComponent(link)}`;
}

function buildAllLinksText(tables: LocalTableMapItem[], baseUrl: string, branchId: string | null) {
  return tables
    .map((table) => `${table.name}: ${joinBaseUrl(baseUrl, buildTablePath(table, branchId))}`)
    .join("\n");
}

function buildAllMessagesText(tables: LocalTableMapItem[], baseUrl: string, branchId: string | null) {
  return tables
    .map((table) => buildTableMessage(table, joinBaseUrl(baseUrl, buildTablePath(table, branchId))))
    .join("\n\n---\n\n");
}

async function copyToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") return;

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function LocalTableQrLinksPanel({
  tables,
  title = "Enlaces QR por mesa",
  description = "Copia el enlace de cada mesa para imprimirlo como QR o enviarlo al cliente. Al abrirlo, el carrito queda preseleccionado con esa mesa y el pedido público muestra la mesa validada.",
  compact = false,
  baseUrl = "",
  showQrImages = true,
  showBatchActions = true,
  showPrintButton = true,
  showManagementLink = true,
  managementHref = "/local-santo/mesas",
}: LocalTableQrLinksPanelProps) {
  const [browserBaseUrl, setBrowserBaseUrl] = useState("");
  const [copiedState, setCopiedState] = useState<CopiedState>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<StaffBranch[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Difiere el setState un tick para no hacerlo síncrono en el efecto.
    const timer = setTimeout(() => {
      setBrowserBaseUrl(window.location.origin);
      setBranchId(getSelectedBranchId());
    }, 0);

    // Los enlaces llevan ?branch=<sede>; si el staff cambia de sede, se
    // regeneran para que el QR apunte a la sucursal correcta.
    const handleBranchChange = () => setBranchId(getSelectedBranchId());
    window.addEventListener(BRANCH_CHANGE_EVENT, handleBranchChange);

    fetchActiveBranches().then((activeBranches) => setBranches(activeBranches));

    return () => {
      clearTimeout(timer);
      window.removeEventListener(BRANCH_CHANGE_EVENT, handleBranchChange);
    };
  }, []);

  const branchName = useMemo(() => {
    if (!branchId) return "";
    return branches.find((branch) => branch.id === branchId)?.name || branchId;
  }, [branchId, branches]);

  const activeTables = useMemo(
    () =>
      normalizeLocalTablesForMap(tables, DEFAULT_LOCAL_TABLES).filter(
        (table) => table.isActive !== false,
      ),
    [tables],
  );
  const resolvedBaseUrl = baseUrl || browserBaseUrl;
  const canUseBatchActions = showBatchActions && activeTables.length > 0;

  function resetCopyState(nextState: NonNullable<CopiedState>) {
    setCopiedState(nextState);

    window.setTimeout(() => {
      setCopiedState((current) => {
        if (!current || current.tableName !== nextState.tableName || current.action !== nextState.action) {
          return current;
        }

        return null;
      });
    }, 1800);
  }

  async function handleCopy(table: LocalTableMapItem, action: "link" | "message") {
    const link = joinBaseUrl(resolvedBaseUrl, buildTablePath(table, branchId));
    const value = action === "message" ? buildTableMessage(table, link) : link;

    await copyToClipboard(value);
    resetCopyState({ tableName: table.name, action });
  }

  async function handleCopyAll(action: "all" | "allMessages") {
    const value =
      action === "allMessages"
        ? buildAllMessagesText(activeTables, resolvedBaseUrl, branchId)
        : buildAllLinksText(activeTables, resolvedBaseUrl, branchId);

    await copyToClipboard(value);
    resetCopyState({ tableName: "Todas", action });
  }

  function handlePrint() {
    if (typeof window === "undefined") return;

    window.print();
  }

  return (
    <section className={`rounded-[1.5rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)] print:border-0 print:shadow-none ${compact ? "p-4" : "p-4 sm:p-5"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            <QrCode size={18} />
            {title}
          </p>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {branchName && (
            <span className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white">
              <Store size={15} />
              Sede: {branchName}
            </span>
          )}

          <span className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
            <Table2 size={15} />
            {activeTables.length} mesa(s)
          </span>

          {canUseBatchActions && (
            <>
              <button
                type="button"
                onClick={() => handleCopyAll("all")}
                className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] transition hover:bg-yellow-50"
              >
                {copiedState?.action === "all" ? <CheckCircle2 size={15} /> : <ClipboardList size={15} />}
                {copiedState?.action === "all" ? "Copiados" : "Copiar todos"}
              </button>

              <button
                type="button"
                onClick={() => handleCopyAll("allMessages")}
                className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
              >
                {copiedState?.action === "allMessages" ? <CheckCircle2 size={15} /> : <MessageCircle size={15} />}
                {copiedState?.action === "allMessages" ? "Listo" : "Mensajes"}
              </button>
            </>
          )}

          {showPrintButton && activeTables.length > 0 && (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-white transition hover:bg-[var(--brand-primary-dark)]"
            >
              <Printer size={15} />
              Imprimir
            </button>
          )}

          {showManagementLink && (
            <a
              href={managementHref}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/30 bg-white px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] transition hover:bg-yellow-50"
            >
              <ExternalLink size={15} />
              Ver página
            </a>
          )}
        </div>
      </div>

      {activeTables.length === 0 ? (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] p-5 text-sm font-bold text-[var(--brand-ink-2)]/70">
          No hay mesas activas configuradas para generar enlaces.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-2">
          {activeTables.map((table) => {
            const tablePath = buildTablePath(table, branchId);
            const directMenuPath = buildDirectMenuPath(table, branchId);
            const tableLink = joinBaseUrl(resolvedBaseUrl, tablePath);
            const copiedLink = copiedState?.tableName === table.name && copiedState.action === "link";
            const copiedMessage = copiedState?.tableName === table.name && copiedState.action === "message";

            return (
              <article key={table.id || table.name} className="break-inside-avoid rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4 print:border-[var(--brand-primary)] print:bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black uppercase text-[var(--brand-ink-3)]">{table.name}</p>
                    <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">
                      {table.area || "Principal"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] print:border print:border-[var(--brand-primary)]/25">
                    QR listo
                  </span>
                </div>

                {showQrImages && (
                  <div className="mt-4 flex justify-center rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white p-3">
                    <Image
                      src={buildQrImageUrl(tableLink || tablePath)}
                      alt={`QR de ${table.name}`}
                      width={176}
                      height={176}
                      unoptimized
                      className="h-44 w-44 rounded-xl object-contain"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-[var(--brand-primary)]/15 bg-white px-3 py-2">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/65">
                    Enlace de mesa
                  </p>
                  <p className="mt-1 break-all text-xs font-bold leading-5 text-[var(--brand-ink-2)]/80">
                    {tableLink || tablePath}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => handleCopy(table, "link")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] transition hover:bg-yellow-50"
                  >
                    {copiedLink ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                    {copiedLink ? "Copiado" : "Copiar"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(table, "message")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                  >
                    {copiedMessage ? <CheckCircle2 size={15} /> : <MessageCircle size={15} />}
                    {copiedMessage ? "Listo" : "Mensaje"}
                  </button>

                  <a
                    href={tablePath}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-white transition hover:bg-[var(--brand-primary-dark)]"
                  >
                    <ExternalLink size={15} />
                    Abrir
                  </a>
                </div>

                <p className="mt-3 break-all rounded-xl bg-white/80 px-3 py-2 text-[0.62rem] font-bold leading-5 text-[var(--brand-ink-2)]/60">
                  Alterno: {directMenuPath}
                </p>

                {showQrImages && (
                  <p className="mt-2 text-center text-[0.58rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/55 print:text-[var(--brand-primary)]">
                    Escanea para pedir desde esta mesa
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
