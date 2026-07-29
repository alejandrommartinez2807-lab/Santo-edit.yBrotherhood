-- 0036: Detalle estructurado de la anulación de un pedido.
--
-- Política del dueño (2026-07-29, cierra BH-SIM-005):
-- 1. Anular quita TODO el dinero del pedido, también del cierre de caja,
--    SALVO que el cajero indique que el dinero se quedó en la gaveta
--    (entonces cuenta en el cierre en una línea aparte, nunca como venta).
-- 2. Los anulados se ven en todo momento con su motivo, quién anuló, si los
--    insumos se consumieron y qué pasó con el dinero.
-- 3. Jamás se borra ni se vacía la información de un pedido anulado.
--
-- Hasta ahora el motivo viajaba SOLO concatenado en customer_note
-- ("ANULADO: … | Por: … | …") y en audit_logs: distinguir el ORIGEN exigía
-- parsear texto libre, y quién anuló no quedaba en el pedido. Estas columnas
-- guardan el dato estructurado; la nota se mantiene por compatibilidad con
-- la página pública de seguimiento y con cierres viejos.
--
-- El código escribe estas columnas con tolerancia a migración-no-aplicada
-- (reintento sin ellas), igual que 0022/0026/0031.

-- Origen de la anulación: 'automatico' (sistema, sin pago reportado),
-- 'personal' (staff desde caja/panel) o 'cliente' (seguimiento público).
alter table orders add column if not exists cancel_origin text;

-- Motivo tal cual se escribió. NULL en el caso "cliente que no dejó motivo":
-- la UI lo muestra como "no dejó motivo" (eso ES la información, nunca un
-- espacio en blanco).
alter table orders add column if not exists cancel_reason text;

-- Quién anuló (mismo trío que registered_by_* / charged_by_*, 0022).
-- Sistema: name='Sistema', role='system'. Cliente: role='public'.
alter table orders add column if not exists cancelled_by_id   text;
alter table orders add column if not exists cancelled_by_name text;
alter table orders add column if not exists cancelled_by_role text;

alter table orders add column if not exists cancelled_at timestamptz;

-- ¿Los insumos del pedido se consumieron? true = quedan descontados del
-- inventario; false = se devolvieron al stock; NULL = no se preguntó
-- (anulaciones viejas).
alter table orders add column if not exists cancel_inventory_used boolean;

-- Qué pasó con el dinero YA COBRADO al anular (NULL si no había cobro):
-- 'devuelto' = se le devolvió al cliente (sale del cierre y de reportes);
-- 'se_quedo' = quedó en la gaveta (cuenta en el cierre en línea aparte,
-- nunca como venta). El default de la app es 'devuelto' (supuesto del
-- 2026-07-29, pendiente de confirmación del dueño).
alter table orders add column if not exists cancel_refund text;

-- Monto (equivalente USD) que el pedido tenía cobrado al momento de anular:
-- el registro de la devolución (monto + autor cancelled_by_* + fecha
-- cancelled_at).
alter table orders add column if not exists cancel_refund_usd numeric;

-- La vista transversal de anulados del dueño filtra por estado; los lookups
-- son por id. No hace falta índice nuevo.
