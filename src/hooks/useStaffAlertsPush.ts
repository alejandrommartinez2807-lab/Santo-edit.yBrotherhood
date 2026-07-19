"use client"

import { useEffect, useEffectEvent, useState } from "react"

// Interruptor "alertas de anulación en este equipo" para dueño/encargado.
// Reutiliza el web push del seguimiento público (claves VAPID + service
// worker ya registrado): el servidor guarda la suscripción bajo el order_id
// reservado "staff-alerts" y avisa cuando un pedido se anula, aunque el
// teléfono esté bloqueado.

export type StaffAlertsPushState = "unknown" | "unavailable" | "off" | "on" | "working"

const STORAGE_KEY = "santo_staff_cancel_alerts_enabled"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

function canUsePush() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

// iPhone/iPad: el push web solo existe si la página está agregada a la
// pantalla de inicio y se abre desde el ícono (iOS 16.4+). Además ese
// "Agregar a pantalla de inicio" que habilita el push vive en Safari, no en
// Chrome. Detectamos el caso para dar los pasos exactos en vez del genérico.
function isIOS() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS se hace pasar por Mac; se distingue por la pantalla táctil.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function isInstalledStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// Mensaje a medida para el caso más común de fallo en iPhone: el dueño abrió
// la página en el navegador (o en Chrome) sin agregarla a inicio desde Safari.
const IOS_HELP_MESSAGE =
  "En iPhone las notificaciones SOLO funcionan desde Safari (no desde Chrome). " +
  "1) Abre esta página en Safari. " +
  "2) Toca el botón Compartir (el cuadro con la flecha ↑ abajo). " +
  "3) Desliza y toca “Agregar a pantalla de inicio”. " +
  "4) Abre la app desde el ícono nuevo y toca este botón otra vez. " +
  "Necesitas iPhone con iOS 16.4 o superior."

export function useStaffAlertsPush(adminPassword: string, enabled: boolean) {
  const [state, setState] = useState<StaffAlertsPushState>("unknown")
  const [message, setMessage] = useState("")

  const initialize = useEffectEvent(() => {
    if (!enabled) return
    if (!canUsePush()) {
      setState("unavailable")
      // En iPhone fuera de la app instalada el push no existe: adelantamos los
      // pasos de Safari para que el dueño no crea que está roto.
      if (isIOS() && !isInstalledStandalone()) {
        setMessage(IOS_HELP_MESSAGE)
      }
      return
    }

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) === "1"
      setState(saved && Notification.permission === "granted" ? "on" : "off")
    } catch {
      setState("off")
    }
  })

  useEffect(() => {
    const timer = setTimeout(initialize, 0)
    return () => clearTimeout(timer)
  }, [enabled])

  async function toggle() {
    if (state === "working" || !adminPassword) return

    // Navegador sin soporte de push: en vez de esconder la opción, se
    // explica qué usar (pasaba con navegadores "genéricos" y WebViews).
    if (state === "unavailable") {
      setMessage(
        isIOS()
          ? IOS_HELP_MESSAGE
          : "Este navegador no soporta notificaciones push. Abre la página en Chrome (Android) o instálala como app (menú del navegador → “Agregar a pantalla principal” / “Instalar app”) y actívalas desde ahí. En iPhone abre en Safari y agrégala a la pantalla de inicio.",
      )
      return
    }

    setMessage("")
    setState("working")

    try {
      if (state === "on") {
        // Apagar: borra la suscripción del servidor; la del navegador se
        // conserva (podría estar en uso por otros avisos del mismo origen).
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
          await fetch("/api/staff/alerts-push", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "x-admin-password": adminPassword,
            },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          })
        }

        window.localStorage.setItem(STORAGE_KEY, "0")
        setState("off")
        setMessage("Este equipo ya no recibirá alertas de anulación.")
        return
      }

      const permission = await Notification.requestPermission()

      if (permission !== "granted") {
        setState("off")
        setMessage(
          "El navegador no dio el permiso de notificaciones. Revisa: 1) el candado junto a la dirección → Permisos → Notificaciones → Permitir; 2) en Android, Ajustes del teléfono → Aplicaciones → Chrome → Notificaciones activadas; 3) que el teléfono no esté en “No molestar”. Luego toca el botón de nuevo.",
        )
        return
      }

      const keyResponse = await fetch("/api/staff/alerts-push", {
        headers: { "x-admin-password": adminPassword },
        cache: "no-store",
      })
      const keyData = await keyResponse.json().catch(() => ({}))

      if (!keyResponse.ok || !keyData?.enabled || !keyData.publicKey) {
        setState("unavailable")
        setMessage(
          keyData?.error ||
            "Las notificaciones push no están configuradas en el servidor (claves VAPID).",
        )
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(String(keyData.publicKey)),
        }))

      const saveResponse = await fetch("/api/staff/alerts-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      const saveData = await saveResponse.json().catch(() => ({}))

      if (!saveResponse.ok) {
        throw new Error(saveData?.error || "No se pudo guardar la suscripción")
      }

      window.localStorage.setItem(STORAGE_KEY, "1")
      setState("on")
      setMessage(
        "Listo: si se anula un pedido, este equipo recibe la alerta aunque la app esté cerrada.",
      )
    } catch (error) {
      setState("off")
      setMessage(
        error instanceof Error ? error.message : "No se pudo activar la alerta en este equipo",
      )
    }
  }

  return { state, message, toggle }
}
