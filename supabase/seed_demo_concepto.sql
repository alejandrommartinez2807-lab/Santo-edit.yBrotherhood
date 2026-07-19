-- ============================================================
-- Concepto La Granja · SEED de DEMOSTRACIÓN (datos de prueba)
-- Aplicar UNA vez en el SQL Editor de Supabase (después de 0001-0016).
-- Idempotente: si ya hay locales cargados, no hace nada.
-- Puebla todos los módulos para mostrar el sistema funcionando.
-- ============================================================
do $$
declare
  b uuid;
  p uuid;                 -- período de cobro del mes
  m date := date_trunc('month', now())::date;
  ln text := to_char(now(), 'YYYY-MM');
  u_kalea uuid; u_beco uuid; u_cine uuid; u_grill uuid; u_paleta uuid; u_figaro uuid; u_farma uuid; u_bout uuid;
begin
  select id into b from branches order by sort_order limit 1;
  if b is null then raise notice 'No hay branch'; return; end if;
  if exists (select 1 from units where branch_id = b) then
    raise notice 'Ya hay locales; seed omitido.'; return;
  end if;

  -- Tipos de unidad ------------------------------------------------
  insert into unit_types (branch_id, name, sort_order) values
    (b,'Local',1),(b,'Consultorio',2),(b,'Oficina',3),(b,'Kiosco',4);

  -- LOCALES (40; alícuotas suman 1.00) -----------------------------
  -- 5 anclas
  insert into units (branch_id, code, commercial_name, activity, floor, area_m2, alicuota, status) values
    (b,'S-01','Supermercados Kalea','supermercado','Planta baja',820,0.10,'ocupado'),
    (b,'A-01','Beco','moda','Planta baja',540,0.08,'ocupado'),
    (b,'M-01','SuperCines','entretenimiento','Mezzanina',700,0.06,'ocupado'),
    (b,'B-01','Banco Nacional','banco','Planta baja',120,0.04,'ocupado'),
    (b,'F-01','Capitán Grill Burger','comida','Feria de comida',90,0.02,'ocupado');
  -- 35 locales @ 0.02
  insert into units (branch_id, code, commercial_name, activity, floor, area_m2, alicuota, status) values
    (b,'F-02','María Paleta','comida','Feria de comida',45,0.02,'ocupado'),
    (b,'F-03','Pollos a la Brasa','comida','Feria de comida',60,0.02,'ocupado'),
    (b,'F-04','Sushi Express','comida','Feria de comida',50,0.02,'ocupado'),
    (b,'PB-02','Farmacia SaludYa','salud','Planta baja',110,0.02,'ocupado'),
    (b,'PB-03','Fígaro Barbiere','belleza','Planta baja',40,0.02,'ocupado'),
    (b,'PB-04','Óptica Visión','salud','Planta baja',55,0.02,'ocupado'),
    (b,'PB-05','Joyería El Diamante','servicios','Planta baja',35,0.02,'ocupado'),
    (b,'PB-06','TecnoStore','electronica','Planta baja',70,0.02,'ocupado'),
    (b,'PB-07','Zapatería Pasos','moda','Planta baja',65,0.02,'ocupado'),
    (b,'PB-08','Boutique Bella','moda','Planta baja',60,0.02,'ocupado'),
    (b,'PB-09','Juguetería Mundo Feliz','hogar','Planta baja',75,0.02,'ocupado'),
    (b,'PB-10','Panadería La Espiga','comida','Planta baja',80,0.02,'ocupado'),
    (b,'PB-11','Heladería Frost','comida','Planta baja',40,0.02,'ocupado'),
    (b,'PB-12','Librería Papel','hogar','Planta baja',55,0.02,'ocupado'),
    (b,'PB-13','Peluquería Glamour','belleza','Planta baja',45,0.02,'ocupado'),
    (b,'MZ-01','Gimnasio FitZone','servicios','Mezzanina',200,0.02,'ocupado'),
    (b,'MZ-02','Ropa Deportiva Pro','moda','Mezzanina',70,0.02,'ocupado'),
    (b,'MZ-03','Celulares & Más','electronica','Mezzanina',50,0.02,'ocupado'),
    (b,'MZ-04','Café Aroma','comida','Mezzanina',60,0.02,'ocupado'),
    (b,'MZ-05','Spa Relax','belleza','Mezzanina',90,0.02,'ocupado'),
    (b,'MZ-06','Lavandería Express','servicios','Mezzanina',40,0.02,'ocupado'),
    (b,'K-01','Kiosco Prensa','kiosco','Planta baja',12,0.02,'ocupado'),
    (b,'K-02','Kiosco Dulces','kiosco','Planta baja',12,0.02,'ocupado'),
    (b,'K-03','Kiosco Accesorios','kiosco','Mezzanina',12,0.02,'ocupado'),
    (b,'PB-14','Perfumería Esencia','belleza','Planta baja',48,0.02,'ocupado'),
    (b,'PB-15','Mueblería Confort','hogar','Planta baja',120,0.02,'ocupado'),
    (b,'PB-16','Agencia de Viajes Mundo','servicios','Planta baja',40,0.02,'ocupado'),
    (b,'PB-17','Floristería Jardín','servicios','Planta baja',35,0.02,'ocupado'),
    (b,'PB-18','Local disponible','','Planta baja',60,0.02,'disponible'),
    (b,'PB-19','Local disponible','','Planta baja',85,0.02,'disponible'),
    (b,'MZ-07','Local disponible','','Mezzanina',70,0.02,'disponible'),
    (b,'MZ-08','Local disponible','','Mezzanina',55,0.02,'disponible'),
    (b,'PB-20','Local en mantenimiento','','Planta baja',50,0.02,'mantenimiento'),
    (b,'K-04','Kiosco disponible','kiosco','Planta baja',12,0.02,'disponible'),
    (b,'MZ-09','Barbería Clásica','belleza','Mezzanina',38,0.02,'ocupado'),
    (b,'MZ-10','Comida China Wok','comida','Feria de comida',55,0.02,'ocupado');

  select id into u_kalea from units where branch_id=b and code='S-01';
  select id into u_beco  from units where branch_id=b and code='A-01';
  select id into u_cine  from units where branch_id=b and code='M-01';
  select id into u_grill from units where branch_id=b and code='F-01';
  select id into u_paleta from units where branch_id=b and code='F-02';
  select id into u_figaro from units where branch_id=b and code='PB-03';
  select id into u_farma from units where branch_id=b and code='PB-02';
  select id into u_bout  from units where branch_id=b and code='PB-08';

  -- COMERCIANTES ---------------------------------------------------
  insert into residents (branch_id, full_name, document_number, phone, email) values
    (b,'Inversiones Kalea C.A.','J-30111222-3','584141111111','kalea@demo.com'),
    (b,'Beco Retail C.A.','J-30222333-4','584142222222','beco@demo.com'),
    (b,'Grupo Cines C.A.','J-30333444-5','584143333333','cines@demo.com'),
    (b,'Carlos Grill','V-14555666','584144444444','grill@demo.com'),
    (b,'María Fernández','V-16777888','584145555555','maria@demo.com'),
    (b,'Fígaro Servicios','J-30444555-6','584146666666','figaro@demo.com'),
    (b,'Farmacias SaludYa','J-30555666-7','584147777777','salud@demo.com'),
    (b,'Ana Boutique','V-18999000','584148888888','ana@demo.com');

  -- Vincular comerciante <-> local
  insert into unit_residents (branch_id, unit_id, resident_id, role, is_primary)
  select b, u_kalea, id, 'inquilino', true from residents where branch_id=b and full_name='Inversiones Kalea C.A.';
  insert into unit_residents (branch_id, unit_id, resident_id, role, is_primary)
  select b, u_beco, id, 'inquilino', true from residents where branch_id=b and full_name='Beco Retail C.A.';
  insert into unit_residents (branch_id, unit_id, resident_id, role, is_primary)
  select b, u_cine, id, 'inquilino', true from residents where branch_id=b and full_name='Grupo Cines C.A.';
  insert into unit_residents (branch_id, unit_id, resident_id, role, is_primary)
  select b, u_grill, id, 'inquilino', true from residents where branch_id=b and full_name='Carlos Grill';
  insert into unit_residents (branch_id, unit_id, resident_id, role, is_primary)
  select b, u_paleta, id, 'inquilino', true from residents where branch_id=b and full_name='María Fernández';

  -- CONTRATOS ------------------------------------------------------
  insert into leases (branch_id, unit_id, resident_id, code, status, starts_on, ends_on, canon_amount, condo_included, due_day, deposit_amount, percentage_rent, percentage_rent_rate, percentage_rent_min, guarantor_name)
  select b, u_kalea, r.id, 'C-2025-001','activo','2025-01-01','2026-12-31',2500,false,5,5000,true,3,2500,'Inversiones Kalea C.A.' from residents r where r.branch_id=b and r.full_name='Inversiones Kalea C.A.';
  insert into leases (branch_id, unit_id, resident_id, code, status, starts_on, ends_on, canon_amount, condo_included, due_day, deposit_amount, percentage_rent, percentage_rent_rate, percentage_rent_min, guarantor_name)
  select b, u_beco, r.id, 'C-2025-002','activo','2025-03-01','2026-08-31',1800,false,5,3600,true,4,1800,'Beco Retail C.A.' from residents r where r.branch_id=b and r.full_name='Beco Retail C.A.';
  insert into leases (branch_id, unit_id, resident_id, code, status, starts_on, ends_on, canon_amount, condo_included, due_day, deposit_amount)
  select b, u_cine, r.id, 'C-2025-003','activo','2024-06-01','2026-07-31',1500,false,5,3000 from residents r where r.branch_id=b and r.full_name='Grupo Cines C.A.';
  insert into leases (branch_id, unit_id, resident_id, code, status, starts_on, ends_on, canon_amount, condo_included, due_day, deposit_amount)
  select b, u_grill, r.id, 'C-2025-004','activo','2025-02-01','2027-01-31',600,false,5,1200 from residents r where r.branch_id=b and r.full_name='Carlos Grill';
  insert into leases (branch_id, unit_id, resident_id, code, status, starts_on, ends_on, canon_amount, condo_included, due_day, deposit_amount)
  select b, u_paleta, r.id, 'C-2025-005','activo','2025-05-01','2026-09-10',400,false,5,800 from residents r where r.branch_id=b and r.full_name='María Fernández';
  insert into leases (branch_id, unit_id, code, status, starts_on, ends_on, canon_amount, due_day, deposit_amount)
  values (b, u_figaro, 'C-2025-006','activo','2025-04-01','2026-08-05',350,5,700),
         (b, u_farma, 'C-2025-007','activo','2024-09-01','2026-12-31',700,5,1400),
         (b, u_bout,  'C-2025-008','activo','2025-06-01','2026-11-30',500,5,1000);

  -- Ventas del mes (para renta porcentual)
  insert into lease_sales (branch_id, lease_id, unit_id, period_month, gross_sales, source)
  select b, l.id, u_kalea, m, 120000, 'reportado' from leases l where l.branch_id=b and l.code='C-2025-001';
  insert into lease_sales (branch_id, lease_id, unit_id, period_month, gross_sales, source)
  select b, l.id, u_beco, m, 60000, 'reportado' from leases l where l.branch_id=b and l.code='C-2025-002';

  -- COBRO DEL MES (período + cargos + recibos + saldos) ------------
  insert into fee_periods (branch_id, label, period_month, status, issued_at, due_date, common_expense_total)
  values (b, ln, m, 'emitido', now(), (m + interval '5 days')::date, 8000) returning id into p;

  -- Cargos por local (canon + condominio + renta%). Balance en el local.
  -- Kalea: canon 2500 + condominio 800 + renta% 1100 = 4400 (moroso)
  insert into charges (branch_id, unit_id, period_id, concept, description, amount, status) values
    (b,u_kalea,p,'canon_arrendamiento','Canon '||ln,2500,'pendiente'),
    (b,u_kalea,p,'cuota_ordinaria','Condominio '||ln,800,'pendiente'),
    (b,u_kalea,p,'renta_porcentual','Renta porcentual '||ln,1100,'pendiente');
  update units set balance=4400 where id=u_kalea;
  -- Beco: canon 1800 + condominio 640 + renta% 600 = 3040 (moroso)
  insert into charges (branch_id, unit_id, period_id, concept, description, amount, status) values
    (b,u_beco,p,'canon_arrendamiento','Canon '||ln,1800,'pendiente'),
    (b,u_beco,p,'cuota_ordinaria','Condominio '||ln,640,'pendiente'),
    (b,u_beco,p,'renta_porcentual','Renta porcentual '||ln,600,'pendiente');
  update units set balance=3040 where id=u_beco;
  -- Cine: canon 1500 + condominio 480 = 1980 (PAGADO)
  insert into charges (branch_id, unit_id, period_id, concept, description, amount, amount_paid, status) values
    (b,u_cine,p,'canon_arrendamiento','Canon '||ln,1500,1500,'pagado'),
    (b,u_cine,p,'cuota_ordinaria','Condominio '||ln,480,480,'pagado');
  insert into payments (branch_id, unit_id, amount, amount_local, method, reference, status, reviewed_at)
  values (b,u_cine,1980,1980,'transferencia','TRX-0001','confirmado',now());
  update units set balance=0 where id=u_cine;
  -- Grill: canon 600 + condominio 160 = 760 (PAGADO)
  insert into charges (branch_id, unit_id, period_id, concept, description, amount, amount_paid, status) values
    (b,u_grill,p,'canon_arrendamiento','Canon '||ln,600,600,'pagado'),
    (b,u_grill,p,'cuota_ordinaria','Condominio '||ln,160,160,'pagado');
  insert into payments (branch_id, unit_id, amount, amount_local, method, reference, status, reviewed_at)
  values (b,u_grill,760,760,'pago_movil','PM-0002','confirmado',now());
  update units set balance=0 where id=u_grill;
  -- Paleta: canon 400 + condominio 160 = 560 (moroso)
  insert into charges (branch_id, unit_id, period_id, concept, description, amount, status) values
    (b,u_paleta,p,'canon_arrendamiento','Canon '||ln,400,'pendiente'),
    (b,u_paleta,p,'cuota_ordinaria','Condominio '||ln,160,'pendiente');
  update units set balance=560 where id=u_paleta;

  -- Recibos (para el estado de cuenta)
  insert into receipts (branch_id, unit_id, period_id, number, previous_balance, charges_total, payments_total, new_balance, status) values
    (b,u_kalea,p,1,0,4400,0,4400,'emitido'),
    (b,u_beco,p,2,0,3040,0,3040,'emitido'),
    (b,u_cine,p,3,0,1980,1980,0,'pagado'),
    (b,u_grill,p,4,0,760,760,0,'pagado'),
    (b,u_paleta,p,5,0,560,0,560,'emitido');

  -- CONSULTORIOS (doctores + horario) ------------------------------
  insert into doctors (branch_id, full_name, specialty, phone, consult_fee, active, sort_order) values
    (b,'Dra. Ana Pérez','Pediatría','584241000001',30,true,1),
    (b,'Dr. Luis Rangel','Medicina General','584241000002',25,true,2),
    (b,'Dra. Carla Méndez','Ginecología','584241000003',40,true,3),
    (b,'Dr. José Ramírez','Cardiología','584241000004',50,true,4),
    (b,'Dra. Sofía Blanco','Odontología','584241000005',35,true,5);
  -- Horario Lun-Vie 09:00-13:00 cada 30 min para todos
  insert into doctor_schedule (branch_id, doctor_id, weekday, start_time, end_time, slot_minutes)
  select b, d.id, wd, '09:00','13:00',30 from doctors d cross join generate_series(1,5) as g(wd) where d.branch_id=b;
  -- y tardes Lun/Mié/Vie 15:00-18:00 para dos doctores
  insert into doctor_schedule (branch_id, doctor_id, weekday, start_time, end_time, slot_minutes)
  select b, d.id, wd, '15:00','18:00',30 from doctors d cross join (values (1),(3),(5)) as t(wd)
  where d.branch_id=b and d.specialty in ('Medicina General','Odontología');

  -- ESTACIONAMIENTO ------------------------------------------------
  update parking_config set free_minutes=15, rate_per_hour=1.5, daily_cap=10, rate_currency='USD' where branch_id=b;
  insert into parking_tickets (branch_id, code, plate, vehicle_type, entered_at, status) values
    (b,'P-AB12C','AB123CD','carro', now() - interval '40 minutes','abierto'),
    (b,'P-XY34Z','XY456ZW','carro', now() - interval '2 hours','abierto');
  insert into parking_tickets (branch_id, code, plate, vehicle_type, entered_at, exited_at, minutes, amount, status, paid_method, paid_at) values
    (b,'P-KM56N','KM789NO','carro', now() - interval '3 hours', now() - interval '1 hour', 120, 3, 'pagado','efectivo', now() - interval '1 hour'),
    (b,'P-LP78Q','LP012QR','moto',  now() - interval '5 hours', now() - interval '4 hours', 60, 1.5,'pagado','pago_movil', now() - interval '4 hours');
  insert into parking_passes (branch_id, plate, holder_name, monthly_fee, active, valid_to) values
    (b,'MENSUAL01','Empleado Kalea',15,true,(now()+interval '3 months')::date),
    (b,'MENSUAL02','Gerencia CC',15,true,(now()+interval '6 months')::date);

  -- PUBLICIDAD -----------------------------------------------------
  insert into ad_spaces (branch_id, name, kind, location, base_price, active, sort_order) values
    (b,'Pantalla LED entrada principal','pantalla','Acceso PB',400,true,1),
    (b,'Valla estacionamiento','valla','Sótano',200,true,2),
    (b,'Banner pasillo central','pasillo','Mezzanina',150,true,3),
    (b,'Publicidad en redes','redes','Instagram',120,true,4);
  insert into ad_bookings (branch_id, space_id, client_name, client_phone, starts_on, ends_on, price, status)
  select b, s.id, 'Coca-Cola FEMSA','584140000001', m, (m+interval '1 month')::date, 400,'activo' from ad_spaces s where s.branch_id=b and s.name like 'Pantalla LED%';
  insert into ad_bookings (branch_id, space_id, client_name, client_phone, starts_on, ends_on, price, status)
  select b, s.id, 'Movistar','584140000002', m, (m+interval '2 months')::date, 300,'activo' from ad_spaces s where s.branch_id=b and s.name like 'Valla%';
  insert into ad_bookings (branch_id, space_id, client_name, client_phone, starts_on, ends_on, price, status)
  select b, s.id, 'Farmatodo','584140000003', m, (m+interval '15 days')::date, 150,'activo' from ad_spaces s where s.branch_id=b and s.name like 'Banner%';

  -- FIDELIDAD ------------------------------------------------------
  insert into loyalty_customers (branch_id, full_name, phone, tier, points) values
    (b,'Pedro González','584241500001','oro',1250),
    (b,'Lucía Torres','584241500002','plata',640),
    (b,'Miguel Sánchez','584241500003','general',180),
    (b,'Valentina Ruiz','584241500004','plata',520),
    (b,'Daniel Castro','584241500005','general',90),
    (b,'Gabriela Díaz','584241500006','oro',1580);
  insert into loyalty_transactions (branch_id, customer_id, points, kind, amount, note)
  select b, c.id, 200, 'compra', 100, 'Compra en Supermercado' from loyalty_customers c where c.branch_id=b and c.full_name='Pedro González';
  insert into loyalty_transactions (branch_id, customer_id, points, kind, amount, note)
  select b, c.id, -100, 'canje', 0, 'Canje de cupón' from loyalty_customers c where c.branch_id=b and c.full_name='Lucía Torres';

  -- ATENCIÓN AL CLIENTE (CRM) --------------------------------------
  insert into crm_cases (branch_id, kind, subject, message, customer_name, customer_phone, channel, status, priority) values
    (b,'reclamo','Aire acondicionado','Hace calor en el pasillo de la feria de comida.','Rosa Medina','584241600001','web','nuevo','media'),
    (b,'objeto_perdido','Llaves perdidas','Perdí mis llaves cerca del cine, tienen un llavero rojo.','Andrés Peña','584241600002','web','en_proceso','media'),
    (b,'solicitud_local','Interesado en local','Quiero información para alquilar un local de comida.','Emprendedor XY','584241600003','whatsapp','nuevo','alta'),
    (b,'sugerencia','Más estacionamiento para motos','Sería bueno una zona techada para motos.','Cliente Frecuente','584241600004','web','resuelto','baja');

  raise notice 'Seed de demostración aplicado.';
end $$;
