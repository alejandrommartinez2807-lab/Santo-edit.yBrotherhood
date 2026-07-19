-- ============================================================
-- Condominios · Seed demo
-- Migración: 0010_seed_demo
--
-- Datos mínimos para arrancar/demostrar: parámetros de cobro en business_config,
-- tipos de unidad, unidades con alícuotas que suman 1 (100 %), un par de
-- residentes, categorías de gasto y amenidades. Todo idempotente.
-- Seguro de correr en producción vacía; NO duplica si ya hay datos.
-- ============================================================

do $$
declare
  b uuid;
  ut_apto uuid;
  ut_ph   uuid;
begin
  select id into b from branches order by sort_order, created_at limit 1;
  if b is null then
    insert into branches (name, sort_order) values ('Apartamentos Palulu', 1)
    returning id into b;
  end if;

  -- Parámetros globales de cobro y marca (fila única business_config) ----------
  update business_config
  set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
    'brand', jsonb_build_object(
      'name', 'Apartamentos Palulu',
      'primaryColor', '#1f6feb',
      'currencyPrimary', 'USD',
      'currencySecondary', 'VES'
    ),
    'billing', jsonb_build_object(
      'issueDay', 1,          -- día del mes en que se emite la cuota
      'dueDay', 15,           -- día de vencimiento
      'graceDays', 5,         -- gracia antes de aplicar mora
      'lateFeePercent', 5,    -- % de recargo por mora sobre saldo vencido
      'reminderBeforeDays', 3,
      'reminderAfterDays', 3
    ),
    'modules', jsonb_build_object(
      'finance', true, 'amenities', true, 'tickets', true,
      'communication', true, 'governance', true, 'access', true, 'documents', true
    )
  )
  where id = 1;

  -- Tipos de unidad ------------------------------------------------------------
  if not exists (select 1 from unit_types where branch_id = b) then
    insert into unit_types (branch_id, name, sort_order) values
      (b, 'Apartamento', 1) returning id into ut_apto;
    insert into unit_types (branch_id, name, sort_order) values
      (b, 'Penthouse', 2) returning id into ut_ph;
  else
    select id into ut_apto from unit_types where branch_id = b and name = 'Apartamento' limit 1;
    select id into ut_ph   from unit_types where branch_id = b and name = 'Penthouse'   limit 1;
  end if;

  -- Unidades demo (4 aptos 20% + 1 PH 20% = 100%) ------------------------------
  if not exists (select 1 from units where branch_id = b) then
    insert into units (branch_id, unit_type_id, code, tower, floor, area_m2, alicuota, parking_slots) values
      (b, ut_apto, 'A-1', 'A', '1', 80,  0.200000, 1),
      (b, ut_apto, 'A-2', 'A', '1', 80,  0.200000, 1),
      (b, ut_apto, 'A-3', 'A', '2', 80,  0.200000, 1),
      (b, ut_apto, 'A-4', 'A', '2', 80,  0.200000, 1),
      (b, ut_ph,   'PH-1','A', '3', 160, 0.200000, 2);
  end if;

  -- Residentes demo ------------------------------------------------------------
  if not exists (select 1 from residents where branch_id = b) then
    insert into residents (branch_id, full_name, phone, email) values
      (b, 'Ana Pérez',   '+58412000001', 'ana@example.com'),
      (b, 'Luis Gómez',  '+58412000002', 'luis@example.com');
  end if;

  -- Categorías de gasto común --------------------------------------------------
  if not exists (select 1 from expense_categories where branch_id = b) then
    insert into expense_categories (branch_id, name, proration, sort_order) values
      (b, 'Electricidad áreas comunes', 'alicuota', 1),
      (b, 'Agua',                       'alicuota', 2),
      (b, 'Vigilancia',                 'alicuota', 3),
      (b, 'Limpieza',                   'alicuota', 4),
      (b, 'Mantenimiento ascensores',   'alicuota', 5),
      (b, 'Administración',             'alicuota', 6),
      (b, 'Fondo de reserva',           'partes_iguales', 7);
  end if;

  -- Amenidades demo ------------------------------------------------------------
  if not exists (select 1 from amenities where branch_id = b) then
    insert into amenities (branch_id, name, booking_mode, fee, deposit, requires_approval, sort_order) values
      (b, 'Salón de fiestas', 'por_dia',     30, 50, true, 1),
      (b, 'Parrillera / BBQ',  'por_franja',  5,  0, false, 2),
      (b, 'Cancha múltiple',   'por_franja',  0,  0, false, 3);
  end if;
end $$;
