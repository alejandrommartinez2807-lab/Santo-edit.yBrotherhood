-- ============================================================
-- Hotel · P3-G: CHANNEL MANAGER fase 1 — importar iCal (Airbnb/Booking)
--
-- rooms.ical_import_url = URL del calendario externo de ESA habitación.
-- room_blocks.source    = 'manual' (bloqueos del staff) | 'ical' (creados por
--                         la sincronización; son los ÚNICOS que el sync puede
--                         crear/borrar — los manuales jamás se tocan).
-- Aditiva; no toca datos existentes (default 'manual').
-- ============================================================

alter table rooms
  add column if not exists ical_import_url text not null default '';

alter table room_blocks
  add column if not exists source text not null default 'manual';

create index if not exists idx_room_blocks_source on room_blocks (branch_id, source);
