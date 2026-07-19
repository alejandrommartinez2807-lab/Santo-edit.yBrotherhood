-- ============================================================
-- Condominios · Control de acceso y seguridad
-- Migración: 0008_access_security
--
-- QUEJA QUE CORRIGE: "no sé quién entra, la garita anota en un cuaderno, me
-- dejan pasar gente sin avisarme, y las encomiendas se pierden". Aquí el
-- residente PRE-AUTORIZA visitas desde el portal (con QR/código), la garita
-- registra entrada/salida, y las encomiendas se registran y notifican.
-- ============================================================

-- ------------------------------------------------------------
-- Visitas
--   kind: visita | proveedor | delivery | mudanza | taxi
--   status: preautorizada | dentro | salio | denegada | vencida
--   authorized_by: residente que la autoriza (desde el portal).
--   access_code / qr: para validar en garita sin llamar al residente.
-- ------------------------------------------------------------
create table if not exists visitors (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  authorized_by  uuid references residents(id) on delete set null,
  kind           text not null default 'visita',
  full_name      text not null default '',
  document_number text not null default '',
  company        text not null default '',       -- proveedor/empresa
  vehicle_plate  text not null default '',
  access_code    text not null default '',        -- código/QR de un solo uso
  valid_from     timestamptz,
  valid_until    timestamptz,
  status         text not null default 'preautorizada',
  photo_url      text not null default '',
  note           text not null default '',
  created_by     text not null default '',         -- residente o conserje
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_visitors_branch on visitors (branch_id, created_at desc);
create index if not exists idx_visitors_unit on visitors (unit_id);
create index if not exists idx_visitors_code on visitors (branch_id, access_code);
create trigger trg_visitors_updated before update on visitors
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Bitácora de acceso (entradas/salidas efectivas registradas en garita)
--   direction: entrada | salida
--   subject_type: visitante | residente | vehiculo | proveedor
-- ------------------------------------------------------------
create table if not exists access_events (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  visitor_id     uuid references visitors(id) on delete set null,
  unit_id        uuid references units(id) on delete set null,
  subject_type   text not null default 'visitante',
  subject_label  text not null default '',        -- nombre/placa
  direction      text not null default 'entrada',
  gate           text not null default '',         -- "Peatonal", "Vehicular"
  recorded_by    text not null default '',         -- guardia
  photo_url      text not null default '',
  note           text not null default '',
  occurred_at    timestamptz not null default now()
);
create index if not exists idx_access_events_branch on access_events (branch_id, occurred_at desc);
create index if not exists idx_access_events_unit on access_events (unit_id);
create index if not exists idx_access_events_visitor on access_events (visitor_id);

-- ------------------------------------------------------------
-- Encomiendas / paquetería
--   status: recibida | notificada | entregada | devuelta
--   Al recibir, se notifica al residente; al entregar, firma/foto.
-- ------------------------------------------------------------
create table if not exists deliveries (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  courier        text not null default '',         -- MRW, Zoom, Amazon, particular
  description    text not null default '',
  tracking       text not null default '',
  status         text not null default 'recibida',
  received_by    text not null default '',          -- conserje
  received_at    timestamptz not null default now(),
  notified_at    timestamptz,
  delivered_to   text not null default '',           -- quién retiró
  delivered_at   timestamptz,
  photo_url      text not null default '',
  signature_url  text not null default '',
  note           text not null default ''
);
create index if not exists idx_deliveries_branch on deliveries (branch_id, received_at desc);
create index if not exists idx_deliveries_unit on deliveries (unit_id, status);

-- ------------------------------------------------------------
-- RLS: cerrado por defecto.
-- ------------------------------------------------------------
alter table visitors       enable row level security;
alter table access_events  enable row level security;
alter table deliveries     enable row level security;
