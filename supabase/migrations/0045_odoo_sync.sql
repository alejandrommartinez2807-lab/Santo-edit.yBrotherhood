-- ============================================================
-- Hotel · V8-A: CONECTOR ODOO (complementar Odoo, no competir)
--
-- odoo_integration = la conexión a Odoo del negocio (una fila por branch):
--   URL, base de datos, usuario y API KEY. La API key es un SECRETO: esta tabla
--   solo la toca el service role (RLS on, sin políticas públicas). NUNCA va en
--   business_config (que se sirve al público).
-- odoo_sync_map    = mapeo idempotente: por cada registro local (huésped,
--   producto, factura, pago) guarda su id en Odoo + un hash del contenido, para
--   crear los nuevos, actualizar los cambiados y saltar los iguales. Así el
--   "Sincronizar ahora" no duplica nada aunque se corra mil veces.
-- Aditiva por branch_id. RLS on (acceso solo por service role).
-- ============================================================

create table if not exists odoo_integration (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  base_url      text not null default '',
  db_name       text not null default '',
  login         text not null default '',
  api_key       text not null default '',
  active        boolean not null default false,
  live_sync     boolean not null default false,
  last_uid      integer,
  last_sync_at  timestamptz,
  last_result   text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists idx_odoo_integration_branch on odoo_integration (branch_id);

create table if not exists odoo_sync_map (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  local_type    text not null default '',   -- 'guest' | 'product' | 'invoice' | 'payment' | 'reservation'
  local_id      text not null default '',
  odoo_model    text not null default '',    -- 'res.partner' | 'product.product' | 'account.move' | ...
  odoo_id       integer not null,
  record_hash   text not null default '',
  synced_at     timestamptz not null default now()
);
create unique index if not exists idx_odoo_sync_map_local
  on odoo_sync_map (branch_id, local_type, local_id);
create index if not exists idx_odoo_sync_map_model
  on odoo_sync_map (branch_id, odoo_model, odoo_id);

alter table odoo_integration enable row level security;
alter table odoo_sync_map enable row level security;
