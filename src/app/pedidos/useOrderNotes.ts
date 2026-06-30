import { useState, type Dispatch, type SetStateAction } from "react"

import {
  readApiResponse,
  type BusinessConfig,
  type LocalOrder,
} from "./domain"

// Modal de notas de pedido, extraído de PedidosPage. Depende del core de
// pedidos (setOrders/loadOrders) y de la config; se inyectan como parámetros.
// Sin cambios de comportamiento.
export function useOrderNotes(params: {
  adminPassword: string
  businessConfig: BusinessConfig
  setErrorMessage: (value: string | null) => void
  setOrders: Dispatch<SetStateAction<LocalOrder[]>>
  loadOrders: (password?: string, silent?: boolean) => Promise<void> | void
}) {
  const { adminPassword, businessConfig, setErrorMessage, setOrders, loadOrders } =
    params

  const [selectedNotesOrder, setSelectedNotesOrder] =
    useState<LocalOrder | null>(null)
  const [orderNoteDraft, setOrderNoteDraft] = useState("")
  const [orderNoteMessage, setOrderNoteMessage] = useState<string | null>(null)
  const [isSavingOrderNote, setIsSavingOrderNote] = useState(false)

  function openOrderNotesModal(order: LocalOrder) {
    if (!businessConfig.internalAllowEditOrderNotes) {
      setErrorMessage(
        "Editar notas está desactivado por el dueño en Configuración > Complejidad y permisos.",
      )
      return
    }

    setSelectedNotesOrder(order)
    setOrderNoteDraft(order.customerNote || "")
    setOrderNoteMessage(null)
  }

  async function saveOrderNote() {
    if (!adminPassword || !selectedNotesOrder) return

    if (!businessConfig.internalAllowEditOrderNotes) {
      setOrderNoteMessage(
        "Editar notas está desactivado por el dueño en Configuración > Complejidad y permisos.",
      )
      return
    }

    try {
      setIsSavingOrderNote(true)
      setOrderNoteMessage(null)
      setErrorMessage(null)

      const response = await fetch(`/api/orders/${selectedNotesOrder.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          action: "updateNotes",
          customerNote: orderNoteDraft,
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo actualizar la nota")
      }

      const updatedOrder = data.order as LocalOrder

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === updatedOrder.id ? updatedOrder : order,
        ),
      )
      setSelectedNotesOrder(updatedOrder)
      setOrderNoteDraft(updatedOrder.customerNote || "")
      setOrderNoteMessage("Nota actualizada correctamente.")

      window.setTimeout(() => {
        loadOrders(adminPassword, true)
      }, 600)
    } catch (error) {
      setOrderNoteMessage(
        error instanceof Error ? error.message : "No se pudo actualizar la nota",
      )
    } finally {
      setIsSavingOrderNote(false)
    }
  }

  return {
    selectedNotesOrder,
    setSelectedNotesOrder,
    orderNoteDraft,
    setOrderNoteDraft,
    orderNoteMessage,
    setOrderNoteMessage,
    isSavingOrderNote,
    openOrderNotesModal,
    saveOrderNote,
  }
}
