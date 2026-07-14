-- 0039 · Galería de fotos por tipo de habitación (Hotel).
-- Columna jsonb en room_types: lista ordenada de { "url": string, "caption": string }.
-- El orden del arreglo ES el orden de la galería (no hace falta sort_order).
-- Aditiva y sin datos que migrar: los tipos existentes quedan con galería vacía.

alter table public.room_types
  add column if not exists photos jsonb not null default '[]'::jsonb;

comment on column public.room_types.photos is
  'Galería pública del tipo: [{"url","caption"}]; el orden del arreglo es el orden de la galería.';
