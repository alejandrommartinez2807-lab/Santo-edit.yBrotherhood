-- ============================================================
-- Concepto La Granja · CRM / Atención al cliente
-- Migración: 0015_crm
--
-- Centraliza consultas, reclamos, sugerencias, objetos perdidos, solicitudes
-- de local y propuestas de proveedores recibidas por cualquier canal. Cada
-- caso tiene responsable, prioridad y estado.
-- ============================================================

-- kind: reclamo | sugerencia | consulta | objeto_perdido | solicitud_local |
--       propuesta_proveedor | otro
-- channel: web | whatsapp | correo | telefono | presencial
-- status: nuevo | en_proceso | resuelto | cerrado
-- priority: baja | media | alta
create table if not exists crm_cases (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  kind           text not null default 'consulta',
  subject        text not null default '',
  message        text not null default '',
  customer_name  text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  channel        text not null default 'web',
  status         text not null default 'nuevo',
  priority       text not null default 'media',
  assigned_to    text not null default '',
  resolution     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_crm_branch_status on crm_cases (branch_id, status);
create index if not exists idx_crm_kind on crm_cases (branch_id, kind);
create index if not exists idx_crm_created on crm_cases (branch_id, created_at desc);
create trigger trg_crm_cases_updated before update on crm_cases
  for each row execute function set_updated_at();

alter table crm_cases enable row level security;
