"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Table2 } from "lucide-react";
import { BRAND } from "@/lib/brand";

function getMesaToken(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const textValue = String(rawValue || "").trim();

  if (!textValue) return "";

  try {
    return decodeURIComponent(textValue);
  } catch {
    return textValue;
  }
}

export default function MesaRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mesaToken = useMemo(() => getMesaToken(params?.mesa), [params]);
  const branch = (searchParams.get("branch") || "").trim();
  const destination = mesaToken
    ? `/?mesa=${encodeURIComponent(mesaToken)}&mesa_qr=1${branch ? `&branch=${encodeURIComponent(branch)}` : ""}`
    : branch
      ? `/?branch=${encodeURIComponent(branch)}`
      : "/";

  useEffect(() => {
    router.replace(destination);
  }, [destination, router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(var(--brand-primary-rgb),0.2),transparent_60%)]"
      />
      <section className="relative w-full max-w-md rounded-[1.8rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-7 text-center shadow-[0_30px_80px_-40px_rgba(var(--brand-primary-rgb),0.45)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(var(--brand-primary-rgb),0.14)] text-[var(--brand-primary)]">
          <Table2 size={30} />
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
          Pedido desde la mesa
        </p>
        <h1 className="font-display mt-2 text-3xl uppercase leading-none text-[var(--brand-ink-3)]">
          {mesaToken ? `Mesa ${mesaToken}` : BRAND.name}
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[var(--brand-ink-2)]">
          Te estamos llevando al menú con la mesa preseleccionada para registrar
          el pedido correctamente desde este QR.
        </p>
        <div className="mt-5 flex justify-center">
          <Loader2 className="animate-spin text-[var(--brand-primary)]" size={24} />
        </div>
        <Link
          href={destination}
          className="mt-5 inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_14px_36px_-12px_rgba(var(--brand-primary-rgb),0.8)] transition hover:bg-[var(--brand-accent)] active:scale-95"
        >
          Pedir ahora
        </Link>
      </section>
    </main>
  );
}
