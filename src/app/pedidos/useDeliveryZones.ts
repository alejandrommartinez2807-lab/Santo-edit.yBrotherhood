import { useState, type MutableRefObject } from "react"

import {
  DEFAULT_DELIVERY_ZONES,
  isBusinessModuleEffective,
  normalizeComparableText,
  normalizeDeliveryZones,
  readApiResponse,
  type BusinessConfig,
  type DeliveryZone,
} from "./domain"

// Subsistema de zonas de delivery, extraído de PedidosPage. Encapsula el estado
// del modal/listado y las operaciones (cargar, editar, agregar, quitar, guardar).
// Sin cambios de comportamiento: mismos nombres expuestos vía el objeto de retorno.
export function useDeliveryZones(params: {
  adminPassword: string
  businessConfigRef: MutableRefObject<BusinessConfig>
}) {
  const { adminPassword, businessConfigRef } = params

  const [isDeliveryZonesModalOpen, setIsDeliveryZonesModalOpen] =
    useState(false)
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>(
    DEFAULT_DELIVERY_ZONES,
  )
  const [newDeliveryZoneName, setNewDeliveryZoneName] = useState("")
  const [newDeliveryZoneCost, setNewDeliveryZoneCost] = useState("")
  const [deliveryZonesMessage, setDeliveryZonesMessage] = useState<
    string | null
  >(null)
  const [isLoadingDeliveryZones, setIsLoadingDeliveryZones] = useState(false)
  const [isSavingDeliveryZones, setIsSavingDeliveryZones] = useState(false)

  async function loadDeliveryZones(silent = false) {
    if (!isBusinessModuleEffective(businessConfigRef.current, "delivery")) {
      setDeliveryZones([])
      return
    }

    if (!silent) {
      setIsLoadingDeliveryZones(true)
    }

    try {
      const response = await fetch("/api/delivery-zones", {
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudieron cargar las zonas de delivery",
        )
      }

      const cleanZones = normalizeDeliveryZones(data.deliveryZones)

      setDeliveryZones(cleanZones.length ? cleanZones : DEFAULT_DELIVERY_ZONES)
    } catch (error) {
      setDeliveryZonesMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las zonas de delivery",
      )
    } finally {
      if (!silent) {
        setIsLoadingDeliveryZones(false)
      }
    }
  }

  function updateDeliveryZoneName(index: number, name: string) {
    setDeliveryZones((currentZones) =>
      currentZones.map((zone, zoneIndex) =>
        zoneIndex === index ? { ...zone, name } : zone,
      ),
    )
    setDeliveryZonesMessage("Cambio pendiente por guardar.")
  }

  function updateDeliveryZoneCost(index: number, cost: string) {
    const normalizedCost = cost.replace(",", ".")

    setDeliveryZones((currentZones) =>
      currentZones.map((zone, zoneIndex) =>
        zoneIndex === index
          ? { ...zone, costUSD: Number(normalizedCost) }
          : zone,
      ),
    )
    setDeliveryZonesMessage("Cambio pendiente por guardar.")
  }

  function addDeliveryZone() {
    const name = newDeliveryZoneName.trim()
    const costUSD = Number(newDeliveryZoneCost.replace(",", "."))

    if (!name) {
      setDeliveryZonesMessage("Escribe el nombre de la zona.")
      return
    }

    if (!Number.isFinite(costUSD) || costUSD < 0) {
      setDeliveryZonesMessage("Escribe un precio de delivery válido.")
      return
    }

    const alreadyExists = deliveryZones.some(
      (zone) =>
        normalizeComparableText(zone.name) === normalizeComparableText(name),
    )

    if (alreadyExists) {
      setDeliveryZonesMessage("Esa zona ya existe.")
      return
    }

    setDeliveryZones((currentZones) => [
      ...currentZones,
      { name, costUSD, isActive: true },
    ])
    setNewDeliveryZoneName("")
    setNewDeliveryZoneCost("")
    setDeliveryZonesMessage("Zona agregada. Presiona guardar para publicarla.")
  }

  function removeDeliveryZone(indexToRemove: number) {
    if (deliveryZones.length <= 1) {
      setDeliveryZonesMessage("Debe quedar al menos una zona de delivery.")
      return
    }

    setDeliveryZones((currentZones) =>
      currentZones.filter((_, index) => index !== indexToRemove),
    )
    setDeliveryZonesMessage(
      "Zona eliminada. Presiona guardar para publicar el cambio.",
    )
  }

  function restoreDefaultDeliveryZones() {
    setDeliveryZones(DEFAULT_DELIVERY_ZONES)
    setDeliveryZonesMessage(
      "Zonas base restauradas. Presiona guardar para publicarlas.",
    )
  }

  async function saveDeliveryZones() {
    if (!adminPassword) return

    if (!isBusinessModuleEffective(businessConfigRef.current, "delivery")) {
      setDeliveryZonesMessage("Delivery no está activo en este plan.")
      return
    }

    const cleanZones = normalizeDeliveryZones(deliveryZones)

    if (!cleanZones.length) {
      setDeliveryZonesMessage("Debes dejar al menos una zona de delivery.")
      return
    }

    try {
      setIsSavingDeliveryZones(true)
      setDeliveryZonesMessage(null)

      const response = await fetch("/api/delivery-zones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ deliveryZones: cleanZones }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudieron guardar las zonas de delivery",
        )
      }

      const savedZones = normalizeDeliveryZones(data.deliveryZones)

      setDeliveryZones(savedZones.length ? savedZones : cleanZones)
      setDeliveryZonesMessage("Zonas de delivery guardadas correctamente.")
    } catch (error) {
      setDeliveryZonesMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar las zonas de delivery",
      )
    } finally {
      setIsSavingDeliveryZones(false)
    }
  }

  return {
    isDeliveryZonesModalOpen,
    setIsDeliveryZonesModalOpen,
    deliveryZones,
    setDeliveryZones,
    newDeliveryZoneName,
    setNewDeliveryZoneName,
    newDeliveryZoneCost,
    setNewDeliveryZoneCost,
    deliveryZonesMessage,
    setDeliveryZonesMessage,
    isLoadingDeliveryZones,
    isSavingDeliveryZones,
    loadDeliveryZones,
    updateDeliveryZoneName,
    updateDeliveryZoneCost,
    addDeliveryZone,
    removeDeliveryZone,
    restoreDefaultDeliveryZones,
    saveDeliveryZones,
  }
}
