-- ============================================================
-- Hotel · Promociones por WhatsApp: BITÁCORA DE ENVÍOS
-- Registra a quién se le mandó qué promoción y en qué periodo, para NO
-- repetir (idempotencia). A diferencia de notification_log (atada a una
-- reserva), esta es por HUÉSPED/TELÉFONO: sirve para campañas del CRM y
-- para las promos automáticas (cumpleaños, post-estadía, inactivos).
--
-- Migración ADITIVA por branch_id. No toca ninguna tabla existente.
--
-- promo_kind : cumpleanos | post_estadia | inactivo | temporada | manual
-- period_key : la "ventana" de dedupe. Ej: cumpleaños→'2026-07' (mes),
--              post-estadía→la fecha de check-out, campaña manual→
--              'm:2026-07-18:<hash>'. El UNIQUE de abajo garantiza que la
--              misma persona no reciba la misma promo dos veces en el mismo
--              periodo.
-- ============================================================

create table if not exists promo_send_log (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid references branches(id) on delete cascade,
  phone_key   text not null,                 -- solo dígitos, normalizado
  promo_kind  text not null,
  period_key  text not null,
  guest_name  text,
  channel     text not null default 'whatsapp',
  sent_at     timestamptz not null default now(),
  unique (branch_id, phone_key, promo_kind, period_key)
);

create index if not exists idx_promo_send_log_branch on promo_send_log (branch_id, sent_at desc);

alter table promo_send_log enable row level security;
