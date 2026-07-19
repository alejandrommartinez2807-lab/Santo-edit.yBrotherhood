-- ============================================================
-- Condominios · Comunicación
-- Migración: 0006_communication
--
-- QUEJA QUE CORRIGE: "mala comunicación con la administración, sobre todo con
-- las alzas de gasto común" y "me entero tarde de todo". Cartelera digital con
-- ACUSE DE LECTURA (sé quién leyó), notificaciones multicanal (push + WhatsApp
-- + email) y un hilo de mensajería por unidad.
-- ============================================================

-- ------------------------------------------------------------
-- Comunicados / cartelera
--   audience: todos | torre | unidad | morosos | propietarios
--   audience_ref: torre o unit_id según audience.
--   status: borrador | publicado | archivado
--   requires_ack: exige acuse de lectura (para actas, alzas, reglas).
-- ------------------------------------------------------------
create table if not exists announcements (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  title          text not null,
  body           text not null default '',
  category       text not null default 'general', -- general | mantenimiento | asamblea | cobranza | seguridad | evento
  audience       text not null default 'todos',
  audience_ref   text not null default '',
  attachments    jsonb not null default '[]'::jsonb, -- [{name,url}]
  is_pinned      boolean not null default false,
  requires_ack   boolean not null default false,
  status         text not null default 'borrador',
  published_at   timestamptz,
  expires_at     timestamptz,
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_announcements_branch
  on announcements (branch_id, published_at desc);
create index if not exists idx_announcements_status on announcements (branch_id, status);
create trigger trg_announcements_updated before update on announcements
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Acuse de lectura de un comunicado (transparencia / cumplimiento)
-- ------------------------------------------------------------
create table if not exists announcement_reads (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  announcement_id  uuid references announcements(id) on delete cascade,
  resident_id      uuid references residents(id) on delete cascade,
  unit_id          uuid references units(id) on delete set null,
  read_at          timestamptz not null default now(),
  acknowledged     boolean not null default false
);
create unique index if not exists uq_ann_read
  on announcement_reads (announcement_id, resident_id);
create index if not exists idx_ann_reads_announcement on announcement_reads (announcement_id);

-- ------------------------------------------------------------
-- Registro de notificaciones enviadas (evita duplicados, sirve de historial)
--   kind: comunicado | recibo | recordatorio_pago | mora | reserva |
--         incidencia | encomienda | asamblea | visita
--   channel: push | whatsapp | email | sms
--   status: enviado | fallido | entregado
-- ------------------------------------------------------------
create table if not exists notifications_log (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  resident_id    uuid references residents(id) on delete set null,
  unit_id        uuid references units(id) on delete set null,
  kind           text not null default 'comunicado',
  channel        text not null default 'push',
  ref_type       text not null default '',    -- entidad relacionada (announcement, receipt...)
  ref_id         text not null default '',
  title          text not null default '',
  status         text not null default 'enviado',
  error          text not null default '',
  sent_at        timestamptz not null default now()
);
create index if not exists idx_notiflog_branch on notifications_log (branch_id, sent_at desc);
create index if not exists idx_notiflog_resident on notifications_log (resident_id);
create index if not exists idx_notiflog_ref on notifications_log (ref_type, ref_id);

-- ------------------------------------------------------------
-- Mensajería (hilo por unidad entre residente y administración)
-- ------------------------------------------------------------
create table if not exists message_threads (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  subject        text not null default '',
  status         text not null default 'abierto',  -- abierto | cerrado
  last_message_at timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists idx_threads_branch on message_threads (branch_id, last_message_at desc);
create index if not exists idx_threads_unit on message_threads (unit_id);

create table if not exists messages (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  thread_id      uuid references message_threads(id) on delete cascade,
  author_role    text not null default 'residente', -- residente | admin
  author_label   text not null default '',
  body           text not null default '',
  attachments    jsonb not null default '[]'::jsonb,
  read_by_admin  boolean not null default false,
  read_by_resident boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_messages_thread on messages (thread_id, created_at);

-- ------------------------------------------------------------
-- RLS: cerrado por defecto.
-- ------------------------------------------------------------
alter table announcements       enable row level security;
alter table announcement_reads  enable row level security;
alter table notifications_log   enable row level security;
alter table message_threads     enable row level security;
alter table messages            enable row level security;
