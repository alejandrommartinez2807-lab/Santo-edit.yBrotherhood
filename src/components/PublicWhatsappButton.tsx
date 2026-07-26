"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MessageCircle, X } from "lucide-react";
import { BRAND } from "@/lib/brand";

// Botón de WhatsApp con SELECTOR DE SEDE (pedido del dueño 2026-07-25):
// Brotherhood tiene un número por sucursal, así que al tocar "Ayuda" o
// cualquier botón de escribir, el cliente elige a cuál local escribirle.
// Con una sola sede (o una sola con número propio) no hay selector: abre
// WhatsApp directo, como antes.
//
// Los números se editan en Sucursales → "Configuración por sede"; la sede sin
// número propio hereda el WhatsApp general del negocio.

export type BranchWhatsapp = { id: string; name: string; phone: string };

function cleanDigits(value: unknown) {
  return String(value ?? "").replace(/[^0-9]/g, "");
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

// Sedes con WhatsApp para escribir. Cada sede usa su número propio; si no
// tiene, hereda el general. Se descartan las repetidas (dos sedes con el mismo
// número son, para el cliente, un solo destino).
export function normalizeBranchWhatsapps(
  branches: unknown,
  fallbackPhone: string,
): BranchWhatsapp[] {
  const fallback = cleanDigits(fallbackPhone);
  const list = Array.isArray(branches) ? branches : [];
  const seenPhones = new Set<string>();

  return list
    .map((raw): BranchWhatsapp | null => {
      if (!raw || typeof raw !== "object") return null;

      const source = raw as Record<string, unknown>;
      const config =
        source.config && typeof source.config === "object"
          ? (source.config as Record<string, unknown>)
          : {};
      const id = cleanText(source.id);
      const name = cleanText(source.publicName) || cleanText(source.name);
      const phone =
        cleanDigits(source.mainWhatsapp) ||
        cleanDigits(config.mainWhatsapp) ||
        fallback;

      if (!id || !name || !phone) return null;
      return { id, name, phone };
    })
    .filter((branch): branch is BranchWhatsapp => {
      if (!branch) return false;
      if (seenPhones.has(branch.phone)) return false;
      seenPhones.add(branch.phone);
      return true;
    });
}

export function buildWhatsappHref(phone: string, message: string) {
  const digits = cleanDigits(phone);
  if (!digits) return "";
  const text = cleanText(message);
  return text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`;
}

// Sedes a las que se puede escribir + el número general como respaldo.
export function useBranchWhatsapps(fallbackPhone?: string) {
  const [branches, setBranches] = useState<BranchWhatsapp[]>([]);
  const [generalPhone, setGeneralPhone] = useState(cleanDigits(fallbackPhone));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [configResponse, branchesResponse] = await Promise.all([
          fetch("/api/public/business-config", { cache: "no-store" }),
          fetch("/api/public/branches", { cache: "no-store" }),
        ]);

        const configData = await configResponse.json().catch(() => ({}));
        const branchesData = await branchesResponse.json().catch(() => ({}));
        if (cancelled) return;

        const config = configData?.businessConfig || configData?.config || {};
        const general =
          cleanDigits(config.mainWhatsapp) ||
          cleanDigits(config.deliveryWhatsapp) ||
          cleanDigits(fallbackPhone) ||
          cleanDigits(BRAND.whatsapp);

        setGeneralPhone(general);
        setBranches(normalizeBranchWhatsapps(branchesData?.branches, general));
      } catch {
        if (!cancelled) {
          setGeneralPhone(cleanDigits(fallbackPhone) || cleanDigits(BRAND.whatsapp));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [fallbackPhone]);

  return { branches, generalPhone };
}

export function BranchWhatsappChooser({
  open,
  branches,
  message,
  title = "¿A cuál sede quieres escribir?",
  description = "Cada local responde por su propio WhatsApp. Elige el que te queda mejor.",
  onClose,
}: {
  open: boolean;
  branches: BranchWhatsapp[];
  message: string;
  title?: string;
  description?: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      // Por encima del carrito/checkout y de la guía de ayuda (z-[130]).
      className="fixed inset-0 z-[140] flex items-end justify-center bg-black/80 px-3 py-4 backdrop-blur-sm sm:items-center"
      // stopPropagation: el selector puede vivir DENTRO de la guía de ayuda,
      // cuyo fondo también cierra al hacer clic. Sin esto, tocar fuera del
      // selector cerraba las dos ventanas de golpe.
      onClick={(event) => {
        event.stopPropagation()
        onClose()
      }}
    >
      <div
        className="w-full max-w-sm rounded-[1.6rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
              WhatsApp
            </p>
            <h3 className="mt-1 text-xl font-black uppercase leading-tight text-[var(--brand-ink-3)]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)]"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-2 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/75">
          {description}
        </p>

        <div className="mt-4 space-y-2">
          {branches.map((branch) => (
            <a
              key={branch.id}
              href={buildWhatsappHref(branch.phone, message)}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-3.5 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-[var(--brand-accent)] active:scale-[0.98]"
            >
              <MessageCircle size={17} />
              {branch.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// Botón/enlace de WhatsApp que se adapta solo: enlace directo con una sede,
// selector con varias. `children` es el contenido visible del botón.
export default function PublicWhatsappButton({
  message,
  className,
  children,
  chooserTitle,
  chooserDescription,
  fallbackPhone,
}: {
  message: string;
  className?: string;
  children: ReactNode;
  chooserTitle?: string;
  chooserDescription?: string;
  fallbackPhone?: string;
}) {
  const { branches, generalPhone } = useBranchWhatsapps(fallbackPhone);
  const [isChooserOpen, setIsChooserOpen] = useState(false);

  const needsChooser = branches.length > 1;
  const directPhone = branches.length === 1 ? branches[0].phone : generalPhone;
  const directHref = needsChooser ? "" : buildWhatsappHref(directPhone, message);

  if (!needsChooser && !directHref) return null;

  return (
    <>
      {needsChooser ? (
        <button type="button" onClick={() => setIsChooserOpen(true)} className={className}>
          {children}
        </button>
      ) : (
        <a href={directHref} target="_blank" rel="noreferrer" className={className}>
          {children}
        </a>
      )}

      <BranchWhatsappChooser
        open={isChooserOpen}
        branches={branches}
        message={message}
        title={chooserTitle}
        description={chooserDescription}
        onClose={() => setIsChooserOpen(false)}
      />
    </>
  );
}
