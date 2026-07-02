-- ============================================================
-- Santo Edit · Reservas (Fase 5)
-- Migración: 0019_reservations
--
-- Reservas por sucursal + mesa + franja horaria. La mesa se guarda por
-- table_id (id de la mesa en businessConfig.localTables) más un snapshot
-- del nombre, porque las mesas viven en la configuración y no en SQL.
-- El solape de franjas se valida en la capa de aplicación
-- (src/lib/reservationConflicts.ts); aquí solo persistimos.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists reservations (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  table_id         text not null default '',
  table_name       text not null default '',
  customer_name    text not null,
  customer_phone   text not null default '',
  party_size       integer not null default 2,
  reservation_date date not null,
  start_time       text not null,  -- "HH:MM" (24h, hora local del negocio)
  end_time         text not null,  -- "HH:MM"
  status           text not null default 'activa', -- activa | completada | cancelada | no_show
  note             text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_reservations_branch_date
  on reservations (branch_id, reservation_date);

-- RLS: cerrado por defecto (solo el servidor con service role key).
alter table reservations enable row level security;
