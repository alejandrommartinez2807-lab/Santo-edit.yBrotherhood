-- Fase 2g — Permisos internos del dueño y preparación segura de inventario automático.
-- Idempotente: agrega valores por defecto en business_config.config sin pisar decisiones existentes.

DO $$
DECLARE
  cfg jsonb;
BEGIN
  INSERT INTO public.business_config (id, config)
  VALUES (1, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  SELECT COALESCE(config, '{}'::jsonb)
    INTO cfg
  FROM public.business_config
  WHERE id = 1
  FOR UPDATE;

  IF NOT (cfg ? 'businessComplexityProfile') THEN
    cfg := jsonb_set(cfg, '{businessComplexityProfile}', to_jsonb('advanced'::text), true);
  END IF;

  IF NOT (cfg ? 'publicAllowOrdering') THEN cfg := jsonb_set(cfg, '{publicAllowOrdering}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowEatHere') THEN cfg := jsonb_set(cfg, '{publicAllowEatHere}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowTakeaway') THEN cfg := jsonb_set(cfg, '{publicAllowTakeaway}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowDelivery') THEN cfg := jsonb_set(cfg, '{publicAllowDelivery}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowOpenAccounts') THEN cfg := jsonb_set(cfg, '{publicAllowOpenAccounts}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowPaymentProofs') THEN cfg := jsonb_set(cfg, '{publicAllowPaymentProofs}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowProductCustomization') THEN cfg := jsonb_set(cfg, '{publicAllowProductCustomization}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowCustomerNotes') THEN cfg := jsonb_set(cfg, '{publicAllowCustomerNotes}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowAttachments') THEN cfg := jsonb_set(cfg, '{publicAllowAttachments}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicRequireCustomerPhone') THEN cfg := jsonb_set(cfg, '{publicRequireCustomerPhone}', 'false'::jsonb, true); END IF;

  IF NOT (cfg ? 'internalAllowCancelOrders') THEN cfg := jsonb_set(cfg, '{internalAllowCancelOrders}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'internalAllowEditOrderNotes') THEN cfg := jsonb_set(cfg, '{internalAllowEditOrderNotes}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'internalAllowReopenPayments') THEN cfg := jsonb_set(cfg, '{internalAllowReopenPayments}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'internalRequireCloseReview') THEN cfg := jsonb_set(cfg, '{internalRequireCloseReview}', 'false'::jsonb, true); END IF;
  IF NOT (cfg ? 'internalShowAdvancedReports') THEN cfg := jsonb_set(cfg, '{internalShowAdvancedReports}', 'true'::jsonb, true); END IF;

  -- Preparado pero apagado: no descuenta inventario automáticamente en esta fase.
  IF NOT (cfg ? 'inventoryAutoDeductEnabled') THEN cfg := jsonb_set(cfg, '{inventoryAutoDeductEnabled}', 'false'::jsonb, true); END IF;
  IF NOT (cfg ? 'inventoryAutoDeductDryRun') THEN cfg := jsonb_set(cfg, '{inventoryAutoDeductDryRun}', 'true'::jsonb, true); END IF;

  UPDATE public.business_config
  SET config = cfg
  WHERE id = 1;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_config'
      AND column_name = 'updated_at'
  ) THEN
    UPDATE public.business_config
    SET updated_at = NOW()
    WHERE id = 1;
  END IF;
END $$;
