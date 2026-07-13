-- ============================================================
-- Hotel · Fase 20 (parcial): BLOQUEOS DE HABITACIÓN
--
-- Bloquea una habitación por un rango de fechas (mantenimiento largo, evento,
-- reforma) para que NO se pueda reservar en la web ni asignar. A diferencia de
-- rooms.out_of_service (bloqueo permanente/manual), esto es por RANGO, con el
-- mismo criterio que las reservas: [from_date, to_date) con to_date exclusivo.
--
-- Migración ADITIVA: no toca ninguna tabla existente. Aislada por branch_id.
-- ============================================================

create table if not exists room_blocks (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid references branches(id) on delete cascade,
  room_id     uuid references rooms(id) on delete cascade,
  from_date   date not null,
  to_date     date not null,              -- exclusiva (día en que se libera)
  reason      text not null default '',
  created_at  timestamptz not null default now(),
  constraint room_blocks_dates_ck check (to_date > from_date)
);

create index if not exists idx_room_blocks_branch
  on room_blocks (branch_id, from_date, to_date);
create index if not exists idx_room_blocks_room on room_blocks (room_id);

-- RLS: cerrado por defecto (solo service role del servidor), como el resto.
alter table room_blocks enable row level security;
