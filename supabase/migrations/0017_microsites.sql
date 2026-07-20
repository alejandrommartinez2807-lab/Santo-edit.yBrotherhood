-- ============================================================
-- Concepto La Granja · Micrositio por local (la "web" de cada negocio)
-- Migración: 0017_microsites
--
-- Cada local (units) puede tener su propia mini-web dentro del portal del
-- centro comercial: portada, descripción, horario, redes, galería y una
-- promoción activa. La administración la crea/edita desde Panel → Locales, y
-- el comerciante puede completarla desde su cuenta (mi-cuenta). El directorio
-- público enlaza a /tienda/<slug>.
-- (idempotente: add column if not exists)
-- ============================================================

alter table units add column if not exists microsite_enabled boolean not null default false; -- si la mini-web está publicada
alter table units add column if not exists microsite_slug     text   not null default '';    -- url amigable: /tienda/<slug>
alter table units add column if not exists tagline            text   not null default '';    -- frase corta bajo el nombre
alter table units add column if not exists description        text   not null default '';    -- reseña / "sobre nosotros"
alter table units add column if not exists phone              text   not null default '';
alter table units add column if not exists microsite_whatsapp text   not null default '';    -- wa del local (distinto al del mall)
alter table units add column if not exists instagram          text   not null default '';    -- @usuario o url
alter table units add column if not exists website_url        text   not null default '';    -- web propia externa (si ya tiene)
alter table units add column if not exists hours              text   not null default '';    -- horario en texto libre
alter table units add column if not exists cover_url          text   not null default '';    -- imagen de portada
alter table units add column if not exists promo              text   not null default '';    -- promoción vigente (banner)
alter table units add column if not exists gallery            jsonb  not null default '[]'::jsonb; -- [{url,caption}]

-- Slug único por centro comercial cuando está definido (los vacíos no chocan).
create unique index if not exists uq_units_microsite_slug
  on units (branch_id, microsite_slug) where microsite_slug <> '';

-- Búsqueda por slug del portal público.
create index if not exists idx_units_microsite_slug on units (microsite_slug) where microsite_slug <> '';
