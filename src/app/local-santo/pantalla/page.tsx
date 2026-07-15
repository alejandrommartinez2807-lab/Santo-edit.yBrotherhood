"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BRAND } from "@/lib/brand"
import { CookingPot, Expand, Loader2 } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { getDisplayOrderNumber } from "@/lib/localOrderHelpers"
import type { LocalOrder } from "@/types/localOrders"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

// Pantalla para el TV/tablet del mostrador (ideal en ferias/eventos): muestra
// los pedidos de HOY de la sede con un número corto del día (#01, #02...) en
// dos columnas — "Preparando" y "¡Listo!" — para gritar/mostrar números en vez
// de nombres completos. Se fija a una sede abriéndola con ?sede=<id> (igual
// que los enlaces por sede de Sucursales). Es solo lectura: cocina/caja siguen
// cambiando los estados desde sus módulos.

type ScreenOrder = {
  rowNumber?: number
  id: string
  displayNumber?: string
  createdAt: string
  customerName: string
  orderType: string
  status: string
}

type OrdersResponse = {
  orders?: ScreenOrder[]
  error?: string
}

function getStoredPassword() {
  if (typeof window === "undefined") return ""
  try {
    return window.sessionStorage.getItem(ADMIN_STORAGE_KEY) || ""
  } catch {
    return ""
  }
}

function caracasDayKey(isoDate: string | Date) {
  try {
    return new Date(isoDate).toLocaleDateString("en-CA", { timeZone: "America/Caracas" })
  } catch {
    return ""
  }
}

function firstName(value: string) {
  return String(value || "").trim().split(/\s+/)[0] || ""
}

// El número mostrado es EL MISMO que ve el cliente en su confirmación y el
// staff en caja/tickets (displayNumber / #seq): un solo número para gritar.
function orderNumber(order: ScreenOrder) {
  return (
    String(order.displayNumber || "").trim() ||
    getDisplayOrderNumber(order as unknown as LocalOrder)
  )
}

function OrderNumberCard({
  number,
  name,
  ready,
}: {
  number: string
  name: string
  ready: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl border-4 px-6 py-5 ${
        ready
          ? "border-[#d3b26e] bg-[#d3b26e] text-black shadow-[0_0_40px_rgba(211,178,110,0.35)]"
          : "border-[#2a2a2a] bg-[#141414] text-[#fafaf9]"
      }`}
    >
      <p className="text-5xl font-black tracking-tight sm:text-6xl">{number}</p>
      {name ? (
        <p
          className={`mt-1 max-w-[9rem] truncate text-sm font-black uppercase tracking-[0.08em] ${
            ready ? "text-black/70" : "text-[#fafaf9]/50"
          }`}
        >
          {name}
        </p>
      ) : null}
    </div>
  )
}

function PantallaContent() {
  const [orders, setOrders] = useState<ScreenOrder[]>([])
  const [loaded, setLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [clock, setClock] = useState("")
  const isFetching = useRef(false)

  async function loadOrders() {
    if (isFetching.current) return
    isFetching.current = true

    try {
      const password = getStoredPassword()
      const response = await fetch("/api/orders", {
        cache: "no-store",
        headers: { "x-local-password": password },
      })
      const data = (await response.json().catch(() => ({}))) as OrdersResponse
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los pedidos")
      setOrders(Array.isArray(data.orders) ? data.orders : [])
      setErrorMessage("")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error cargando pedidos")
    } finally {
      setLoaded(true)
      isFetching.current = false
    }
  }

  useEffect(() => {
    const start = setTimeout(loadOrders, 0)
    const poll = window.setInterval(loadOrders, 5000)
    const tick = window.setInterval(
      () =>
        setClock(
          new Date().toLocaleTimeString("es-VE", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Caracas",
          }),
        ),
      1000,
    )

    return () => {
      clearTimeout(start)
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
  }, [])

  const { preparing, ready } = useMemo(() => {
    const todayKey = caracasDayKey(new Date())
    // La pantalla es del mostrador: los delivery no se retiran aquí.
    const todayOrders = orders.filter(
      (order) => caracasDayKey(order.createdAt) === todayKey && order.orderType !== "Delivery",
    )

    const withNumber = (order: ScreenOrder) => ({
      id: order.id,
      number: orderNumber(order),
      name: firstName(order.customerName),
      createdAt: order.createdAt,
    })

    const byNewest = (a: { createdAt: string }, b: { createdAt: string }) =>
      String(b.createdAt).localeCompare(String(a.createdAt))

    return {
      preparing: todayOrders
        .filter((order) => order.status === "Nuevo" || order.status === "Preparando")
        .map(withNumber)
        .sort(byNewest)
        .slice(0, 12),
      ready: todayOrders
        .filter((order) => order.status === "Listo")
        .map(withNumber)
        .sort(byNewest)
        .slice(0, 12),
    }
  }, [orders])

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-5 text-[#fafaf9] sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CookingPot size={30} className="text-[#d3b26e]" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-[0.08em] sm:text-3xl">
              {BRAND.name}
            </h1>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#fafaf9]/45">
              Estado de tu pedido
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {clock ? (
            <span className="text-2xl font-black tabular-nums text-[#fafaf9]/70">{clock}</span>
          ) : null}
          <button
            type="button"
            onClick={goFullscreen}
            title="Pantalla completa"
            className="rounded-full border-2 border-[#2a2a2a] bg-[#141414] p-2.5 text-[#fafaf9]/60 transition hover:border-[#d3b26e] hover:text-[#d3b26e]"
          >
            <Expand size={18} />
          </button>
        </div>
      </header>

      {errorMessage ? (
        <p className="mt-6 rounded-2xl border-2 border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
          {errorMessage}
        </p>
      ) : null}

      {!loaded ? (
        <p className="mt-16 flex items-center justify-center gap-2 text-lg font-bold text-[#fafaf9]/50">
          <Loader2 className="animate-spin" size={22} /> Cargando pedidos…
        </p>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-[2rem] border-2 border-[#2a2a2a] bg-[#111111] p-5 sm:p-6">
            <h2 className="text-center text-xl font-black uppercase tracking-[0.18em] text-[#fafaf9]/60 sm:text-2xl">
              Preparando
            </h2>
            {preparing.length === 0 ? (
              <p className="mt-10 pb-6 text-center text-base font-bold text-[#fafaf9]/30">
                Sin pedidos en preparación
              </p>
            ) : (
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {preparing.map((order) => (
                  <OrderNumberCard key={order.id} number={order.number} name={order.name} ready={false} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border-4 border-[#d3b26e]/60 bg-[#111111] p-5 sm:p-6">
            <h2 className="text-center text-xl font-black uppercase tracking-[0.18em] text-[#d3b26e] sm:text-2xl">
              ¡Listo! Pasa a retirar
            </h2>
            {ready.length === 0 ? (
              <p className="mt-10 pb-6 text-center text-base font-bold text-[#fafaf9]/30">
                Aún no hay pedidos listos
              </p>
            ) : (
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {ready.map((order) => (
                  <OrderNumberCard key={order.id} number={order.number} name={order.name} ready />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <p className="mt-6 text-center text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#fafaf9]/25 print:hidden">
        Tu número está en la confirmación de tu pedido · Actualización automática
      </p>
    </main>
  )
}

export default function PantallaPage() {
  return (
    <ModuleAccessGuard moduleKey="tickets" moduleName="Pantalla de pedidos" chromeless>
      <PantallaContent />
    </ModuleAccessGuard>
  )
}
