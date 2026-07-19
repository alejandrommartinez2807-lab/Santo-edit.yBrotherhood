-- ============================================================
-- Condominios · Núcleo / Infraestructura compartida
-- Migración: 0001_core_infra
--
-- Base derivada del PMS hotelero (rama demo-lidotel): reutiliza el patrón
-- multi-propiedad `branches` (aquí: cada fila = UN CONDOMINIO/EDIFICIO
-- administrado), el auth de personal (staff_users), la config única JSONB
-- (business_config), la bitácora de auditoría (audit_logs) y las
-- suscripciones push. Sobre eso se monta el dominio de propiedad horizontal.
--
-- Convenciones (idénticas al resto del repo):
--  · snake_case; PK uuid con gen_random_uuid()
--  · branch_id -> branches(id) para aislar por condominio (fitness de aislamiento)
--  · estados como text + comentario + check (más flexible que enum)
--  · RLS habilitado y CERRADO por defecto; la app accede con SERVICE ROLE KEY
--    desde las API routes de Next (bypassa RLS). El portal del residente lee
--    vía esas rutas, nunca con la anon key directo a la tabla.
-- ============================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- Función utilitaria: updated_at automático ---------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- CONDOMINIOS  (physical table `branches` — un condominio por fila)
--   Multi-propiedad: una administradora puede gestionar varios edificios.
-- ============================================================
create table if not exists branches (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,               -- "Residencias El Parque"
  legal_name         text not null default '',    -- razón social / junta de condominio
  tax_id             text not null default '',    -- RIF / NIT
  address            text not null default '',
  city               text not null default '',
  phone              text not null default '',
  email              text not null default '',
  timezone           text not null default 'America/Caracas',
  currency_primary   text not null default 'USD',  -- moneda de cuenta (alícuotas)
  currency_secondary text not null default 'VES',  -- moneda de cobro local
  logo_url           text not null default '',
  -- parámetros de cobro y reglas del condominio (día de corte, % mora, etc.)
  config             jsonb not null default '{}'::jsonb,
  is_active          boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_branches_updated before update on branches
  for each row execute function set_updated_at();

comment on table branches is 'Cada fila = un condominio/edificio administrado (multi-propiedad).';

-- Condominio por defecto (idempotente).
insert into branches (name, sort_order)
select 'Apartamentos Palulu', 1
where not exists (select 1 from branches);

-- ============================================================
-- PERSONAL / USUARIOS ADMINISTRATIVOS
--   Ligado a Supabase Auth (auth.users). Roles del condominio:
--   admin        = administrador de la empresa/edificio (todo)
--   junta        = junta de condominio (lectura + aprobaciones + asambleas)
--   contador     = finanzas (cuotas, gastos, conciliación)
--   conserje     = recepción (visitas, encomiendas, incidencias)
--   seguridad    = control de acceso (garita)
--   mantenimiento= atiende incidencias/tareas
--   soporte      = nuestro rol interno
-- ============================================================
create table if not exists staff_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null,             -- admin | junta | contador | conserje | seguridad | mantenimiento | soporte
  -- condominios que puede operar; vacío = todos (para la administradora)
  branch_ids  uuid[] not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_staff_users_role on staff_users (role);
alter table staff_users enable row level security;

-- Un usuario autenticado puede leer SU PROPIA fila (para conocer su rol).
do $$ begin
  create policy "staff can read own row"
    on staff_users for select
    using (auth.uid() = id);
exception when duplicate_object then null; end $$;

-- ============================================================
-- CONFIGURACIÓN DEL NEGOCIO  (fila única; marca/módulos/parámetros en JSONB)
--   Guarda: marca y tema, módulos habilitados, parámetros globales de cobro
--   (día de emisión de cuotas, día de vencimiento, % de recargo por mora,
--   gracia en días, textos legales, WhatsApp de la administración, etc.).
-- ============================================================
create table if not exists business_config (
  id            integer primary key default 1,
  config        jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  constraint business_config_single_row check (id = 1)
);
create trigger trg_business_config_updated before update on business_config
  for each row execute function set_updated_at();

insert into business_config (id, config)
select 1, '{}'::jsonb
where not exists (select 1 from business_config where id = 1);

-- ============================================================
-- BITÁCORA DE AUDITORÍA (append-only)  ·  TRANSPARENCIA
--   Quién hizo qué, cuándo y desde dónde. La escribe la capa de API tras cada
--   acción sensible (emitir cuotas, confirmar/anular pago, editar unidad,
--   aprobar gasto, publicar comunicado, autorizar visita, etc.).
--   branch_id es TEXT sin FK a propósito: auditar NUNCA debe fallar por una FK.
-- ============================================================
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  branch_id    text,
  action       text not null,
  entity_type  text not null default '',
  entity_id    text,
  actor_role   text,
  actor_label  text,
  actor_source text,
  ip_address   text,
  user_agent   text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on audit_logs (created_at desc);
create index if not exists idx_audit_logs_branch on audit_logs (branch_id);
create index if not exists idx_audit_logs_action on audit_logs (action);
create index if not exists idx_audit_logs_entity on audit_logs (entity_type, entity_id);
alter table audit_logs enable row level security;

-- ============================================================
-- SUSCRIPCIONES PUSH (Web Push / VAPID)
--   Sirve tanto a personal como a residentes del portal.
--   subscriber_type: staff | resident
-- ============================================================
create table if not exists push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  subscriber_type  text not null default 'resident', -- staff | resident
  subscriber_id    text not null default '',         -- id de staff_user o resident
  endpoint         text not null,
  p256dh           text not null default '',
  auth             text not null default '',
  user_agent       text not null default '',
  created_at       timestamptz not null default now()
);
create unique index if not exists uq_push_endpoint on push_subscriptions (endpoint);
create index if not exists idx_push_subscriber on push_subscriptions (subscriber_type, subscriber_id);
alter table push_subscriptions enable row level security;
