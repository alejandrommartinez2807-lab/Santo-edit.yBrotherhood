-- ============================================================
-- Hotel · Fase 11: PÁGINA PÚBLICA DEL HOTEL (landing)
-- Contenido de la landing: titular, descripción, amenidades, políticas y
-- contacto. Una fila por propiedad. Migración ADITIVA por branch_id.
-- ============================================================

create table if not exists hotel_profile (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  headline       text not null default '',
  about          text not null default '',
  amenities      text not null default '',
  address        text not null default '',
  phone          text not null default '',
  email          text not null default '',
  checkin_time   text not null default '15:00',
  checkout_time  text not null default '12:00',
  updated_at     timestamptz not null default now()
);

create index if not exists idx_hotel_profile_branch on hotel_profile (branch_id);

alter table hotel_profile enable row level security;
