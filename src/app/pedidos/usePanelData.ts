import { useState, type MutableRefObject } from "react"

import type { OpenAccount } from "@/types/localOrders"

import {
  isBusinessModuleEffective,
  readApiResponse,
  type BusinessConfig,
  type OpenAccountsApiResponse,
  type PaymentProof,
} from "./domain"

// Loaders de paneles secundarios (comprobantes y cuentas abiertas) extraídos de
// PedidosPage. Cada uno gateado por su módulo. Sin cambios de comportamiento.

export function usePaymentProofs(params: {
  adminPassword: string
  businessConfigRef: MutableRefObject<BusinessConfig>
}) {
  const { adminPassword, businessConfigRef } = params
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([])
  const [paymentProofsMessage, setPaymentProofsMessage] = useState<
    string | null
  >(null)

  async function loadPaymentProofs(password = adminPassword, silent = false) {
    if (!password) return

    if (
      !isBusinessModuleEffective(businessConfigRef.current, "paymentProofs")
    ) {
      setPaymentProofs([])
      setPaymentProofsMessage(null)
      return
    }

    try {
      const response = await fetch("/api/payment-proofs", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        if (response.status === 403) {
          setPaymentProofs([])
          setPaymentProofsMessage(null)
          return
        }

        throw new Error(data.error || "No se pudieron cargar los comprobantes")
      }

      setPaymentProofs(
        Array.isArray(data.paymentProofs) ? data.paymentProofs : [],
      )
      setPaymentProofsMessage(null)
    } catch (error) {
      if (!silent) {
        setPaymentProofsMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los comprobantes",
        )
      }
    }
  }

  return {
    paymentProofs,
    setPaymentProofs,
    paymentProofsMessage,
    setPaymentProofsMessage,
    loadPaymentProofs,
  }
}

export function useOpenAccounts(params: {
  adminPassword: string
  businessConfigRef: MutableRefObject<BusinessConfig>
}) {
  const { adminPassword, businessConfigRef } = params
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([])
  const [openAccountsMessage, setOpenAccountsMessage] = useState<string | null>(
    null,
  )

  async function loadOpenAccounts(password = adminPassword, silent = true) {
    if (!password) return

    if (!isBusinessModuleEffective(businessConfigRef.current, "openAccounts")) {
      setOpenAccounts([])
      setOpenAccountsMessage(null)
      return
    }

    try {
      const response = await fetch("/api/open-accounts?status=all", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      })

      const data = (await readApiResponse(response)) as OpenAccountsApiResponse

      if (!response.ok) {
        if (response.status === 403) {
          setOpenAccounts([])
          setOpenAccountsMessage(null)
          return
        }

        throw new Error(
          data.error || "No se pudieron cargar las cuentas abiertas",
        )
      }

      setOpenAccounts(Array.isArray(data.openAccounts) ? data.openAccounts : [])
      setOpenAccountsMessage(null)
    } catch (error) {
      setOpenAccounts([])

      if (!silent) {
        setOpenAccountsMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las cuentas abiertas",
        )
      }
    }
  }

  return {
    openAccounts,
    setOpenAccounts,
    openAccountsMessage,
    setOpenAccountsMessage,
    loadOpenAccounts,
  }
}
