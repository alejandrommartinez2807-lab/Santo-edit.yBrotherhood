-- ============================================================
-- Santo Edit · Imagen adjunta al pedido
-- Migración: 0007_order_attachment
--
-- Permite que el cliente adjunte una imagen al registrar el pedido (ej.
-- comprobante o referencia visual). La imagen se guarda en el bucket
-- `order-attachments` de Storage y su URL queda en el propio pedido, para
-- mostrarse tanto en Caja como en el panel de Pedidos.
-- ============================================================

alter table orders
  add column if not exists attachment_image_url text;
