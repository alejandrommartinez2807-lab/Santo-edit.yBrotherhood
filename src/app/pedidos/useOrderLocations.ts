import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react"

import {
  DEFAULT_ORDER_LOCATIONS,
  LOCATIONS_STORAGE_KEY,
  buildLocalTablesFromNames,
  getActiveLocalTableNames,
  normalizeBusinessConfig,
  normalizeComparableText,
  readApiResponse,
  type BusinessConfig,
} from "./domain"

// Subsistema de mesas/ubicaciones de pedido, extraído de PedidosPage. Las mesas
// se persisten dentro de business_config (localTables), por eso el hook recibe
// el setter y el ref de la config. Sin cambios de comportamiento.
export function useOrderLocations(params: {
  adminPassword: string
  businessConfigRef: MutableRefObject<BusinessConfig>
  setBusinessConfig: Dispatch<SetStateAction<BusinessConfig>>
}) {
  const { adminPassword, businessConfigRef, setBusinessConfig } = params

  const [isLocationsModalOpen, setIsLocationsModalOpen] = useState(false)
  const [orderLocations, setOrderLocations] = useState<string[]>(
    DEFAULT_ORDER_LOCATIONS,
  )
  const [newLocationName, setNewLocationName] = useState("")
  const [locationsMessage, setLocationsMessage] = useState<string | null>(null)
  const [isSavingLocations, setIsSavingLocations] = useState(false)

  async function saveOrderLocations(nextLocations: string[], message?: string) {
    const cleanLocations = Array.from(
      new Set(nextLocations.map((location) => location.trim()).filter(Boolean)),
    )

    const finalLocations =
      cleanLocations.length > 0 ? cleanLocations : DEFAULT_ORDER_LOCATIONS
    const nextLocalTables = buildLocalTablesFromNames(
      finalLocations,
      businessConfigRef.current.localTables,
    )
    const previousConfig = businessConfigRef.current
    const optimisticConfig = {
      ...previousConfig,
      localTables: nextLocalTables,
    }

    setIsSavingLocations(true)
    setOrderLocations(finalLocations)
    setBusinessConfig(optimisticConfig)
    businessConfigRef.current = optimisticConfig
    setLocationsMessage("Guardando mesas en configuración...")

    try {
      const response = await fetch("/api/business-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          businessConfig: {
            localTables: nextLocalTables,
          },
        }),
      })
      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron guardar las mesas")
      }

      const savedConfig = normalizeBusinessConfig(
        data.businessConfig || data.config || optimisticConfig,
      )
      setBusinessConfig(savedConfig)
      businessConfigRef.current = savedConfig
      setOrderLocations(getActiveLocalTableNames(savedConfig.localTables))
      window.localStorage.setItem(
        LOCATIONS_STORAGE_KEY,
        JSON.stringify(getActiveLocalTableNames(savedConfig.localTables)),
      )
      setLocationsMessage(message || "Mesas guardadas en configuración.")
    } catch (error) {
      setBusinessConfig(previousConfig)
      businessConfigRef.current = previousConfig
      setOrderLocations(getActiveLocalTableNames(previousConfig.localTables))
      setLocationsMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar las mesas",
      )
    } finally {
      setIsSavingLocations(false)
    }
  }

  async function addOrderLocation() {
    const nextLocation = newLocationName.trim()

    if (!nextLocation) {
      setLocationsMessage("Escribe el nombre de la mesa o ubicación.")
      return
    }

    const alreadyExists = orderLocations.some(
      (location) =>
        normalizeComparableText(location) ===
        normalizeComparableText(nextLocation),
    )

    if (alreadyExists) {
      setLocationsMessage("Esa mesa o ubicación ya existe.")
      return
    }

    await saveOrderLocations(
      [...orderLocations, nextLocation],
      "Mesa agregada y guardada correctamente.",
    )
    setNewLocationName("")
  }

  async function removeOrderLocation(locationToRemove: string) {
    if (orderLocations.length <= 1) {
      setLocationsMessage(
        "Debe quedar al menos una mesa o ubicación disponible.",
      )
      return
    }

    await saveOrderLocations(
      orderLocations.filter((location) => location !== locationToRemove),
      "Mesa eliminada y guardada correctamente.",
    )
  }

  async function restoreDefaultOrderLocations() {
    await saveOrderLocations(
      DEFAULT_ORDER_LOCATIONS,
      "Mesas base restauradas correctamente.",
    )
    setNewLocationName("")
  }

  return {
    isLocationsModalOpen,
    setIsLocationsModalOpen,
    orderLocations,
    setOrderLocations,
    newLocationName,
    setNewLocationName,
    locationsMessage,
    setLocationsMessage,
    isSavingLocations,
    saveOrderLocations,
    addOrderLocation,
    removeOrderLocation,
    restoreDefaultOrderLocations,
  }
}
