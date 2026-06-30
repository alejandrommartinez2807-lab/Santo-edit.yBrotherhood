-- ============================================================
-- Santo Edit · Bitácora de auditoría (audit log)
-- Migración: 0017_audit_logs
--
-- Registro append-only de mutaciones sensibles: quién hizo qué, cuándo y
-- desde dónde. Lo escribe `src/lib/audit.ts` (writeAuditLog) desde las rutas
-- de API tras una acción exitosa. branch_id es TEXT sin FK a propósito: la
-- escritura de auditoría NUNCA debe fallar por una FK o un branch nulo.
--
-- Las columnas coinciden 1:1 con el insert de writeAuditLog. La PK tiene
-- default (gen_random_uuid) porque el código no envía id.
-- ============================================================

create extension if not exists "pgcrypto";

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

-- RLS: cerrado por defecto (solo el servidor con service role key lo lee/escribe).
alter table audit_logs enable row level security;
