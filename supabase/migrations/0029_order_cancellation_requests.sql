-- 0029: Anulación con código del dueño (Brotherhood, pedido 2026-07-21).
--
-- El trabajador pide anular con motivo; se genera un código de un solo uso
-- que SOLO ve el dueño (push a sus equipos / su panel / WhatsApp cuando esté
-- conectado). El trabajador no puede anular sin ese código.
--
-- El código se guarda en claro a propósito: el dueño necesita leerlo para
-- dictarlo, la tabla es solo service-role (RLS cerrada), es de un solo uso y
-- expira a las 2 horas.

create table if not exists order_cancellation_requests (
  id text primary key,
  order_id text not null,
  branch_id text,
  display_number text not null default '',
  reason text not null,
  requested_by text not null default '',
  code text not null,
  status text not null default 'pending', -- pending | used | expired
  -- Lo marca el trabajador al anular: ¿los ingredientes ya se usaron?
  -- (si NO se usaron, el sistema devuelve el consumo al inventario).
  inventory_was_used boolean,
  inventory_reverted_count integer not null default 0,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists idx_order_cancellation_requests_order
  on order_cancellation_requests(order_id);

-- Una sola solicitud pendiente por pedido: dos clics simultáneos no pueden
-- crear dos códigos distintos (el segundo insert falla y el API reusa la
-- solicitud ganadora, así el dueño siempre dicta UN solo código).
create unique index if not exists uq_order_cancellation_pending_per_order
  on order_cancellation_requests(order_id)
  where status = 'pending';

create index if not exists idx_order_cancellation_requests_status
  on order_cancellation_requests(status, created_at desc);

alter table order_cancellation_requests enable row level security;
-- Sin policies: solo el service role (API del servidor) puede leer/escribir.
