// Leyenda de los documentos de cobro del centro comercial.
//
// Mientras el negocio NO esté fiscalizado (business_config.fiscalEnabled = false,
// el default), TODO lo que se entrega al cliente es un RECIBO no fiscal: sirve
// como comprobante de pago pero no es una factura ante el SENIAT. El documento
// fiscal, cuando corresponda, lo emite la máquina fiscal homologada.
//
// Toda la base fiscal ya existe (fiscalEnabled, rifNumber, fiscalAddress, cálculo
// de IVA/IGTF): al activar fiscalEnabled, esta leyenda desaparece sola y el
// sistema queda listo para el flujo de factura. Único interruptor, una fuente.

export const NON_FISCAL_LEGEND =
  "Recibo — documento no fiscal. No es una factura. El comprobante fiscal, si aplica, lo emite la máquina fiscal."

// Devuelve la leyenda a mostrar en un recibo/comprobante. Vacío si el negocio
// ya está fiscalizado (entonces el documento fiscal lo maneja la máquina fiscal).
export function receiptLegend(fiscalEnabled: boolean): string {
  return fiscalEnabled ? "" : NON_FISCAL_LEGEND
}

// true = todavía se emiten recibos no fiscales (estado por defecto).
export function isNonFiscal(fiscalEnabled: boolean): boolean {
  return fiscalEnabled !== true
}
