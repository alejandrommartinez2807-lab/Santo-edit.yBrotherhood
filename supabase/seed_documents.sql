-- ============================================================
-- Concepto La Granja · Documentos reales de demostración
-- Publica 4 documentos PDF (viven en /public/docs del sitio) en la
-- biblioteca del panel y de la cuenta del comerciante.
-- Idempotente: no duplica si ya existen (por título).
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

do $$
declare b uuid;
begin
  select id into b from branches order by sort_order, created_at limit 1;
  if b is null then raise notice 'Sin centro comercial: nada que sembrar.'; return; end if;

  insert into documents (branch_id, title, category, description, file_url, file_name, visibility, uploaded_by)
  select b, 'Reglamento interno de funcionamiento', 'reglamento',
         'Horarios, pagos, áreas comunes, imagen del local, seguridad y sanciones.',
         '/docs/reglamento-interno.pdf', 'reglamento-interno.pdf', 'residentes', 'admin'
  where not exists (select 1 from documents where branch_id = b and title = 'Reglamento interno de funcionamiento');

  insert into documents (branch_id, title, category, description, file_url, file_name, visibility, uploaded_by)
  select b, 'Circular: horario especial de temporada', 'circular',
         'Horario extendido de viernes y sábados durante la temporada alta.',
         '/docs/circular-horario-especial.pdf', 'circular-horario-especial.pdf', 'residentes', 'admin'
  where not exists (select 1 from documents where branch_id = b and title = 'Circular: horario especial de temporada');

  insert into documents (branch_id, title, category, description, file_url, file_name, visibility, uploaded_by)
  select b, 'Normas de la feria de comida', 'reglamento',
         'Permisos sanitarios, desechos, mesas compartidas, campanas y gas.',
         '/docs/normas-feria-comida.pdf', 'normas-feria-comida.pdf', 'residentes', 'admin'
  where not exists (select 1 from documents where branch_id = b and title = 'Normas de la feria de comida');

  insert into documents (branch_id, title, category, description, file_url, file_name, visibility, uploaded_by)
  select b, 'Planilla: permiso de remodelación', 'planilla',
         'Formato para solicitar trabajos de remodelación en el local.',
         '/docs/planilla-permiso-remodelacion.pdf', 'planilla-permiso-remodelacion.pdf', 'residentes', 'admin'
  where not exists (select 1 from documents where branch_id = b and title = 'Planilla: permiso de remodelación');

  raise notice 'Documentos de demostración publicados (4).';
end $$;
