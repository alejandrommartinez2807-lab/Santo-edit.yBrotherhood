import { useEffect, useRef, useState, type MutableRefObject } from "react"

import {
  SOUND_STORAGE_KEY,
  isBusinessModuleEffective,
  playPanelSoundWithContext,
  type BusinessConfig,
  type PanelSoundKind,
} from "./domain"

// Subsistema de avisos sonoros del panel, extraído de PedidosPage para reducir
// el monolito. Encapsula el estado, los refs y los efectos del sonido; expone
// las mismas piezas que el componente ya usaba (mismos nombres).
export type PanelSound = {
  soundEnabled: boolean
  setSoundEnabled: (value: boolean) => void
  soundEnabledRef: MutableRefObject<boolean>
  soundMessage: string | null
  setSoundMessage: (value: string | null) => void
  playPanelSound: (kind: PanelSoundKind, force?: boolean) => void
  activatePanelSound: () => Promise<void>
  disablePanelSound: () => void
}

export function usePanelSound(
  businessConfigRef: MutableRefObject<BusinessConfig>,
): PanelSound {
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [soundMessage, setSoundMessage] = useState<string | null>(null)
  const soundEnabledRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  useEffect(() => {
    try {
      const savedSoundPreference =
        window.localStorage.getItem(SOUND_STORAGE_KEY)

      if (savedSoundPreference !== null) {
        const isSoundEnabled = savedSoundPreference === "true"

        setSoundEnabled(isSoundEnabled)
        soundEnabledRef.current = isSoundEnabled
      }
    } catch {
      soundEnabledRef.current = false
    }
  }, [])

  function getPanelAudioContext() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext

      if (!AudioContextClass) return null

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }

      return audioContextRef.current
    } catch {
      return null
    }
  }

  function playPanelSound(kind: PanelSoundKind, force = false) {
    const config = businessConfigRef.current

    if (
      !force &&
      (!isBusinessModuleEffective(config, "sounds") ||
        !config.soundEnabled ||
        !soundEnabledRef.current)
    ) {
      return
    }

    try {
      const audioContext = getPanelAudioContext()

      if (!audioContext) return

      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => undefined)
      }

      playPanelSoundWithContext(audioContext, kind)
    } catch {
      setSoundMessage(
        "El navegador bloqueó el sonido. Pulsa Activar sonido desde el panel.",
      )
    }
  }

  async function activatePanelSound() {
    if (!isBusinessModuleEffective(businessConfigRef.current, "sounds")) {
      setSoundMessage("Los avisos sonoros no están activos en este plan.")
      return
    }

    try {
      const audioContext = getPanelAudioContext()

      if (audioContext && audioContext.state === "suspended") {
        await audioContext.resume()
      }

      window.localStorage.setItem(SOUND_STORAGE_KEY, "true")
      setSoundEnabled(true)
      soundEnabledRef.current = true
      setSoundMessage("Avisos sonoros activos en este dispositivo.")
      playPanelSound("success", true)
    } catch {
      setSoundMessage(
        "No se pudo activar el sonido. Revisa permisos del navegador o vuelve a intentarlo.",
      )
    }
  }

  function disablePanelSound() {
    window.localStorage.setItem(SOUND_STORAGE_KEY, "false")
    setSoundEnabled(false)
    soundEnabledRef.current = false
    setSoundMessage("Avisos sonoros pausados en este dispositivo.")
  }

  return {
    soundEnabled,
    setSoundEnabled,
    soundEnabledRef,
    soundMessage,
    setSoundMessage,
    playPanelSound,
    activatePanelSound,
    disablePanelSound,
  }
}
