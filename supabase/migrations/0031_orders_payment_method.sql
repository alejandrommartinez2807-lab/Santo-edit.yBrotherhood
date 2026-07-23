-- 0031: método de pago elegido por el CLIENTE al pedir (Pago móvil, Zelle,
-- "Mixto: X Bs … + Y $…"), distinto de payment_method_usd/ves que registra
-- caja al cobrar. Hasta ahora esta columna solo se LEÍA (order-payment,
-- order-status, anulación automática) pero nunca existió ni se escribía:
-- esos selects fallaban con 500 silencioso. El código ya degrada sin ella;
-- al aplicarla, los pedidos nuevos la llenan y se activan: precarga de
-- montos en el reporte de pago, precarga del cobro en caja, paso "Esperando
-- pago" y anulación automática por falta de pago.

alter table orders add column if not exists payment_method text;
