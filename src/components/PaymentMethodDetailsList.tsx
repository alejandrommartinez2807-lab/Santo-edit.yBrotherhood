"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

// Datos de pago del negocio (pago móvil, Zelle…) en botones desplegables:
// el cliente abre "Ver datos de Pago móvil", copia línea por línea y paga
// sin preguntar por WhatsApp. Los datos vienen de Configuración.
export default function PaymentMethodDetailsList({
  details,
}: {
  details: Record<string, string> | undefined;
}) {
  const entries = Object.entries(details || {}).filter(([, value]) =>
    value.trim(),
  );
  const [openMethod, setOpenMethod] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!entries.length) return null;

  async function copyToClipboard(key: string, text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Navegadores dentro de apps (WhatsApp/Instagram) a veces no traen
        // la API moderna: se copia con el truco del textarea temporal.
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
      }
      setCopiedKey(key);
      window.setTimeout(
        () => setCopiedKey((current) => (current === key ? null : current)),
        2000,
      );
    } catch {
      // Si ni así se puede, el cliente igual ve los datos en pantalla.
    }
  }

  return (
    <div className="space-y-2">
      {entries.map(([method, value]) => {
        const isOpen = openMethod === method;
        const lines = value.split("\n").filter((line) => line.trim());

        return (
          <div
            key={method}
            className="overflow-hidden rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]"
          >
            <button
              type="button"
              onClick={() => setOpenMethod(isOpen ? null : method)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left"
            >
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                Ver datos de {method}
              </span>
              <ChevronDown
                size={17}
                className={`shrink-0 text-[var(--brand-primary)] transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isOpen && (
              <div className="space-y-1.5 border-t-2 border-[var(--brand-border)] px-3 py-3">
                {lines.map((line, index) => {
                  const lineKey = `${method}-${index}`;

                  return (
                    <div
                      key={lineKey}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 break-words text-sm font-bold text-[var(--brand-ink)]">
                        {line}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(lineKey, line)}
                        aria-label={`Copiar ${line}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] text-[var(--brand-primary)] transition hover:border-[var(--brand-primary)]"
                      >
                        {copiedKey === lineKey ? (
                          <Check size={15} className="text-green-700" />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    void copyToClipboard(`${method}-all`, lines.join("\n"))
                  }
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--brand-primary)] bg-transparent px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:opacity-80"
                >
                  {copiedKey === `${method}-all` ? (
                    <>
                      <Check size={14} className="text-green-700" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Copiar todo
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
