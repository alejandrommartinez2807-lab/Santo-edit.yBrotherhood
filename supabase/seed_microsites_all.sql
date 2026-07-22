-- ============================================================
-- Concepto La Granja · Micrositios de TODOS los locales ocupados
-- Requiere 0017_microsites y 0018_microsite_products.
-- Idempotente: actualiza por código dentro del primer centro comercial;
-- se puede correr las veces que haga falta. Reemplaza/amplía el seed de 3
-- locales (seed_microsites_demo.sql) y arregla una imagen rota de Fígaro.
-- Cada local tiene su propio color (accent_color), portada, historia,
-- horario y productos con precio e imagen — para presentar el sistema.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

do $$
declare b uuid;
begin
  select id into b from branches order by sort_order, created_at limit 1;
  if b is null then raise notice 'Sin centro comercial: nada que sembrar.'; return; end if;

  -- ================= ANCLAS =================

  -- S-01 Supermercados Kalea (supermercado)
  update units set microsite_enabled=true, microsite_slug='supermercados-kalea', accent_color='#1e8449',
    tagline='Todo tu mercado fresco, en un solo lugar',
    description='Supermercado ancla del centro comercial con frutas y verduras frescas, charcutería, panadería propia y más de 8.000 productos. Aceptamos todos los métodos de pago, incluida divisa y pago móvil.',
    phone='0241-555-1001', microsite_whatsapp='584121001001', instagram='@kalea.super',
    hours=E'Lun–Dom 08:00–21:00',
    promo='🥕 Martes y miércoles: frutas y verduras con 20% de descuento',
    cover_url='/img/tiendas/photo-1542838132-92c53300491e-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1488459716781-31db52582fe9-800.jpg"},{"url":"/img/tiendas/photo-1506617420156-8e4536971650-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Frutas y verduras frescas","price":0,"image":"/img/tiendas/photo-1488459716781-31db52582fe9-800.jpg","description":"Recibimos cosecha fresca todos los días"},
      {"name":"Frutas de temporada","price":0,"image":"/img/tiendas/photo-1618160702438-9b02ab6515c9-800.jpg","description":"Selección de la semana"},
      {"name":"Combo despensa semanal","price":25,"image":"/img/tiendas/photo-1506617420156-8e4536971650-800.jpg","description":"Arroz, harina, pasta, aceite y más"}
    ]'::jsonb
  where branch_id=b and code='S-01';

  -- A-01 Beco (moda / por departamentos)
  update units set microsite_enabled=true, microsite_slug='beco', accent_color='#7d3c98',
    tagline='Moda y hogar para toda la familia',
    description='Tienda por departamentos con moda de dama, caballero y niños, además de hogar y belleza. Temporadas nuevas cada mes y planes de crédito para clientes frecuentes.',
    phone='0241-555-1002', microsite_whatsapp='584121001002', instagram='@beco.tiendas',
    hours=E'Lun–Sáb 10:00–20:00\nDom 11:00–19:00',
    promo='👗 Nueva temporada: hasta 30% en moda de dama',
    cover_url='/img/tiendas/photo-1441984904996-e0b6ba687e04-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1445205170230-053b83016050-800.jpg"},{"url":"/img/tiendas/photo-1489987707025-afc232f7ea0f-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Camisas de caballero","price":12,"image":"/img/tiendas/photo-1596755094514-f87e34085b2c-800.jpg","description":"Desde $12 en tallas S a XXL"},
      {"name":"Jeans de dama","price":18,"image":"/img/tiendas/photo-1541099649105-f69ad21f3246-800.jpg","description":"Cortes clásicos y de moda"},
      {"name":"Vestidos de temporada","price":25,"image":"/img/tiendas/photo-1595777457583-95e059d581b8-800.jpg","description":"Colección nueva cada mes"}
    ]'::jsonb
  where branch_id=b and code='A-01';

  -- M-01 SuperCines (entretenimiento)
  update units set microsite_enabled=true, microsite_slug='supercines', accent_color='#2c3e50',
    tagline='Los estrenos, en pantalla gigante',
    description='Cinco salas con sonido envolvente, estrenos de cartelera cada jueves y combos de dulcería. Compra tu entrada en taquilla o resérvala por WhatsApp.',
    phone='0241-555-1003', microsite_whatsapp='584121001003', instagram='@supercines.cc',
    hours=E'Lun–Dom 12:00–22:30',
    promo='🎬 Miércoles 2x1 en entradas 2D',
    cover_url='/img/tiendas/photo-1489599849927-2ee91cede3ba-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1517604931442-7e0c8ed2963c-800.jpg"},{"url":"/img/tiendas/photo-1512070679279-8988d32161be-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Entrada 2D","price":4,"image":"/img/tiendas/photo-1489599849927-2ee91cede3ba-800.jpg","description":"Todas las funciones del día"},
      {"name":"Entrada 3D","price":6,"image":"/img/tiendas/photo-1517604931442-7e0c8ed2963c-800.jpg","description":"Lentes incluidos"},
      {"name":"Combo cotufas + refresco","price":5.5,"image":"/img/tiendas/photo-1512070679279-8988d32161be-800.jpg","description":"Cotufas medianas + bebida"},
      {"name":"Función VIP","price":8,"image":"/img/tiendas/photo-1440404653325-ab127d49abc1-800.jpg","description":"Butacas reclinables"}
    ]'::jsonb
  where branch_id=b and code='M-01';

  -- B-01 Banco Nacional (banco)
  update units set microsite_enabled=true, microsite_slug='banco-nacional', accent_color='#1a5276',
    tagline='Tu agencia bancaria dentro del centro comercial',
    description='Agencia con taquillas, cajeros automáticos y atención comercial. Apertura de cuentas, tarjetas, pago móvil y créditos para comercios del centro comercial.',
    phone='0241-555-1004', microsite_whatsapp='584121001004', instagram='@banconacional',
    hours=E'Lun–Vie 08:30–15:30',
    cover_url='/img/tiendas/photo-1554224155-6726b3ff858f-1200.jpg',
    featured_products='[
      {"name":"Cuentas y tarjetas","price":0,"image":"/img/tiendas/photo-1601597111158-2fceff292cdc-800.jpg","description":"Apertura el mismo día con tu cédula y RIF"},
      {"name":"Pago móvil y transferencias","price":0,"image":"/img/tiendas/photo-1563013544-824ae1b704d3-800.jpg","description":"Afiliación y soporte en taquilla"},
      {"name":"Créditos comerciales","price":0,"image":"/img/tiendas/photo-1554224155-6726b3ff858f-800.jpg","description":"Para los comercios del centro comercial"}
    ]'::jsonb
  where branch_id=b and code='B-01';

  -- ================= FERIA DE COMIDA =================

  -- F-01 Capitán Grill Burger (comida) — ya existía: se completa con color y productos
  update units set microsite_enabled=true, microsite_slug='capitan-grill', accent_color='#d35400',
    tagline='Las mejores hamburguesas a la parrilla de Naguanagua',
    description='En Capitán Grill Burger hacemos hamburguesas artesanales con carne 100% de res a la parrilla, pan brioche y papas al momento. Ven a la feria de comida del centro comercial y arma tu combo favorito.',
    phone='0241-555-1201', microsite_whatsapp='584121112233', instagram='@capitangrill',
    hours=E'Lun–Jue 11:00–21:00\nVie–Sáb 11:00–22:00\nDom 12:00–20:00',
    promo='🍔 Combo doble + papas + refresco a precio especial toda la semana',
    cover_url='/img/tiendas/photo-1571091718767-18b5b1457add-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1550547660-d9450f859349-800.jpg"},{"url":"/img/tiendas/photo-1586190848861-99aa4a171e90-800.jpg"},{"url":"/img/tiendas/photo-1553979459-d2229ba7433b-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"La Capitana","price":6.5,"image":"/img/tiendas/photo-1568901346375-23c9450c58cd-800.jpg","description":"Carne a la parrilla, queso amarillo, tocineta"},
      {"name":"Doble Tocineta","price":7.5,"image":"/img/tiendas/photo-1550547660-d9450f859349-800.jpg","description":"Doble carne, doble queso, tocineta crocante"},
      {"name":"Combo + papas y refresco","price":8,"image":"/img/tiendas/photo-1586190848861-99aa4a171e90-800.jpg","description":"Cualquier burger + papas + bebida"},
      {"name":"Malteada de la casa","price":3.5,"image":"/img/tiendas/photo-1573080496219-bb080dd4f877-800.jpg","description":"Chocolate, fresa o vainilla"}
    ]'::jsonb
  where branch_id=b and code='F-01';

  -- F-02 María Paleta (comida)
  update units set microsite_enabled=true, microsite_slug='maria-paleta', accent_color='#e91e63',
    tagline='Paletas artesanales hechas con fruta de verdad',
    description='Paletas cremosas y de fruta natural hechas en casa, sin colorantes. El postre favorito de la feria de comida: pídela bañada en chocolate con toppings.',
    phone='0241-555-1202', microsite_whatsapp='584121001202', instagram='@mariapaleta',
    hours=E'Lun–Dom 12:00–21:00',
    promo='🍧 Combo 3 paletas de fruta por $5',
    cover_url='/img/tiendas/photo-1501443762994-82bd5dace89a-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1505394033641-40c6ad1178d7-800.jpg"},{"url":"/img/tiendas/photo-1563805042-7684c019e1cb-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Paleta de fruta natural","price":2,"image":"/img/tiendas/photo-1505394033641-40c6ad1178d7-800.jpg","description":"Mango, fresa, parchita o limón"},
      {"name":"Paleta cremosa","price":2.5,"image":"/img/tiendas/photo-1488900128323-21503983a07e-800.jpg","description":"Chocolate, arequipe o coco"},
      {"name":"Copa especial","price":3.5,"image":"/img/tiendas/photo-1563805042-7684c019e1cb-800.jpg","description":"Helado + toppings + sirope"}
    ]'::jsonb
  where branch_id=b and code='F-02';

  -- F-03 Pollos a la Brasa (comida)
  update units set microsite_enabled=true, microsite_slug='pollos-a-la-brasa', accent_color='#a04000',
    tagline='Pollo dorado al carbón, como en casa',
    description='Pollos enteros y por porciones asados lentamente al carbón, con nuestras salsas de la casa y contornos criollos. Ideal para llevar o compartir en familia.',
    phone='0241-555-1203', microsite_whatsapp='584121001203', instagram='@pollosalabrasa.cc',
    hours=E'Lun–Dom 11:00–21:00',
    promo='🍗 Pollo entero + 2 contornos: precio familiar los domingos',
    cover_url='/img/tiendas/photo-1598103442097-8b74394b95c6-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1594221708779-94832f4320d1-800.jpg"},{"url":"/img/tiendas/photo-1555939594-58d7cb561ad1-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Pollo entero + 2 contornos","price":12,"image":"/img/tiendas/photo-1598103442097-8b74394b95c6-800.jpg","description":"Arroz, ensalada, yuca o papas"},
      {"name":"Medio pollo","price":7,"image":"/img/tiendas/photo-1594221708779-94832f4320d1-800.jpg","description":"Con un contorno a elección"},
      {"name":"Cuarto de pollo","price":4.5,"image":"/img/tiendas/photo-1532550907401-a500c9a57435-800.jpg","description":"Pierna o pechuga"},
      {"name":"Parrilla familiar","price":18,"image":"/img/tiendas/photo-1555939594-58d7cb561ad1-800.jpg","description":"Pollo + carne + chorizo para 4"}
    ]'::jsonb
  where branch_id=b and code='F-03';

  -- F-04 Sushi Express (comida)
  update units set microsite_enabled=true, microsite_slug='sushi-express', accent_color='#16a085',
    tagline='Sushi fresco al momento, sin esperas',
    description='Rollos preparados al momento con salmón fresco y arroz de sushi auténtico. Combinados para compartir y bowls estilo poke para almorzar distinto.',
    phone='0241-555-1204', microsite_whatsapp='584121001204', instagram='@sushiexpress.vzla',
    hours=E'Lun–Dom 12:00–21:00',
    promo='🍣 Martes de rollos: 8 piezas extra en tu combinado',
    cover_url='/img/tiendas/photo-1579871494447-9811cf80d66c-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1553621042-f6e147245754-800.jpg"},{"url":"/img/tiendas/photo-1611143669185-af224c5e3252-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Rollo California 8p","price":6,"image":"/img/tiendas/photo-1579871494447-9811cf80d66c-800.jpg","description":"Cangrejo, aguacate y ajonjolí"},
      {"name":"Rollo tempura 8p","price":7.5,"image":"/img/tiendas/photo-1553621042-f6e147245754-800.jpg","description":"Camarón tempura y queso crema"},
      {"name":"Combinado 16 piezas","price":12,"image":"/img/tiendas/photo-1611143669185-af224c5e3252-800.jpg","description":"Selección del chef para compartir"},
      {"name":"Bowl poke","price":8,"image":"/img/tiendas/photo-1476224203421-9ac39bcb3327-800.jpg","description":"Arroz, salmón, aguacate y vegetales"}
    ]'::jsonb
  where branch_id=b and code='F-04';

  -- MZ-10 Comida China Wok (comida)
  update units set microsite_enabled=true, microsite_slug='comida-china-wok', accent_color='#c0392b',
    tagline='Sabor oriental al wok, porciones abundantes',
    description='Cocina china al wok con el toque criollo que nos encanta: arroz frito, fideos salteados y combos familiares listos en minutos.',
    phone='0241-555-1210', microsite_whatsapp='584121001210', instagram='@wok.cc',
    hours=E'Lun–Dom 11:30–21:00',
    cover_url='/img/tiendas/photo-1585032226651-759b368d7246-1200.jpg',
    featured_products='[
      {"name":"Arroz frito especial","price":5.5,"image":"/img/tiendas/photo-1585032226651-759b368d7246-800.jpg","description":"Pollo, cerdo y camarones"},
      {"name":"Fideos salteados con pollo","price":6,"image":"/img/tiendas/photo-1563245372-f21724e3856d-800.jpg","description":"Al wok con vegetales frescos"},
      {"name":"Combo familiar","price":15,"image":"/img/tiendas/photo-1414235077428-338989a2e8c0-800.jpg","description":"Para 2-3 personas, incluye lumpias"}
    ]'::jsonb
  where branch_id=b and code='MZ-10';

  -- ================= PLANTA BAJA =================

  -- PB-02 Farmacia SaludYa (salud)
  update units set microsite_enabled=true, microsite_slug='farmacia-saludya', accent_color='#27ae60',
    tagline='Tu farmacia de confianza, con atención farmacéutica',
    description='Medicinas, vitaminas, dermocosmética y cuidado del bebé con farmacéutico de turno todo el día. Consultamos disponibilidad y te la reservamos por WhatsApp.',
    phone='0241-555-1302', microsite_whatsapp='584121001302', instagram='@saludya.farmacia',
    hours=E'Lun–Dom 08:00–21:00',
    promo='💊 Toma de tensión gratis todos los días',
    cover_url='/img/tiendas/photo-1587854692152-cbe660dbde88-1200.jpg',
    featured_products='[
      {"name":"Medicinas con y sin récipe","price":0,"image":"/img/tiendas/photo-1584308666744-24d5c474f2ae-800.jpg","description":"Consulta disponibilidad por WhatsApp"},
      {"name":"Vitamina C x30","price":4.5,"image":"/img/tiendas/photo-1471864190281-a93a3070b6de-800.jpg","description":"Y todo el mundo de suplementos"},
      {"name":"Dermocosmética","price":0,"image":"/img/tiendas/photo-1571781926291-c477ebfd024b-800.jpg","description":"Protectores, cremas y cuidado facial"}
    ]'::jsonb
  where branch_id=b and code='PB-02';

  -- PB-03 Fígaro Barbiere (belleza) — se completa y se arregla la imagen rota de la galería
  update units set microsite_enabled=true, microsite_slug='figaro-barbiere', accent_color='#34495e',
    tagline='Barbería clásica: cortes, barba y afeitado a navaja',
    description='Fígaro Barbiere es tu barbería de confianza en el centro comercial. Cortes clásicos y modernos, arreglo de barba, afeitado a navaja caliente y atención sin apuro. Reserva por WhatsApp o pásate directo.',
    phone='0241-555-1303', microsite_whatsapp='584121114455', instagram='@figaro.barbiere',
    hours=E'Lun–Sáb 09:00–19:00\nDom cerrado',
    promo='💈 Corte + barba con precio combo de martes a jueves',
    cover_url='/img/tiendas/photo-1585747860715-2ba37e788b70-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1503951914875-452162b0f3f1-800.jpg"},{"url":"/img/tiendas/photo-1599351431202-1e0f0137899a-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Corte clásico","price":8,"image":"/img/tiendas/photo-1503951914875-452162b0f3f1-800.jpg","description":"Tijera y máquina, con lavado"},
      {"name":"Corte + barba","price":12,"image":"/img/tiendas/photo-1599351431202-1e0f0137899a-800.jpg","description":"El combo favorito de la casa"},
      {"name":"Afeitado a navaja","price":6,"image":"/img/tiendas/photo-1585747860715-2ba37e788b70-800.jpg","description":"Con toalla caliente"}
    ]'::jsonb
  where branch_id=b and code='PB-03';

  -- PB-04 Óptica Visión (salud)
  update units set microsite_enabled=true, microsite_slug='optica-vision', accent_color='#2980b9',
    tagline='Ve mejor, luce mejor',
    description='Exámenes visuales computarizados, monturas para toda la familia y lentes de sol originales. Entregamos tus lentes formulados en 48 horas.',
    phone='0241-555-1304', microsite_whatsapp='584121001304', instagram='@opticavision.cc',
    hours=E'Lun–Sáb 10:00–19:00',
    promo='👓 Examen de la vista GRATIS con la compra de tu montura',
    cover_url='/img/tiendas/photo-1574258495973-f010dfbb5371-1200.jpg',
    featured_products='[
      {"name":"Monturas","price":20,"image":"/img/tiendas/photo-1574258495973-f010dfbb5371-800.jpg","description":"Desde $20, más de 200 modelos"},
      {"name":"Lentes de sol","price":25,"image":"/img/tiendas/photo-1511499767150-a48a237f0083-800.jpg","description":"Protección UV400 certificada"},
      {"name":"Examen visual computarizado","price":0,"image":"/img/tiendas/photo-1508296695146-257a814070b4-800.jpg","description":"Con optometrista certificado"}
    ]'::jsonb
  where branch_id=b and code='PB-04';

  -- PB-05 Joyería El Diamante (servicios)
  update units set microsite_enabled=true, microsite_slug='joyeria-el-diamante', accent_color='#b7950b',
    tagline='Joyas que cuentan tu historia',
    description='Oro 18k, plata 925 y relojería fina. Diseños propios, reparación de joyas y grabado personalizado para ocasiones especiales.',
    phone='0241-555-1305', microsite_whatsapp='584121001305', instagram='@eldiamante.joyeria',
    hours=E'Lun–Sáb 10:00–19:00',
    cover_url='/img/tiendas/photo-1599643478518-a784e5dc4c8f-1200.jpg',
    featured_products='[
      {"name":"Anillos de compromiso","price":0,"image":"/img/tiendas/photo-1515562141207-7a88fb7ce338-800.jpg","description":"Oro 18k con certificado"},
      {"name":"Cadenas y pulseras","price":0,"image":"/img/tiendas/photo-1599643478518-a784e5dc4c8f-800.jpg","description":"Oro y plata 925"},
      {"name":"Argollas de matrimonio","price":0,"image":"/img/tiendas/photo-1605100804763-247f67b3557e-800.jpg","description":"Grabado personalizado incluido"}
    ]'::jsonb
  where branch_id=b and code='PB-05';

  -- PB-06 TecnoStore (electrónica) — se completa con color y productos
  update units set microsite_enabled=true, microsite_slug='tecnostore', accent_color='#2471a3',
    tagline='Celulares, accesorios y servicio técnico',
    description='TecnoStore ofrece teléfonos, accesorios, cargadores, audífonos y servicio técnico con garantía. Cambiamos pantallas y baterías el mismo día. Te asesoramos para que elijas el equipo ideal.',
    phone='0241-555-1406', microsite_whatsapp='584121116677', instagram='@tecnostore.cc',
    hours=E'Lun–Sáb 10:00–20:00\nDom 11:00–18:00',
    promo='📱 Instalación de vidrio templado gratis al comprar tu forro',
    cover_url='/img/tiendas/photo-1511707171634-5f897ff02aa9-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1580910051074-3eb694886505-800.jpg"},{"url":"/img/tiendas/photo-1512499617640-c74ae3a79d37-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Audífonos inalámbricos","price":18,"image":"/img/tiendas/photo-1505740420928-5e560c06d30e-800.jpg","description":"Bluetooth 5.3 con estuche de carga"},
      {"name":"Smartwatch","price":35,"image":"/img/tiendas/photo-1546868871-7041f2a55e12-800.jpg","description":"Notificaciones, salud y deporte"},
      {"name":"Forro + vidrio instalado","price":8,"image":"/img/tiendas/photo-1590874103328-eac38a683ce7-800.jpg","description":"Para todos los modelos"},
      {"name":"Cambio de pantalla","price":25,"image":"/img/tiendas/photo-1580910051074-3eb694886505-800.jpg","description":"Desde $25, el mismo día"}
    ]'::jsonb
  where branch_id=b and code='PB-06';

  -- PB-07 Zapatería Pasos (moda)
  update units set microsite_enabled=true, microsite_slug='zapateria-pasos', accent_color='#ca6f1e',
    tagline='El paso que te faltaba',
    description='Calzado deportivo, casual y de vestir para dama, caballero y niños. Marcas originales y tallas completas de la 21 a la 45.',
    phone='0241-555-1307', microsite_whatsapp='584121001307', instagram='@zapateriapasos',
    hours=E'Lun–Sáb 10:00–20:00\nDom 11:00–18:00',
    promo='👟 Segundo par a mitad de precio en línea escolar',
    cover_url='/img/tiendas/photo-1560769629-975ec94e6a86-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1600185365483-26d7a4cc7519-800.jpg"},{"url":"/img/tiendas/photo-1600180758890-6b94519a8ba6-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Deportivos","price":22,"image":"/img/tiendas/photo-1542291026-7eec264c27ff-800.jpg","description":"Desde $22, dama y caballero"},
      {"name":"Casuales de caballero","price":28,"image":"/img/tiendas/photo-1549298916-b41d501d3772-800.jpg","description":"Cuero genuino"},
      {"name":"Tacones de dama","price":24,"image":"/img/tiendas/photo-1543163521-1bf539c55dd2-800.jpg","description":"Fiesta y oficina"},
      {"name":"Sandalias","price":15,"image":"/img/tiendas/photo-1595950653106-6c9ebd614d3a-800.jpg","description":"Comodidad para el día a día"}
    ]'::jsonb
  where branch_id=b and code='PB-07';

  -- PB-08 Boutique Bella (moda)
  update units set microsite_enabled=true, microsite_slug='boutique-bella', accent_color='#c2185b',
    tagline='Moda femenina con estilo propio',
    description='Ropa de dama seleccionada pieza a pieza: vestidos, blusas y conjuntos que no verás en todos lados. Asesoría de imagen sin costo al comprar.',
    phone='0241-555-1308', microsite_whatsapp='584121001308', instagram='@boutiquebella.vzla',
    hours=E'Lun–Sáb 10:00–19:30',
    promo='🛍️ Estrena viernes: 15% en tu segunda pieza',
    cover_url='/img/tiendas/photo-1489987707025-afc232f7ea0f-1200.jpg',
    featured_products='[
      {"name":"Vestidos casuales","price":20,"image":"/img/tiendas/photo-1595777457583-95e059d581b8-800.jpg","description":"Tallas S a XL"},
      {"name":"Blusas de temporada","price":12,"image":"/img/tiendas/photo-1445205170230-053b83016050-800.jpg","description":"Nuevos modelos cada semana"},
      {"name":"Maquillaje y accesorios","price":0,"image":"/img/tiendas/photo-1522335789203-aabd1fc54bc9-800.jpg","description":"El toque final de tu look"}
    ]'::jsonb
  where branch_id=b and code='PB-08';

  -- PB-09 Juguetería Mundo Feliz (hogar)
  update units set microsite_enabled=true, microsite_slug='jugueteria-mundo-feliz', accent_color='#e67e22',
    tagline='Donde los regalos se vuelven sonrisas',
    description='Juguetes didácticos, peluches y juegos de mesa para todas las edades. Te ayudamos a elegir el regalo perfecto y lo envolvemos gratis.',
    phone='0241-555-1309', microsite_whatsapp='584121001309', instagram='@mundofeliz.jugueteria',
    hours=E'Lun–Sáb 10:00–20:00\nDom 11:00–18:00',
    promo='🎁 Envoltura de regalo GRATIS todo el año',
    cover_url='/img/tiendas/photo-1596461404969-9ae70f2830c1-1200.jpg',
    featured_products='[
      {"name":"Peluches","price":8,"image":"/img/tiendas/photo-1516627145497-ae6968895b74-800.jpg","description":"Desde $8, todos los tamaños"},
      {"name":"Juguetes didácticos de madera","price":12,"image":"/img/tiendas/photo-1587654780291-39c9404d746b-800.jpg","description":"Aprender jugando"},
      {"name":"Juegos y sets","price":15,"image":"/img/tiendas/photo-1596461404969-9ae70f2830c1-800.jpg","description":"Para compartir en familia"}
    ]'::jsonb
  where branch_id=b and code='PB-09';

  -- PB-10 Panadería La Espiga (comida)
  update units set microsite_enabled=true, microsite_slug='panaderia-la-espiga', accent_color='#9c640c',
    tagline='Pan caliente a toda hora',
    description='Panadería y pastelería artesanal: pan campesino, canillas, dulcería criolla y tortas por encargo. Hornadas frescas en la mañana y en la tarde.',
    phone='0241-555-1310', microsite_whatsapp='584121001310', instagram='@laespiga.pan',
    hours=E'Lun–Dom 07:00–20:30',
    promo='🥖 Hornada de las 4pm: pan campesino recién salido',
    cover_url='/img/tiendas/photo-1509440159596-0249088772ff-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1555507036-ab1f4038808a-800.jpg"},{"url":"/img/tiendas/photo-1519415943484-9fa1873496d4-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Pan campesino","price":1.5,"image":"/img/tiendas/photo-1509440159596-0249088772ff-800.jpg","description":"Masa madre, corteza crujiente"},
      {"name":"Croissant de mantequilla","price":2,"image":"/img/tiendas/photo-1549931319-a545dcf3bc73-800.jpg","description":"Hojaldrado y dorado"},
      {"name":"Canillas y pan dulce","price":1,"image":"/img/tiendas/photo-1517433670267-08bbd4be890f-800.jpg","description":"El clásico de todos los días"},
      {"name":"Tortas por encargo","price":18,"image":"/img/tiendas/photo-1578985545062-69928b1d9587-800.jpg","description":"Cumpleaños y ocasiones especiales"}
    ]'::jsonb
  where branch_id=b and code='PB-10';

  -- PB-11 Heladería Frost (comida)
  update units set microsite_enabled=true, microsite_slug='heladeria-frost', accent_color='#00acc1',
    tagline='El frío que provoca',
    description='Helados artesanales con más de 20 sabores, barquillas, copas y malteadas. Sabores tropicales que solo consigues aquí: parchita, guanábana y mantecado criollo.',
    phone='0241-555-1311', microsite_whatsapp='584121001311', instagram='@frost.heladeria',
    hours=E'Lun–Dom 11:00–21:00',
    cover_url='/img/tiendas/photo-1497034825429-c343d7c6a68f-1200.jpg',
    featured_products='[
      {"name":"Barquilla 1 sabor","price":2,"image":"/img/tiendas/photo-1497034825429-c343d7c6a68f-800.jpg","description":"Más de 20 sabores artesanales"},
      {"name":"Copa sundae","price":4,"image":"/img/tiendas/photo-1501443762994-82bd5dace89a-800.jpg","description":"2 sabores + sirope + toppings"},
      {"name":"Malteada","price":3.5,"image":"/img/tiendas/photo-1573080496219-bb080dd4f877-800.jpg","description":"Cremosa, con el sabor que quieras"}
    ]'::jsonb
  where branch_id=b and code='PB-11';

  -- PB-12 Librería Papel (hogar)
  update units set microsite_enabled=true, microsite_slug='libreria-papel', accent_color='#6c3483',
    tagline='Historias, ideas y útiles para crear',
    description='Librería y papelería: novedades literarias, libros infantiles, útiles escolares y de oficina. Hacemos pedidos especiales de títulos que no tengamos en tienda.',
    phone='0241-555-1312', microsite_whatsapp='584121001312', instagram='@libreriapapel',
    hours=E'Lun–Sáb 09:30–19:30',
    promo='📚 Lista escolar completa con 10% de descuento',
    cover_url='/img/tiendas/photo-1524578271613-d550eacf6090-1200.jpg',
    featured_products='[
      {"name":"Novedades y best sellers","price":0,"image":"/img/tiendas/photo-1512820790803-83ca734da794-800.jpg","description":"Los títulos del momento"},
      {"name":"Útiles escolares","price":0,"image":"/img/tiendas/photo-1503676260728-1c00da094a0b-800.jpg","description":"Todo para el regreso a clases"},
      {"name":"Agendas y cuadernos","price":3,"image":"/img/tiendas/photo-1456735190827-d1262f71b8a3-800.jpg","description":"Desde $3"}
    ]'::jsonb
  where branch_id=b and code='PB-12';

  -- PB-13 Peluquería Glamour (belleza)
  update units set microsite_enabled=true, microsite_slug='peluqueria-glamour', accent_color='#ad1457',
    tagline='Sal con tu mejor versión',
    description='Salón de belleza integral: corte, color, keratinas, manicure y pedicure spa. Productos profesionales y estilistas con más de 10 años de experiencia.',
    phone='0241-555-1313', microsite_whatsapp='584121001313', instagram='@glamour.salon',
    hours=E'Mar–Sáb 09:00–19:00\nDom–Lun cerrado',
    promo='💅 Lunes de manicure + pedicure a precio especial',
    cover_url='/img/tiendas/photo-1560066984-138dadb4c035-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1595476108010-b4d1f102b1b1-800.jpg"},{"url":"/img/tiendas/photo-1562322140-8baeececf3df-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Corte y cepillado","price":10,"image":"/img/tiendas/photo-1522337660859-02fbefca4702-800.jpg","description":"Incluye lavado y tratamiento"},
      {"name":"Tinte y mechas","price":25,"image":"/img/tiendas/photo-1562322140-8baeececf3df-800.jpg","description":"Desde $25 según largo"},
      {"name":"Manicure","price":6,"image":"/img/tiendas/photo-1610992015732-2449b76344bc-800.jpg","description":"Tradicional o semipermanente"},
      {"name":"Pedicure spa","price":8,"image":"/img/tiendas/photo-1576506295286-5cda18df43e7-800.jpg","description":"Con exfoliación y masaje"}
    ]'::jsonb
  where branch_id=b and code='PB-13';

  -- PB-14 Perfumería Esencia (belleza)
  update units set microsite_enabled=true, microsite_slug='perfumeria-esencia', accent_color='#884ea0',
    tagline='Tu aroma dice quién eres',
    description='Perfumes originales de diseñador, fragancias árabes y cosméticos. Te ayudamos a encontrar tu aroma ideal con nuestra barra de pruebas.',
    phone='0241-555-1314', microsite_whatsapp='584121001314', instagram='@esencia.perfumes',
    hours=E'Lun–Sáb 10:00–20:00',
    promo='🌸 Kit de regalo con empaque premium sin costo',
    cover_url='/img/tiendas/photo-1541643600914-78b084683601-1200.jpg',
    featured_products='[
      {"name":"Perfumes de diseñador","price":0,"image":"/img/tiendas/photo-1541643600914-78b084683601-800.jpg","description":"100% originales con garantía"},
      {"name":"Fragancias árabes","price":18,"image":"/img/tiendas/photo-1592945403244-b3fbafd7f539-800.jpg","description":"Desde $18, larga duración"},
      {"name":"Cosméticos","price":0,"image":"/img/tiendas/photo-1596462502278-27bfdc403348-800.jpg","description":"Marcas profesionales"},
      {"name":"Kits de regalo","price":22,"image":"/img/tiendas/photo-1585386959984-a4155224a1ad-800.jpg","description":"Perfume + crema en estuche"}
    ]'::jsonb
  where branch_id=b and code='PB-14';

  -- PB-15 Mueblería Confort (hogar)
  update units set microsite_enabled=true, microsite_slug='muebleria-confort', accent_color='#784212',
    tagline='Muebles que hacen hogar',
    description='Sofás, juegos de dormitorio y comedores fabricados en Venezuela con madera de calidad. Entrega e instalación en Naguanagua y Valencia sin costo.',
    phone='0241-555-1315', microsite_whatsapp='584121001315', instagram='@confort.muebles',
    hours=E'Lun–Sáb 10:00–19:00',
    promo='🛋️ Entrega gratis en Naguanagua y San Diego',
    cover_url='/img/tiendas/photo-1538688525198-9b88f6f53126-1200.jpg',
    featured_products='[
      {"name":"Sofás","price":250,"image":"/img/tiendas/photo-1555041469-a586c61ea9bc-800.jpg","description":"Desde $250, telas a elección"},
      {"name":"Juego de dormitorio","price":380,"image":"/img/tiendas/photo-1567016432779-094069958ea5-800.jpg","description":"Cama + mesas de noche + peinadora"},
      {"name":"Poltronas","price":120,"image":"/img/tiendas/photo-1493663284031-b7e3aefcae8e-800.jpg","description":"Reclinables y decorativas"}
    ]'::jsonb
  where branch_id=b and code='PB-15';

  -- PB-16 Agencia de Viajes Mundo (servicios)
  update units set microsite_enabled=true, microsite_slug='agencia-viajes-mundo', accent_color='#0e6655',
    tagline='Tu próximo destino empieza aquí',
    description='Boletos aéreos, paquetes nacionales e internacionales y asesoría de visas. Planes a Margarita, Canaima y el Caribe con financiamiento.',
    phone='0241-555-1316', microsite_whatsapp='584121001316', instagram='@viajesmundo.agencia',
    hours=E'Lun–Vie 09:00–18:00\nSáb 09:00–14:00',
    promo='✈️ Margarita todo incluido: reserva con 30% de inicial',
    cover_url='/img/tiendas/photo-1507525428034-b723cf961d3e-1200.jpg',
    featured_products='[
      {"name":"Paquetes a Margarita","price":0,"image":"/img/tiendas/photo-1507525428034-b723cf961d3e-800.jpg","description":"Vuelo + hotel todo incluido"},
      {"name":"Boletos aéreos","price":0,"image":"/img/tiendas/photo-1436491865332-7a61a109cc05-800.jpg","description":"Nacionales e internacionales"},
      {"name":"Planes internacionales","price":0,"image":"/img/tiendas/photo-1488646953014-85cb44e25828-800.jpg","description":"Caribe, Europa y más"},
      {"name":"Escapadas de playa","price":0,"image":"/img/tiendas/photo-1502920917128-1aa500764cbd-800.jpg","description":"Fines de semana desde Valencia"}
    ]'::jsonb
  where branch_id=b and code='PB-16';

  -- PB-17 Floristería Jardín (servicios)
  update units set microsite_enabled=true, microsite_slug='floristeria-jardin', accent_color='#229954',
    tagline='Flores frescas para cada ocasión',
    description='Ramos, arreglos y decoración floral con flores frescas de los Andes. Entregas a domicilio el mismo día en Naguanagua y Valencia.',
    phone='0241-555-1317', microsite_whatsapp='584121001317', instagram='@jardin.floristeria',
    hours=E'Lun–Sáb 09:00–19:00\nDom 09:00–13:00',
    promo='🌹 Entrega a domicilio el mismo día',
    cover_url='/img/tiendas/photo-1490750967868-88aa4486c946-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1563241527-3004b7be0ffd-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Ramo de rosas x12","price":15,"image":"/img/tiendas/photo-1526047932273-341f2a7631f9-800.jpg","description":"Rosas frescas con follaje"},
      {"name":"Arreglos para eventos","price":0,"image":"/img/tiendas/photo-1490750967868-88aa4486c946-800.jpg","description":"Bodas, cumpleaños y empresas"},
      {"name":"Bouquet del día","price":8,"image":"/img/tiendas/photo-1519378058457-4c29a0a2efac-800.jpg","description":"Flores de temporada"}
    ]'::jsonb
  where branch_id=b and code='PB-17';

  -- ================= MEZZANINA =================

  -- MZ-01 Gimnasio FitZone (servicios)
  update units set microsite_enabled=true, microsite_slug='gimnasio-fitzone', accent_color='#e74c3c',
    tagline='Entrena duro, vive mejor',
    description='200 m² de máquinas nuevas, área de peso libre y clases grupales. Entrenadores certificados y planes para todos los niveles, desde principiante hasta competencia.',
    phone='0241-555-1401', microsite_whatsapp='584121001401', instagram='@fitzone.gym',
    hours=E'Lun–Vie 06:00–21:00\nSáb 07:00–17:00\nDom 08:00–13:00',
    promo='💪 Inscripción GRATIS este mes',
    cover_url='/img/tiendas/photo-1583454110551-21f2fa2afe61-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1534438327276-14e5300c3a48-800.jpg"},{"url":"/img/tiendas/photo-1540497077202-7c8a3999166f-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Mensualidad","price":25,"image":"/img/tiendas/photo-1534438327276-14e5300c3a48-800.jpg","description":"Acceso ilimitado + clases grupales"},
      {"name":"Plan trimestral","price":65,"image":"/img/tiendas/photo-1517836357463-d25dfeac3438-800.jpg","description":"Ahorra $10 vs mensual"},
      {"name":"Entrenamiento personalizado","price":40,"image":"/img/tiendas/photo-1571019613454-1cb2f99b2d8b-800.jpg","description":"8 sesiones con coach"},
      {"name":"Pase por día","price":3,"image":"/img/tiendas/photo-1540497077202-7c8a3999166f-800.jpg","description":"Conoce el gym sin compromiso"}
    ]'::jsonb
  where branch_id=b and code='MZ-01';

  -- MZ-02 Ropa Deportiva Pro (moda)
  update units set microsite_enabled=true, microsite_slug='ropa-deportiva-pro', accent_color='#196f3d',
    tagline='Equípate como profesional',
    description='Todo para tu deporte: zapatos de running, ropa técnica, balones y accesorios de entrenamiento. Marcas originales con garantía.',
    phone='0241-555-1402', microsite_whatsapp='584121001402', instagram='@pro.deportes',
    hours=E'Lun–Sáb 10:00–20:00\nDom 11:00–18:00',
    cover_url='/img/tiendas/photo-1556906781-9a412961c28c-1200.jpg',
    featured_products='[
      {"name":"Zapatos de running","price":45,"image":"/img/tiendas/photo-1461896836934-ffe607ba8211-800.jpg","description":"Amortiguación profesional"},
      {"name":"Balones","price":18,"image":"/img/tiendas/photo-1519861531473-9200262188bf-800.jpg","description":"Fútbol, básquet y volleyball"},
      {"name":"Licras y monos","price":15,"image":"/img/tiendas/photo-1556906781-9a412961c28c-800.jpg","description":"Tela técnica que respira"},
      {"name":"Ciclismo","price":0,"image":"/img/tiendas/photo-1517649763962-0c623066013b-800.jpg","description":"Cascos, guantes y accesorios"}
    ]'::jsonb
  where branch_id=b and code='MZ-02';

  -- MZ-03 Celulares & Más (electrónica)
  update units set microsite_enabled=true, microsite_slug='celulares-y-mas', accent_color='#5b2c6f',
    tagline='Tecnología al alcance de tu bolsillo',
    description='Teléfonos nuevos y seminuevos con garantía, accesorios y recargas. Recibimos tu equipo usado como parte de pago.',
    phone='0241-555-1403', microsite_whatsapp='584121001403', instagram='@celularesymas.cc',
    hours=E'Lun–Sáb 10:00–20:00',
    promo='📲 Tu usado vale: plan retoma con garantía',
    cover_url='/img/tiendas/photo-1512499617640-c74ae3a79d37-1200.jpg',
    featured_products='[
      {"name":"Teléfonos nuevos y seminuevos","price":0,"image":"/img/tiendas/photo-1511707171634-5f897ff02aa9-800.jpg","description":"Con garantía escrita"},
      {"name":"Audífonos gamer","price":15,"image":"/img/tiendas/photo-1583394838336-acd977736f90-800.jpg","description":"Sonido envolvente"},
      {"name":"Relojes inteligentes","price":28,"image":"/img/tiendas/photo-1523275335684-37898b6baf30-800.jpg","description":"Compatibles Android/iPhone"}
    ]'::jsonb
  where branch_id=b and code='MZ-03';

  -- MZ-04 Café Aroma (comida)
  update units set microsite_enabled=true, microsite_slug='cafe-aroma', accent_color='#6e2c00',
    tagline='Café venezolano de especialidad',
    description='Café de altura venezolano recién molido, métodos de especialidad y dulcería para acompañar. El punto de encuentro de la mezzanina.',
    phone='0241-555-1404', microsite_whatsapp='584121001404', instagram='@aroma.cafe',
    hours=E'Lun–Dom 08:00–20:30',
    promo='☕ Combo mañanero: café + croissant hasta las 11am',
    cover_url='/img/tiendas/photo-1495474472287-4d71bcdd2085-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1470337458703-46ad1756a187-800.jpg"},{"url":"/img/tiendas/photo-1572442388796-11668a67e53d-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Espresso / marrón","price":1.5,"image":"/img/tiendas/photo-1509042239860-f550ce710b93-800.jpg","description":"Grano venezolano de altura"},
      {"name":"Cappuccino","price":2.5,"image":"/img/tiendas/photo-1541167760496-1628856ab772-800.jpg","description":"Con leche vaporizada"},
      {"name":"Latte art","price":3,"image":"/img/tiendas/photo-1572442388796-11668a67e53d-800.jpg","description":"Tan bonito como sabroso"},
      {"name":"Café en grano 500g","price":8,"image":"/img/tiendas/photo-1447933601403-0c6688de566e-800.jpg","description":"Para llevarte el aroma a casa"}
    ]'::jsonb
  where branch_id=b and code='MZ-04';

  -- MZ-05 Spa Relax (belleza)
  update units set microsite_enabled=true, microsite_slug='spa-relax', accent_color='#148f77',
    tagline='Un respiro en medio de la ciudad',
    description='Masajes terapéuticos y relajantes, piedras calientes y rituales de spa. Cabinas privadas con aromaterapia y música ambiental.',
    phone='0241-555-1405', microsite_whatsapp='584121001405', instagram='@relax.spa',
    hours=E'Lun–Sáb 10:00–19:00',
    promo='🧖 Día de spa en pareja con 20% de descuento',
    cover_url='/img/tiendas/photo-1544161515-4ab6ce6db874-1200.jpg',
    gallery='[{"url":"/img/tiendas/photo-1540555700478-4be289fbecef-800.jpg"}]'::jsonb,
    featured_products='[
      {"name":"Masaje relajante 50 min","price":30,"image":"/img/tiendas/photo-1540555700478-4be289fbecef-800.jpg","description":"Descontractura cuello y espalda"},
      {"name":"Piedras calientes","price":38,"image":"/img/tiendas/photo-1596178065887-1198b6148b2b-800.jpg","description":"Relajación profunda"},
      {"name":"Día de spa completo","price":60,"image":"/img/tiendas/photo-1544161515-4ab6ce6db874-800.jpg","description":"Masaje + facial + manicure"},
      {"name":"Manicure + pedicure","price":12,"image":"/img/tiendas/photo-1604654894610-df63bc536371-800.jpg","description":"Con esmaltado semipermanente"}
    ]'::jsonb
  where branch_id=b and code='MZ-05';

  -- MZ-06 Lavandería Express (servicios)
  update units set microsite_enabled=true, microsite_slug='lavanderia-express', accent_color='#2874a6',
    tagline='Deja tu ropa, sigue tu día',
    description='Lavado por kilo, lavado en seco y planchado profesional. Déjala mientras haces tus compras y retírala lista el mismo día.',
    phone='0241-555-1406', microsite_whatsapp='584121001406', instagram='@express.lavanderia',
    hours=E'Lun–Sáb 08:00–19:00',
    promo='🧺 Mismo día si la dejas antes de las 11am',
    cover_url='/img/tiendas/photo-1521656693074-0ef32e80a5d5-1200.jpg',
    featured_products='[
      {"name":"Lavado y secado por kilo","price":2,"image":"/img/tiendas/photo-1521656693074-0ef32e80a5d5-800.jpg","description":"Incluye doblado"},
      {"name":"Lavado en seco","price":5,"image":"/img/tiendas/photo-1545173168-9f1947eebb7f-800.jpg","description":"Trajes, vestidos y piezas delicadas"},
      {"name":"Edredones y cobijas","price":8,"image":"","description":"Todos los tamaños"}
    ]'::jsonb
  where branch_id=b and code='MZ-06';

  -- MZ-09 Barbería Clásica (belleza)
  update units set microsite_enabled=true, microsite_slug='barberia-clasica', accent_color='#515a5a',
    tagline='Corte de siempre, estilo de hoy',
    description='Barbería de barrio con espíritu clásico: buen corte, buena conversa y precios justos. Atendemos por orden de llegada, sin cita.',
    phone='0241-555-1409', microsite_whatsapp='584121001409', instagram='@barberiaclasica.cc',
    hours=E'Lun–Sáb 09:00–19:30\nDom 09:00–13:00',
    cover_url='/img/tiendas/photo-1503951914875-452162b0f3f1-1200.jpg',
    featured_products='[
      {"name":"Corte de caballero","price":7,"image":"/img/tiendas/photo-1503951914875-452162b0f3f1-800.jpg","description":"Máquina y tijera"},
      {"name":"Barba y perfilado","price":5,"image":"/img/tiendas/photo-1599351431202-1e0f0137899a-800.jpg","description":"Con navaja y toalla caliente"},
      {"name":"Combo corte + barba","price":10,"image":"/img/tiendas/photo-1585747860715-2ba37e788b70-800.jpg","description":"El favorito de la casa"}
    ]'::jsonb
  where branch_id=b and code='MZ-09';

  -- ================= KIOSCOS =================

  -- K-01 Kiosco Prensa
  update units set microsite_enabled=true, microsite_slug='kiosco-prensa', accent_color='#283747',
    tagline='Prensa, revistas y recargas',
    description='Prensa nacional y regional, revistas, snacks y recargas telefónicas de todas las operadoras. En la entrada principal, de paso rápido.',
    phone='0241-555-1501', microsite_whatsapp='584121001501', instagram='@kioscoprensa',
    hours=E'Lun–Dom 07:30–20:00',
    cover_url='/img/tiendas/photo-1504711434969-e33886168f5c-1200.jpg',
    featured_products='[
      {"name":"Prensa nacional y regional","price":0,"image":"/img/tiendas/photo-1504711434969-e33886168f5c-800.jpg","description":"Todos los días desde temprano"},
      {"name":"Revistas","price":0,"image":"/img/tiendas/photo-1457369804613-52c61a468e7d-800.jpg","description":"Moda, deportes y actualidad"},
      {"name":"Recargas telefónicas","price":0,"image":"","description":"Todas las operadoras"}
    ]'::jsonb
  where branch_id=b and code='K-01';

  -- K-02 Kiosco Dulces
  update units set microsite_enabled=true, microsite_slug='kiosco-dulces', accent_color='#a93226',
    tagline='El antojo dulce del paseo',
    description='Gomitas, chocolates nacionales e importados y dulces criollos. El punto obligado de los niños (y de los grandes también).',
    phone='0241-555-1502', microsite_whatsapp='584121001502', instagram='@kioscodulces',
    hours=E'Lun–Dom 10:00–20:30',
    cover_url='/img/tiendas/photo-1582058091505-f87a2e55a40f-1200.jpg',
    featured_products='[
      {"name":"Gomitas","price":1,"image":"/img/tiendas/photo-1582058091505-f87a2e55a40f-800.jpg","description":"Por peso y en bolsitas"},
      {"name":"Chocolates","price":1.5,"image":"/img/tiendas/photo-1549007994-cb92caebd54b-800.jpg","description":"Nacionales: El Rey, Savoy y más"},
      {"name":"Chocolate importado","price":3,"image":"/img/tiendas/photo-1511381939415-e44015466834-800.jpg","description":"Marcas premium"}
    ]'::jsonb
  where branch_id=b and code='K-02';

  -- K-03 Kiosco Accesorios
  update units set microsite_enabled=true, microsite_slug='kiosco-accesorios', accent_color='#45b39d',
    tagline='Detalles que completan tu look',
    description='Forros y vidrios para tu teléfono, lentes de sol, relojes y bisutería. Instalación de accesorios al momento.',
    phone='0241-555-1503', microsite_whatsapp='584121001503', instagram='@kioscoaccesorios',
    hours=E'Lun–Dom 10:00–20:00',
    cover_url='/img/tiendas/photo-1511499767150-a48a237f0083-1200.jpg',
    featured_products='[
      {"name":"Forros y vidrios","price":5,"image":"/img/tiendas/photo-1590874103328-eac38a683ce7-800.jpg","description":"Instalados al momento"},
      {"name":"Lentes de sol","price":8,"image":"/img/tiendas/photo-1511499767150-a48a237f0083-800.jpg","description":"Modelos de temporada"},
      {"name":"Relojes","price":12,"image":"/img/tiendas/photo-1523275335684-37898b6baf30-800.jpg","description":"Casuales y deportivos"}
    ]'::jsonb
  where branch_id=b and code='K-03';

  raise notice 'Micrositios publicados para todos los locales ocupados (35). Visita /portal y toca cualquier tarjeta.';
end $$;
