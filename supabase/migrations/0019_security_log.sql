-- ============================================================
-- Concepto La Granja · Bitácora de seguridad
-- Migración: 0019_security_log
--
-- Registro operativo del equipo de seguridad del centro comercial: rondas,
-- incidentes, accesos fuera de horario, objetos perdidos y emergencias.
-- Lo llena la administración/supervisor desde Panel → Seguridad; los casos
-- abiertos se pueden marcar como resueltos con una nota.
-- ============================================================

create table if not exists security_log (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id) on delete cascade,
  happened_at   timestamptz not null default now(),
  kind          text not null default 'nota',      -- ronda | incidente | acceso | objeto_perdido | emergencia | nota
  area          text not null default '',           -- dónde: PB pasillo central, sótano, feria…
  description   text not null default '',
  severity      text not null default 'baja',       -- baja | media | alta
  guard_name    text not null default '',           -- quién reporta (vigilante/supervisor)
  resolved      boolean not null default false,
  resolved_note text not null default '',
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_security_log_branch_time on security_log (branch_id, happened_at desc);
create index if not exists idx_security_log_open on security_log (branch_id) where resolved = false;
