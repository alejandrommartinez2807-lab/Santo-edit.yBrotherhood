"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"

// Detecta comprobantes de pago NUEVOS en la lista que la página ya trae por
// polling y dispara una alerta notoria (sonido + toast). No hace fetch propio:
// recibe los proofs del caller (pedidos/caja los refrescan cada ~10 s).

export type PaymentProofAlertLike = {
  id: string
  orderId?: string
  status?: string
  customerName?: string
  amountReportedUSD?: number
  amountReportedVES?: number
  createdAt?: string
}

export type NewPaymentProofAlert = {
  proofId: string
  orderId: string
  customerName: string
  amountReportedUSD: number
  amountReportedVES: number
}

// Solo se avisa por comprobantes recién llegados: al abrir el panel no deben
// sonar los históricos, pero sí uno que entró mientras la página cargaba.
const FRESH_PROOF_WINDOW_MS = 10 * 60 * 1000

function isPendingProof(proof: PaymentProofAlertLike) {
  return String(proof.status || "") === "Comprobante enviado"
}

function isFreshProof(proof: PaymentProofAlertLike, now: number) {
  const createdAt = new Date(String(proof.createdAt || "")).getTime()
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false
  return now - createdAt <= FRESH_PROOF_WINDOW_MS
}

export function usePaymentProofAlerts(
  proofs: PaymentProofAlertLike[],
  options: {
    enabled: boolean
    onNewProof?: (alert: NewPaymentProofAlert) => void
  },
) {
  const [newProofAlert, setNewProofAlert] = useState<NewPaymentProofAlert | null>(null)
  const knownProofIdsRef = useRef<Set<string> | null>(null)
  const lastAlertAtRef = useRef(0)
  const emitNewProof = useEffectEvent((alert: NewPaymentProofAlert) => {
    setNewProofAlert(alert)
    options.onNewProof?.(alert)
  })

  const pendingProofsCount = useMemo(
    () => proofs.filter(isPendingProof).length,
    [proofs],
  )

  useEffect(() => {
    const nextIds = new Set(proofs.map((proof) => String(proof.id || "")).filter(Boolean))

    if (!options.enabled) {
      knownProofIdsRef.current = nextIds
      return
    }

    const knownIds = knownProofIdsRef.current
    knownProofIdsRef.current = nextIds

    // Primera carga: es la línea base, no se avisa por lo histórico.
    if (!knownIds) return

    const now = Date.now()
    const incomingProof = proofs.find(
      (proof) =>
        proof.id &&
        !knownIds.has(String(proof.id)) &&
        isPendingProof(proof) &&
        isFreshProof(proof, now),
    )

    if (!incomingProof) return

    // Anti-ráfaga: si llegan varios en el mismo tick, un solo aviso.
    if (now - lastAlertAtRef.current < 1500) return
    lastAlertAtRef.current = now

    emitNewProof({
      proofId: String(incomingProof.id),
      orderId: String(incomingProof.orderId || ""),
      customerName: String(incomingProof.customerName || "").trim() || "Cliente",
      amountReportedUSD: Number(incomingProof.amountReportedUSD || 0),
      amountReportedVES: Number(incomingProof.amountReportedVES || 0),
    })
  }, [proofs, options.enabled])

  return {
    pendingProofsCount,
    newProofAlert,
    dismissNewProofAlert: () => setNewProofAlert(null),
  }
}
