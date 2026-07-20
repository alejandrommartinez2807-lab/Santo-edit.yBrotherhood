-- ============================================================
-- Concepto La Granja · Seed de micrositios de demostración
-- Publica la "web" de 3 locales reales del seed (idempotente: actualiza por
-- código dentro del primer centro comercial). Así /tienda/<slug> funciona de
-- inmediato para mostrar el sistema. Requiere haber aplicado 0017_microsites.
-- Ejecuta este archivo en el SQL editor de Supabase (o tu proceso habitual).
-- ============================================================

do $$
declare b uuid;
begin
  select id into b from branches order by sort_order, created_at limit 1;
  if b is null then raise notice 'Sin centro comercial: nada que sembrar.'; return; end if;

  -- Capitán Grill Burger (Feria de comida) ------------------------------
  update units set
    microsite_enabled = true,
    microsite_slug    = 'capitan-grill',
    tagline           = 'Las mejores hamburguesas a la parrilla de Naguanagua',
    description        = 'En Capitán Grill Burger hacemos hamburguesas artesanales con carne 100% de res a la parrilla, pan brioche y papas al momento. Ven a la feria de comida del centro comercial y arma tu combo favorito.',
    phone             = '0241-555-1201',
    microsite_whatsapp= '584121112233',
    instagram         = '@capitangrill',
    hours             = E'Lun–Jue 11:00–21:00\nVie–Sáb 11:00–22:00\nDom 12:00–20:00',
    promo             = '🍔 Combo doble + papas + refresco a precio especial toda la semana',
    cover_url         = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&q=70',
    gallery           = '[{"url":"https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=70"},{"url":"https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&q=70"},{"url":"https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=70"}]'::jsonb
  where branch_id = b and code = 'F-01';

  -- Fígaro Barbiere (Belleza) -------------------------------------------
  update units set
    microsite_enabled = true,
    microsite_slug    = 'figaro-barbiere',
    tagline           = 'Barbería clásica: cortes, barba y afeitado a navaja',
    description        = 'Fígaro Barbiere es tu barbería de confianza en el centro comercial. Cortes clásicos y modernos, arreglo de barba, afeitado a navaja caliente y atención sin apuro. Reserva por WhatsApp o pásate directo.',
    phone             = '0241-555-1303',
    microsite_whatsapp= '584121114455',
    instagram         = '@figaro.barbiere',
    hours             = E'Lun–Sáb 09:00–19:00\nDom cerrado',
    promo             = '💈 Corte + barba con precio combo de martes a jueves',
    cover_url         = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&q=70',
    gallery           = '[{"url":"https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=70"},{"url":"https://images.unsplash.com/photo-1521490878406-4d3e3f8e1a3a?w=800&q=70"}]'::jsonb
  where branch_id = b and code = 'PB-03';

  -- TecnoStore (Electrónica) --------------------------------------------
  update units set
    microsite_enabled = true,
    microsite_slug    = 'tecnostore',
    tagline           = 'Celulares, accesorios y servicio técnico',
    description        = 'TecnoStore ofrece teléfonos, accesorios, cargadores, audífonos y servicio técnico con garantía. Cambiamos pantallas y baterías el mismo día. Te asesoramos para que elijas el equipo ideal.',
    phone             = '0241-555-1406',
    microsite_whatsapp= '584121116677',
    instagram         = '@tecnostore.cc',
    hours             = E'Lun–Sáb 10:00–20:00\nDom 11:00–18:00',
    promo             = '📱 Instalación de vidrio templado gratis al comprar tu forro',
    cover_url         = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&q=70',
    gallery           = '[{"url":"https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&q=70"},{"url":"https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=800&q=70"}]'::jsonb
  where branch_id = b and code = 'PB-06';

  raise notice 'Micrositios de demo publicados: /tienda/capitan-grill, /tienda/figaro-barbiere, /tienda/tecnostore';
end $$;
