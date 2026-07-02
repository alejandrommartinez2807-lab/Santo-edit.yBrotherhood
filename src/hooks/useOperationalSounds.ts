"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type SoundKind =
  | "newOrder"
  | "sendToKitchen"
  | "ready"
  | "deliveryReported"
  | "delivered"
  | "cancelled"
  | "alert"
  | "success"

type ModuleSoundContext = "cashier" | "kitchen" | "delivery"

type OrderLike = {
  id: string
  status?: string
  orderType?: string
  tableNumber?: string
  customerPhone?: string
  deliveryAddress?: string
  deliveryReference?: string
  deliveryZone?: string
  deliveryReportStatus?: string
  deliveryReportedAt?: string
  deliveryReportedBy?: string
}

type OperationalSoundsOptions = {
  adminPassword?: string
  storageKey?: string
}

type BusinessConfig = {
  soundsEnabled?: unknown
  soundEnabled?: unknown
  enableSounds?: unknown
  operationalSoundsEnabled?: unknown
}

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

const DEFAULT_STORAGE_KEY = "santo_perrito_operational_sounds_enabled"

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1

  const cleanValue = String(value ?? "")
    .trim()
    .toLowerCase()

  if (!cleanValue) return fallback

  if (
    ["true", "1", "si", "sí", "activo", "activa", "enabled", "on"].includes(
      cleanValue
    )
  ) {
    return true
  }

  if (
    [
      "false",
      "0",
      "no",
      "oculto",
      "oculta",
      "disabled",
      "off",
      "apagado",
      "apagada",
    ].includes(cleanValue)
  ) {
    return false
  }

  return fallback
}

function isDeliveryOrder(order: OrderLike) {
  return (
    order.orderType === "Delivery" ||
    String(order.tableNumber || "")
      .toLowerCase()
      .startsWith("delivery") ||
    Boolean(
      order.customerPhone ||
        order.deliveryAddress ||
        order.deliveryReference ||
        order.deliveryZone
    )
  )
}

function getAudioContext() {
  if (typeof window === "undefined") return null

  const AudioContextClass =
    window.AudioContext || (window as AudioWindow).webkitAudioContext

  if (!AudioContextClass) return null

  return new AudioContextClass()
}

function scheduleTone(
  audioContext: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  gainValue = 0.08
) {
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  const absoluteStart = audioContext.currentTime + startTime
  const absoluteEnd = absoluteStart + duration

  oscillator.type = "sine"
  oscillator.frequency.setValueAtTime(frequency, absoluteStart)

  gain.gain.setValueAtTime(0.0001, absoluteStart)
  gain.gain.exponentialRampToValueAtTime(gainValue, absoluteStart + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, absoluteEnd)

  oscillator.connect(gain)
  gain.connect(audioContext.destination)

  oscillator.start(absoluteStart)
  oscillator.stop(absoluteEnd + 0.02)
}

async function playSoundPattern(kind: SoundKind) {
  const audioContext = getAudioContext()

  if (!audioContext) return

  if (audioContext.state === "suspended") {
    await audioContext.resume()
  }

  if (kind === "newOrder") {
    scheduleTone(audioContext, 660, 0, 0.13)
    scheduleTone(audioContext, 880, 0.16, 0.16)
    return
  }

  if (kind === "sendToKitchen") {
    scheduleTone(audioContext, 520, 0, 0.12)
    scheduleTone(audioContext, 740, 0.14, 0.12)
    return
  }

  if (kind === "ready") {
    scheduleTone(audioContext, 780, 0, 0.12)
    scheduleTone(audioContext, 980, 0.13, 0.12)
    scheduleTone(audioContext, 1180, 0.26, 0.17)
    return
  }

  if (kind === "deliveryReported") {
    scheduleTone(audioContext, 523, 0, 0.12)
    scheduleTone(audioContext, 659, 0.14, 0.12)
    scheduleTone(audioContext, 784, 0.28, 0.16)
    return
  }

  if (kind === "delivered") {
    scheduleTone(audioContext, 620, 0, 0.1)
    scheduleTone(audioContext, 820, 0.12, 0.16)
    return
  }

  if (kind === "cancelled" || kind === "alert") {
    scheduleTone(audioContext, 260, 0, 0.16, 0.09)
    scheduleTone(audioContext, 220, 0.2, 0.18, 0.09)
    return
  }

  scheduleTone(audioContext, 720, 0, 0.12)
  scheduleTone(audioContext, 920, 0.14, 0.14)
}

function getOrderSnapshot(order: OrderLike) {
  return {
    status: String(order.status || ""),
    deliveryReportStatus: String(order.deliveryReportStatus || "Sin reportar"),
    deliveryReportedAt: String(order.deliveryReportedAt || ""),
  }
}

