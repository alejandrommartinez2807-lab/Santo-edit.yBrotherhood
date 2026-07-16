-- ============================================================
-- Hotel · P2-E: WEBHOOKS SALIENTES (integraciones)
--
-- webhooks = destinos HTTP a los que el hotel avisa cuando pasa algo:
--   reserva_creada · reserva_confirmada · pago_confirmado · checkin · checkout
-- events guarda la lista separada por comas (vacío = todos los eventos).
-- El cuerpo va firmado con HMAC-SHA256 del secreto (header x-hotel-signature).
-- Aditiva por branch_id. RLS on (acceso por service role).
-- ============================================================

create table if not exists webhooks (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  name           text not null default '',
  url            text not null default '',
  events         text not null default '',
  secret         text not null default '',
  active         boolean not null default true,
  last_status    text not null default '',
  last_fired_at  timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_webhooks_branch on webhooks (branch_id, active);

alter table webhooks enable row level security;
