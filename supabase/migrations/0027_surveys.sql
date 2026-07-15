-- ============================================================
-- 0027: Encuesta post-venta con estrellas + envío automático
--
-- 1) survey_responses: la respuesta del cliente a la encuesta pública
--    (/encuesta/<pedido>): estrellas 1–5 por aspecto (jsonb) + sugerencia
--    libre. UNA respuesta por pedido (índice único): responder dos veces
--    no duplica.
--
-- 2) orders.survey_sent_at / survey_sent_channel: marca de que la encuesta
--    ya se envió a ese pedido (botón manual del staff o envío automático
--    por WhatsApp Business), para no mandarla dos veces.
--
-- Idempotente: se puede correr más de una vez. El código degrada con
-- gracia si esta migración no está aplicada.
-- ============================================================

create table if not exists survey_responses (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null,
  branch_id      uuid,
  -- { "Sabor de la comida": 5, "Tiempo de entrega": 4, ... }
  ratings        jsonb not null default '{}'::jsonb,
  comment        text not null default '',
  customer_name  text not null default '',
  created_at     timestamptz not null default now()
);

create unique index if not exists uq_survey_response_per_order
  on survey_responses (order_id);

create index if not exists idx_survey_responses_created
  on survey_responses (created_at desc);

-- RLS cerrado: solo el servidor (service role) lee/escribe.
alter table survey_responses enable row level security;

alter table orders
  add column if not exists survey_sent_at timestamptz;

alter table orders
  add column if not exists survey_sent_channel text;
