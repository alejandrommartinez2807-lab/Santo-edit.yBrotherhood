-- ============================================================
-- Hotel · Fase 23: PAQUETES / TODO INCLUIDO
-- Producto que agrupa habitación + comidas + actividades a un precio. Al
-- aplicarlo a una estadía se carga su precio al folio. Migración ADITIVA.
-- ============================================================

create table if not exists packages (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  includes     text not null default '',   -- lista libre de lo que incluye
  price        numeric(12,2) not null default 0,
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_packages_branch on packages (branch_id, sort_order);

alter table packages enable row level security;