function getTransitionSound(
  moduleContext: ModuleSoundContext,
  previousSnapshot: ReturnType<typeof getOrderSnapshot> | undefined,
  nextOrder: OrderLike
): SoundKind | null {
  const nextSnapshot = getOrderSnapshot(nextOrder)
  const previousStatus = previousSnapshot?.status
  const nextStatus = nextSnapshot.status
  const previousDeliveryReportStatus = previousSnapshot?.deliveryReportStatus
  const nextDeliveryReportStatus = nextSnapshot.deliveryReportStatus
  const previousDeliveryReportedAt = previousSnapshot?.deliveryReportedAt
  const nextDeliveryReportedAt = nextSnapshot.deliveryReportedAt

  if (moduleContext === "delivery") {
    return null
  }

  if (moduleContext === "cashier") {
    if (!previousSnapshot && nextStatus === "Nuevo") return "newOrder"

    if (
      previousSnapshot &&
      previousStatus !== nextStatus &&
      nextStatus === "Nuevo"
    ) {
      return "newOrder"
    }

    if (
      previousSnapshot &&
      previousStatus !== nextStatus &&
      nextStatus === "Listo"
    ) {
      return "ready"
    }

    if (
      previousSnapshot &&
      isDeliveryOrder(nextOrder) &&
      nextDeliveryReportStatus === "Entrega reportada" &&
      (previousDeliveryReportStatus !== nextDeliveryReportStatus ||
        previousDeliveryReportedAt !== nextDeliveryReportedAt)
    ) {
      return "deliveryReported"
    }

    if (
      previousSnapshot &&
      previousStatus !== nextStatus &&
      nextStatus === "Entregado"
    ) {
      return "delivered"
    }

    if (
      previousSnapshot &&
      previousStatus !== nextStatus &&
      nextStatus === "Cancelado"
    ) {
      return "cancelled"
    }
  }

  if (moduleContext === "kitchen") {
    if (!previousSnapshot && nextStatus === "Preparando") return "sendToKitchen"

    if (
      previousSnapshot &&
      previousStatus !== nextStatus &&
      nextStatus === "Preparando"
    ) {
      return "sendToKitchen"
    }

    if (
      previousSnapshot &&
      previousStatus !== nextStatus &&
      nextStatus === "Cancelado"
    ) {
      return "cancelled"
    }
  }

  return null
}

export function useOperationalSounds({
  adminPassword = "",
  storageKey = DEFAULT_STORAGE_KEY,
}: OperationalSoundsOptions = {}) {
  const [userWantsSound, setUserWantsSound] = useState(false)
  const [businessAllowsSound, setBusinessAllowsSound] = useState(true)

  useEffect(() => {
    // Difiere la lectura un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(() => {
      try {
        setUserWantsSound(window.localStorage.getItem(storageKey) === "true")
      } catch {
        setUserWantsSound(false)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [storageKey])

  useEffect(() => {
    let isMounted = true

    async function loadBusinessSoundPreference() {
      if (!adminPassword) {
        if (isMounted) setBusinessAllowsSound(true)
        return
      }

      try {
        const response = await fetch("/api/business-config", {
          headers: {
            "x-admin-password": adminPassword,
          },
          cache: "no-store",
        })

        const data = await response.json()
        const config = (data.businessConfig ||
          data.config ||
          data ||
          {}) as BusinessConfig

        const rawSoundValue =
          config.soundEnabled ??
          config.soundsEnabled ??
          config.enableSounds ??
          config.operationalSoundsEnabled

        if (isMounted) {
          setBusinessAllowsSound(normalizeBoolean(rawSoundValue, true))
        }
      } catch {
        if (isMounted) setBusinessAllowsSound(true)
      }
    }

    loadBusinessSoundPreference()

    return () => {
      isMounted = false
    }
  }, [adminPassword])

  const saveSoundPreference = useCallback(
    (value: boolean) => {
      setUserWantsSound(value)

      try {
        window.localStorage.setItem(storageKey, String(value))
      } catch {
        // El sonido puede seguir funcionando durante la sesión aunque localStorage falle.
      }
    },
    [storageKey]
  )

  const activateSound = useCallback(async () => {
    if (!businessAllowsSound) return

    saveSoundPreference(true)

    try {
      await playSoundPattern("success")
    } catch {
      // Algunos navegadores piden un segundo intento manual.
    }
  }, [businessAllowsSound, saveSoundPreference])

  const deactivateSound = useCallback(() => {
    saveSoundPreference(false)
  }, [saveSoundPreference])

  const playSound = useCallback(
    async (kind: SoundKind) => {
      if (!userWantsSound || !businessAllowsSound) return

      try {
        await playSoundPattern(kind)
      } catch {
        // Si el navegador bloquea audio, la operación sigue sin romperse.
      }
    },
    [businessAllowsSound, userWantsSound]
  )

  return {
    isSoundEnabled: userWantsSound && businessAllowsSound,
    businessAllowsSound,
    activateSound,
    deactivateSound,
    playSound,
  }
}

export function useOrderSoundAlerts<TOrder extends OrderLike>(
  orders: TOrder[],
  options: {
    module: ModuleSoundContext
    enabled: boolean
    playSound: (kind: SoundKind) => void | Promise<void>
  }
) {
  const previousSnapshotsRef = useRef<Map<
    string,
    ReturnType<typeof getOrderSnapshot>
  > | null>(null)
  const lastSoundAtRef = useRef(0)

  useEffect(() => {
    const nextSnapshots = new Map(
      orders.map((order) => [order.id, getOrderSnapshot(order)] as const)
    )

    if (!options.enabled) {
      previousSnapshotsRef.current = nextSnapshots
      return
    }

    const previousSnapshots = previousSnapshotsRef.current

    if (!previousSnapshots) {
      previousSnapshotsRef.current = nextSnapshots
      return
    }

    let soundToPlay: SoundKind | null = null

    for (const order of orders) {
      const transitionSound = getTransitionSound(
        options.module,
        previousSnapshots.get(order.id),
        order
      )

      if (transitionSound) {
        soundToPlay = transitionSound
        break
      }
    }

    previousSnapshotsRef.current = nextSnapshots

    if (!soundToPlay) return

    const now = Date.now()

    if (now - lastSoundAtRef.current < 900) return

    lastSoundAtRef.current = now
    void options.playSound(soundToPlay)
  }, [orders, options])
}