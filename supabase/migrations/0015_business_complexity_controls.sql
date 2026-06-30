-- 0015 — Controles de complejidad y permisos configurables por el dueño.
-- No crea tablas nuevas: completa business_config.config con defaults seguros.

insert into public.business_config (id, config)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

update public.business_config
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'businessComplexityLevel', coalesce(nullif(trim(config->>'businessComplexityLevel'), ''), 'standard'),
  'publicOrderingEnabled', coalesce(case lower(config->>'publicOrderingEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicDineInEnabled', coalesce(case lower(config->>'publicDineInEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicTakeawayEnabled', coalesce(case lower(config->>'publicTakeawayEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicDeliveryOrdersEnabled', coalesce(case lower(config->>'publicDeliveryOrdersEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicOpenAccountEnabled', coalesce(case lower(config->>'publicOpenAccountEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicPaymentProofUploadEnabled', coalesce(case lower(config->>'publicPaymentProofUploadEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicIngredientCustomizationEnabled', coalesce(case lower(config->>'publicIngredientCustomizationEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicProductNotesEnabled', coalesce(case lower(config->>'publicProductNotesEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicCustomerNotesEnabled', coalesce(case lower(config->>'publicCustomerNotesEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicOrderAttachmentEnabled', coalesce(case lower(config->>'publicOrderAttachmentEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicCustomerPhoneRequired', coalesce(case lower(config->>'publicCustomerPhoneRequired') when 'true' then true when 'false' then false else null end, false),
  'staffCanCancelOrdersEnabled', coalesce(case lower(config->>'staffCanCancelOrdersEnabled') when 'true' then true when 'false' then false else null end, true),
  'staffCanEditOrderNotesEnabled', coalesce(case lower(config->>'staffCanEditOrderNotesEnabled') when 'true' then true when 'false' then false else null end, true),
  'staffCanReopenPaymentsEnabled', coalesce(case lower(config->>'staffCanReopenPaymentsEnabled') when 'true' then true when 'false' then false else null end, false),
  'ownerCloseRequiresReviewEnabled', coalesce(case lower(config->>'ownerCloseRequiresReviewEnabled') when 'true' then true when 'false' then false else null end, false),
  'inventoryAutoDeductEnabled', coalesce(case lower(config->>'inventoryAutoDeductEnabled') when 'true' then true when 'false' then false else null end, false),
  'reportsAdvancedVisibleEnabled', coalesce(case lower(config->>'reportsAdvancedVisibleEnabled') when 'true' then true when 'false' then false else null end, true),
  'updatedAt', coalesce(nullif(trim(config->>'updatedAt'), ''), now()::text)
)
where id = 1;
