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
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <section className="w-full max-w-md rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white p-6 text-center shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
          <Table2 size={30} />
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          Pedido desde la mesa
        </p>
        <h1 className="mt-2 text-2xl font-black uppercase">
          {mesaToken ? `Mesa ${mesaToken}` : BRAND.name}
        </h1>
        <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
          Te estamos llevando al menú con la mesa preseleccionada para registrar
          el pedido correctamente desde este QR.
        </p>
        <div className="mt-5 flex justify-center">
          <Loader2 className="animate-spin text-[var(--brand-primary)]" size={24} />
        </div>
        <Link
          href={destination}
          className="mt-5 inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
        >
          Pedir ahora
        </Link>
      </section>
    </main>
  );
}
