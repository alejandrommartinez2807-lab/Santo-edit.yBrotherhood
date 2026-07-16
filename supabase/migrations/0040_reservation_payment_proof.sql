-- ============================================================
-- Hotel · P1-A (cobro online): captura del comprobante en los
-- depósitos de reserva que el huésped reporta desde su teléfono.
--
-- Aditivo y seguro (defaults vacíos): el registro de depósitos SIN
-- imagen no cambia; estas columnas solo se llenan cuando el huésped
-- adjunta la captura del pago móvil / Zelle / transferencia.
-- ============================================================

alter table reservation_payments
  add column if not exists proof_image_url text not null default '',
  add column if not exists proof_file_id   text not null default '',
  add column if not exists proof_file_name text not null default '';
