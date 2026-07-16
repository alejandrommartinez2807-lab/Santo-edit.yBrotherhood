"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Database, Download, Loader2, ShieldCheck } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { downloadCsv } from "@/lib/csv"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "x-admin-password": password }
}

export default function RespaldoPage() {
  return (
    <ModuleAccessGuard moduleKey="fiscalInvoicing" moduleName="Respaldo y datos">
      <RespaldoContent />
    </ModuleAccessGuard>
  )
}

function RespaldoContent() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState("")

  async function downloadFullExport() {
    setBusy(true)
    setError("")
    setDone("")
    try {
      const from = "2020-01-01"
      const to = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10)
      const res = await fetch(`/api/accounting-exports?type=full&from=${from}&to=${to}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || "No se pudo generar el export")
      }
      const text = await res.text()
      downloadCsv(`export-total-hotel-${new Date().toISOString().slice(0, 10)}.csv`, text)
      setDone("Export total descargado. Guárdalo en un lugar seguro.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const cardClass = "rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/local-santo/configuracion" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver a configuración
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Respaldo y datos</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Qué se respalda, cada cuánto, y cómo llevarte tus datos.</p>
          </div>
        </div>

        <div className={`${cardClass} mt-6`}>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
            <Database size={14} /> Respaldo automático
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            Toda la información del hotel (reservas, folios, facturas, huéspedes, inventario,
            configuración) vive en una base de datos gestionada (Supabase/PostgreSQL) que genera
            <span className="text-[var(--brand-ink-3)]"> respaldos automáticos diarios</span> con
            retención según el plan contratado. Además, cada cambio queda en la base al instante:
            no hay información solo en el dispositivo.
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            La restauración de un respaldo la ejecuta soporte a partir de la copia diaria más
            reciente. El procedimiento completo está documentado en{" "}
            <span className="text-[var(--brand-ink-3)]">docs/RESPALDO.md</span> del proyecto.
          </p>
        </div>

        <div className={`${cardClass} mt-4`}>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
            <Download size={14} /> Tus datos son tuyos
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            Descarga cuando quieras el <span className="text-[var(--brand-ink-3)]">export total</span>:
            un CSV por secciones con reservas, folios, facturas y huéspedes, listo para abrir en
            Excel o entregar a tu contador. No dependes de nadie para llevarte tu información.
          </p>
          <button
            onClick={downloadFullExport}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Descargar export total
          </button>
          {done && <p className="mt-3 font-bold text-emerald-700">{done}</p>}
          {error && <p className="mt-3 font-bold text-red-600">{error}</p>}
        </div>

        <p className="mt-4 text-xs font-bold text-[var(--brand-ink-2)]/50">
          Consejo: descarga el export total al cierre de cada mes y guárdalo junto a tus documentos
          contables.
        </p>
      </div>
    </main>
  )
}
