// Acciones de la bitácora de auditoría + etiquetas legibles. Sin imports de
// servidor para poder usarse también desde componentes cliente (filtros de UI).

export type AuditAction =
  | "order.payment.updated"
  | "order.status.updated"
  | "order.delivery.reported"
  | "order.staff.confirmed"
  | "order.staff.reset"
  | "order.item.delivered"
  | "order.deleted"
  | "open_account.order.attached"
  | "open_account.order.status.updated"
  | "open_account.payment.updated"
  | "open_account.closed"
  | "payment_proof.created"
  | "payment_proof.reviewed"
  | "day_close.saved"
  | "supplier_purchase.created"
  | "supplier_purchase.updated"
  | "supplier_purchase.deleted"
  | "supplier_purchase.payment.created"
  | "inventory.transferred"
  | "inventory.restock.notified"
  | "business_config.updated"
  | "staff.created"
  | "staff.updated"
  | "staff.deleted"

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "order.payment.updated": "Cobro de pedido actualizado",
  "order.status.updated": "Estado de pedido actualizado",
  "order.delivery.reported": "Delivery reportado",
  "order.staff.confirmed": "Ítem confirmado por personal",
  "order.staff.reset": "Confirmación de personal revertida",
  "order.item.delivered": "Producto marcado como entregado",
  "order.deleted": "Pedido eliminado",
  "open_account.order.attached": "Pedido sumado a cuenta abierta",
  "open_account.order.status.updated": "Estado en cuenta abierta actualizado",
  "open_account.payment.updated": "Cobro en cuenta abierta actualizado",
  "open_account.closed": "Cuenta abierta cerrada",
  "payment_proof.created": "Comprobante de pago enviado",
  "payment_proof.reviewed": "Comprobante de pago revisado",
  "day_close.saved": "Cierre de día guardado",
  "supplier_purchase.created": "Compra a proveedor registrada",
  "supplier_purchase.updated": "Compra a proveedor editada",
  "supplier_purchase.deleted": "Compra a proveedor eliminada",
  "supplier_purchase.payment.created": "Abono a proveedor registrado",
  "inventory.transferred": "Inventario transferido entre sedes",
  "inventory.restock.notified": "Aviso de reposición enviado a dueños",
  "business_config.updated": "Configuración del negocio actualizada",
  "staff.created": "Usuario de personal creado",
  "staff.updated": "Usuario de personal editado",
  "staff.deleted": "Usuario de personal eliminado",
}
