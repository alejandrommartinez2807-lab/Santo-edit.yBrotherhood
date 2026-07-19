-- ============================================================
-- Condominios · Gobernanza (asambleas y votaciones)
-- Migración: 0007_governance
--
-- QUEJA QUE CORRIGE: "las asambleas no tienen quórum, las decisiones se
-- toman entre pocos, no hay actas claras y las votaciones se prestan a
-- trampa". Aquí el QUÓRUM se calcula por ALÍCUOTA, el voto se pondera por
-- coeficiente, se verifica identidad (portal) y queda todo con acta y bitácora.
-- ============================================================

-- ------------------------------------------------------------
-- Asambleas
--   type: ordinaria | extraordinaria
--   status: convocada | en_curso | cerrada | cancelada
--   quorum_required: fracción de alícuota requerida (0.50 = 50 %)
-- ------------------------------------------------------------
create table if not exists assemblies (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  title          text not null,
  type           text not null default 'ordinaria',
  status         text not null default 'convocada',
  scheduled_at   timestamptz,
  location       text not null default '',       -- presencial o "Virtual"
  is_virtual     boolean not null default false,
  quorum_required numeric(5,4) not null default 0.5,
  agenda         jsonb not null default '[]'::jsonb,  -- [{orden, punto}]
  minutes_url    text not null default '',        -- acta firmada (PDF)
  opened_at      timestamptz,
  closed_at      timestamptz,
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_assemblies_branch on assemblies (branch_id, scheduled_at desc);
create trigger trg_assemblies_updated before update on assemblies
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Asistencia / representación
--   attendance_alicuota: alícuota que representa (para sumar el quórum).
--   proxy_of_unit_id: si asiste por poder de otra unidad.
--   mode: presencial | virtual | poder
-- ------------------------------------------------------------
create table if not exists assembly_attendance (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid references branches(id) on delete cascade,
  assembly_id        uuid references assemblies(id) on delete cascade,
  unit_id            uuid references units(id) on delete set null,
  resident_id        uuid references residents(id) on delete set null,
  attendee_name      text not null default '',
  mode               text not null default 'presencial',
  proxy_of_unit_id   uuid references units(id) on delete set null,
  attendance_alicuota numeric(9,6) not null default 0,
  checked_in_at      timestamptz not null default now()
);
create unique index if not exists uq_attendance_unit
  on assembly_attendance (assembly_id, unit_id);
create index if not exists idx_attendance_assembly on assembly_attendance (assembly_id);

-- ------------------------------------------------------------
-- Votaciones / encuestas (dentro de una asamblea o independientes)
--   weighting: alicuota | un_voto_por_unidad
--   status: borrador | abierta | cerrada
--   type: single (una opción) | multiple | si_no
-- ------------------------------------------------------------
create table if not exists polls (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  assembly_id    uuid references assemblies(id) on delete set null,
  question       text not null,
  description    text not null default '',
  type           text not null default 'single',
  weighting      text not null default 'alicuota',
  status         text not null default 'borrador',
  opens_at       timestamptz,
  closes_at      timestamptz,
  result         jsonb not null default '{}'::jsonb, -- snapshot al cerrar
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_polls_branch on polls (branch_id, created_at desc);
create index if not exists idx_polls_assembly on polls (assembly_id);
create trigger trg_polls_updated before update on polls
  for each row execute function set_updated_at();

create table if not exists poll_options (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  poll_id        uuid references polls(id) on delete cascade,
  label          text not null,
  sort_order     integer not null default 0
);
create index if not exists idx_poll_options_poll on poll_options (poll_id, sort_order);

-- ------------------------------------------------------------
-- Votos
--   weight: peso aplicado (alícuota o 1). UNA fila por unidad y poll (unicidad
--   evita doble voto). resident_id deja rastro de QUIÉN votó por la unidad.
-- ------------------------------------------------------------
create table if not exists votes (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  poll_id        uuid references polls(id) on delete cascade,
  option_id      uuid references poll_options(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  resident_id    uuid references residents(id) on delete set null,
  weight         numeric(9,6) not null default 0,
  created_at     timestamptz not null default now()
);
create unique index if not exists uq_vote_unit on votes (poll_id, unit_id);
create index if not exists idx_votes_poll on votes (poll_id);
create index if not exists idx_votes_option on votes (option_id);

-- ------------------------------------------------------------
-- RLS: cerrado por defecto.
-- ------------------------------------------------------------
alter table assemblies          enable row level security;
alter table assembly_attendance enable row level security;
alter table polls               enable row level security;
alter table poll_options        enable row level security;
alter table votes               enable row level security;
