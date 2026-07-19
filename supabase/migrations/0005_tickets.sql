-- ============================================================
-- Condominios · Incidencias (PQR) y mantenimiento
-- Migración: 0005_tickets
--
-- QUEJA QUE CORRIGE: "reporté una fuga/luz dañada por WhatsApp y nunca supe
-- si lo vieron ni cuándo lo resolvieron". Aquí cada reporte es un TICKET con
-- estado, responsable, fotos, bitácora pública para el residente y SLA.
-- Cubre PQR (peticiones/quejas/reclamos) y órdenes de mantenimiento.
-- ============================================================

-- ------------------------------------------------------------
-- Tickets / incidencias
--   category: mantenimiento | limpieza | seguridad | ruido | administrativo |
--             sugerencia | reclamo | otro
--   priority: baja | media | alta | urgente
--   status:   abierto | en_proceso | en_espera | resuelto | cerrado | rechazado
--   area:     unidad | area_comun (define si va ligado a una unidad concreta)
-- ------------------------------------------------------------
create table if not exists tickets (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  code           text not null default '',     -- correlativo visible: "INC-000123"
  unit_id        uuid references units(id) on delete set null,
  resident_id    uuid references residents(id) on delete set null,
  reporter_name  text not null default '',      -- snapshot (o conserje que lo abre)
  area           text not null default 'unidad',
  category       text not null default 'mantenimiento',
  priority       text not null default 'media',
  status         text not null default 'abierto',
  title          text not null default '',
  description    text not null default '',
  location       text not null default '',       -- "Pasillo torre B piso 3"
  photos         jsonb not null default '[]'::jsonb,  -- [urls]
  assigned_to    text not null default '',        -- staff o proveedor
  provider_id    uuid references providers(id) on delete set null,
  due_at         timestamptz,                     -- SLA objetivo de resolución
  resolved_at    timestamptz,
  closed_at      timestamptz,
  rating         integer,                         -- 1..5 satisfacción del residente al cerrar
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_tickets_branch_status on tickets (branch_id, status);
create index if not exists idx_tickets_unit on tickets (unit_id);
create index if not exists idx_tickets_priority on tickets (branch_id, priority);
create trigger trg_tickets_updated before update on tickets
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Bitácora del ticket (comentarios + cambios de estado)
--   visibility: publico (lo ve el residente) | interno (solo staff)
-- ------------------------------------------------------------
create table if not exists ticket_updates (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  ticket_id      uuid references tickets(id) on delete cascade,
  author_label   text not null default '',
  author_role    text not null default '',       -- residente | admin | conserje | mantenimiento
  visibility     text not null default 'publico',
  message        text not null default '',
  status_from    text not null default '',
  status_to      text not null default '',
  photos         jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_ticket_updates_ticket on ticket_updates (ticket_id, created_at);

-- ------------------------------------------------------------
-- Activos / equipos del condominio (ascensores, bombas, planta, portón)
-- ------------------------------------------------------------
create table if not exists maintenance_assets (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  name           text not null,               -- "Ascensor Torre A", "Bomba hidroneumática"
  location       text not null default '',
  brand          text not null default '',
  serial         text not null default '',
  provider_id    uuid references providers(id) on delete set null,
  notes          text not null default '',
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_maint_assets_branch on maintenance_assets (branch_id);

-- ------------------------------------------------------------
-- Tareas de mantenimiento (preventivo/correctivo, con recurrencia)
--   status: programada | en_proceso | hecha | vencida | cancelada
--   recurrence: none | mensual | trimestral | semestral | anual
-- ------------------------------------------------------------
create table if not exists maintenance_tasks (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  asset_id       uuid references maintenance_assets(id) on delete set null,
  ticket_id      uuid references tickets(id) on delete set null,
  title          text not null default '',
  description    text not null default '',
  provider_id    uuid references providers(id) on delete set null,
  status         text not null default 'programada',
  recurrence     text not null default 'none',
  scheduled_for  date,
  done_at        timestamptz,
  cost           numeric(12,2) not null default 0,
  expense_id     uuid references expenses(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_maint_tasks_branch on maintenance_tasks (branch_id, status);
create index if not exists idx_maint_tasks_scheduled on maintenance_tasks (branch_id, scheduled_for);
create trigger trg_maint_tasks_updated before update on maintenance_tasks
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- RLS: cerrado por defecto.
-- ------------------------------------------------------------
alter table tickets            enable row level security;
alter table ticket_updates     enable row level security;
alter table maintenance_assets enable row level security;
alter table maintenance_tasks  enable row level security;
