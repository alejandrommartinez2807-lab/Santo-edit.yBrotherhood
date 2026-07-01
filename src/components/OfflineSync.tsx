"use client"

import { useEffect, useState } from "react"
import { CloudOff, RefreshCw } from "lucide-react"
import { flushQueue, migrateLegacyQueue, queueSize } from "@/lib/offlineQueue"

// Indicador de conexión + sincronización de la cola de pedidos offline.
// Cuando vuelve la conexión (o cada cierto tiempo), reenvía los pedidos
// guardados localmente a /api/orders. El token de sesión lo añade el AuthBridge.

async function submitOrder(payload: unknown): Promise<{ ok: boolean; status: number }> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return { ok: res.ok, status: res.status }
}

export default function OfflineSync() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)

    let cancelled = false

    async function refreshPending() {
      const size = await queueSize()
      if (!cancelled) setPending(size)
    }

    async function sync() {
      if (cancelled || !navigator.onLine || (await queueSize()) === 0) return
      setSyncing(true)
      try {
        await flushQueue(submitOrder)
      } finally {
        if (!cancelled) {
          await refreshPending()
          setSyncing(false)
        }
      }
    }

    function handleOnline() {
      setOnline(true)
      sync()
    }
    function handleOffline() {
      setOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Reintento periódico + refresco del contador.
    const interval = window.setInterval(() => {
      setOnline(navigator.onLine)
      refreshPending()
      sync()
    }, 15000)

    // Migra pedidos de la cola vieja (localStorage) e intenta enviar lo que
    // quedó de una sesión anterior.
    migrateLegacyQueue()
      .then(refreshPending)
      .then(sync)

    return () => {
      cancelled = true
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.clearInterval(interval)
    }
  }, [])

  if (online && pending === 0) return null

  return (
    <div
      className={`fixed bottom-3 left-1/2 z-[100] -translate-x-1/2 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] shadow-lg ${
        online
          ? "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]"
          : "border-amber-600 bg-amber-100 text-amber-900"
      }`}
    >
      {!online ? (
        <span className="inline-flex items-center gap-2">
          <CloudOff size={15} />
          Sin conexión · {pending > 0 ? `${pending} pedido(s) en espera` : "los pedidos se guardarán"}
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          Sincronizando {pending} pedido(s)…
        </span>
      )}
    </div>
  )
}
