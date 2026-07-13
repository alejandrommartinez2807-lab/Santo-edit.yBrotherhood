-- ============================================================
-- Hotel · Fase 19: CRM DE HUÉSPEDES
-- Ficha de relación con el huésped: etiquetas, VIP y notas, indexada por
-- teléfono. Migración ADITIVA por branch_id.
-- ============================================================

create table if not exists guest_profiles (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id) on delete cascade,
  full_name    text not null default '',
  phone        text not null default '',
  email        text not null default '',
  tags         text not null default '',
  vip          boolean not null default false,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_guest_profiles_branch on guest_profiles (branch_id, full_name);
create index if not exists idx_guest_profiles_phone on guest_profiles (branch_id, phone);

alter table guest_profiles enable row level security;
