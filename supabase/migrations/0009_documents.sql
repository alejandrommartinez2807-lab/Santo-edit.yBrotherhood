-- ============================================================
-- Condominios · Documentos
-- Migración: 0009_documents
--
-- QUEJA QUE CORRIGE: "el reglamento, las actas y los estados financieros no
-- aparecen o hay que pedirlos por WhatsApp". Repositorio único con categorías
-- y visibilidad (residentes vs solo junta), versionado simple y auditable.
-- ============================================================

create table if not exists documents (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  category       text not null default 'general', -- reglamento | acta | estado_financiero | poliza | contrato | plano | general
  title          text not null,
  description    text not null default '',
  file_url       text not null default '',
  file_name      text not null default '',
  file_size      integer not null default 0,
  -- quién puede verlo: residentes | junta | admin (jerárquico: admin ve todo)
  visibility     text not null default 'residentes',
  period_ref     text not null default '',         -- "2026-06" para estados mensuales
  version        integer not null default 1,
  is_active      boolean not null default true,
  uploaded_by    text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_documents_branch on documents (branch_id, category);
create index if not exists idx_documents_visibility on documents (branch_id, visibility);
create trigger trg_documents_updated before update on documents
  for each row execute function set_updated_at();

-- Acuse de lectura de documentos que lo requieran (ej. nuevo reglamento)
create table if not exists document_reads (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  document_id    uuid references documents(id) on delete cascade,
  resident_id    uuid references residents(id) on delete cascade,
  read_at        timestamptz not null default now()
);
create unique index if not exists uq_document_read on document_reads (document_id, resident_id);

alter table documents      enable row level security;
alter table document_reads enable row level security;
