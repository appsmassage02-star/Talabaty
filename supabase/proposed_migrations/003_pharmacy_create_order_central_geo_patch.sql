-- ==============================================================================
-- PHASE B - REVIEW-ONLY SQL PROPOSAL 003
-- Purpose: Inspection queries + compatibility patch template for DEV-hosted RPCs
--          `public.pharmacy_create_order` and `public.create_bite_bait_order`.
-- NOTE ON SCOPE:
--   Neither `pharmacy_create_order` nor `create_bite_bait_order` is defined inside
--   this client repository's `supabase/migrations/` folder; they live directly in
--   Supabase DEV (`itbfqpjwgjvvybffunkm`). Because DEV returned HTTP 401 without an
--   authenticated session/key from this environment, exact live bodies MUST be
--   inspected via Step 1 before applying Step 2.
-- Target Environment: Supabase DEV ONLY (itbfqpjwgjvvybffunkm)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: MANDATORY LIVE DEV RPC INSPECTION (READ-ONLY)
-- Run on Supabase DEV SQL Editor first and save full output as rollback backup!
-- ------------------------------------------------------------------------------
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'pharmacy_create_order',
    'create_bite_bait_order'
  )
ORDER BY p.proname;

-- Also verify columns present on `pharmacy_orders` and `restaurant_orders`
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('pharmacy_orders', 'restaurant_orders')
  AND (
    column_name LIKE '%governorate%'
    OR column_name LIKE '%center%'
    OR column_name LIKE '%area%'
    OR column_name IN ('delivery_fee', 'delivery_latitude', 'delivery_longitude', 'fulfillment_route')
  )
ORDER BY table_name, ordinal_position;


-- ------------------------------------------------------------------------------
-- STEP 2: CENTRAL PHARMACY TARIFF VALIDATOR + PATCH CHECKLIST FOR DEV DBA
-- What `pharmacy_create_order` on DEV must guarantee (preserving exact parameter list):
--   1. Make `p_address_governorate_code TEXT DEFAULT NULL` optional (nullable)
--      so callers do NOT need to supply a fake/empty governorate code when `geo_*`
--      tables store UUIDs rather than legacy text codes.
--   2. Fetch `household_addresses` row by `p_source_address_id` & verify ownership.
--   3. Validate `governorate_id`, `center_id`, `area_id` against `geo_governorates`,
--      `geo_centers`, `geo_areas` (active + strict parent-child link), and validate
--      non-zero GPS coordinates (`latitude`, `longitude`).
--   4. Remove any legacy lookup against `food_*`, `delivery_governorate_settings`,
--      or hardcoded Sohag restriction (`'سوهاج'`), and replace with central lookup in
--      `delivery_area_tariffs` where `service_type IN ('pharmacy', 'pharmacy_delivery')`
--      and `is_enabled = true`.
--   5. Raise a clear Arabic exception if area/center/governorate is uncovered or disabled.
--
-- What `create_bite_bait_order` on DEV must guarantee:
--   1. Look up delivery address `governorate_id`, `center_id`, `area_id` from
--      `household_addresses` (when `p_address_id IS NOT NULL`) or validate geographic scope.
--   2. Reference `geo_governorates`, `geo_centers`, `geo_areas` and `restaurant_service_areas`
--      + `delivery_area_tariffs` (NOT `food_governorates`, `food_centers`, `food_areas`, or
--      `restaurant_area_delivery_fees`).
--   3. Compute `delivery_fee` and `fulfillment_route` authoritatively on the server based on
--      restaurant own-delivery flag (`Case 1` vs `Case 2`) and `delivery_area_tariffs`.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_resolve_central_pharmacy_tariff(
  p_governorate_id UUID,
  p_center_id UUID,
  p_area_id UUID
)
RETURNS TABLE (
  covered BOOLEAN,
  tariff_id UUID,
  customer_delivery_fee NUMERIC,
  is_free_delivery BOOLEAN,
  governorate_name TEXT,
  center_name TEXT,
  area_name TEXT,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gov RECORD;
  v_center RECORD;
  v_area RECORD;
  v_area_chain UUID[] := ARRAY[]::UUID[];
  v_ptr UUID;
  v_guard INT := 0;
  v_tariff RECORD;
BEGIN
  IF p_governorate_id IS NULL OR p_center_id IS NULL OR p_area_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, false, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      'العنوان المحدد غير مربوط بالنظام الجغرافي المركزي (المحافظة / المركز / المنطقة)';
    RETURN;
  END IF;

  SELECT g.id, g.name_ar, COALESCE(g.is_active, true) AS is_active
  INTO v_gov
  FROM public.geo_governorates g
  WHERE g.id = p_governorate_id;

  IF NOT FOUND OR NOT v_gov.is_active THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, false, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      'المحافظة غير مفعّلة في geo_governorates';
    RETURN;
  END IF;

  SELECT c.id, c.governorate_id, c.name_ar, COALESCE(c.is_active, true) AS is_active
  INTO v_center
  FROM public.geo_centers c
  WHERE c.id = p_center_id;

  IF NOT FOUND OR NOT v_center.is_active OR v_center.governorate_id <> v_gov.id THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, false, v_gov.name_ar, NULL::TEXT, NULL::TEXT,
      'المركز غير مفعّل أو لا يتبع المحافظة المختارة في geo_centers';
    RETURN;
  END IF;

  SELECT a.id, a.governorate_id, a.center_id, a.parent_area_id, a.name_ar, COALESCE(a.is_active, true) AS is_active
  INTO v_area
  FROM public.geo_areas a
  WHERE a.id = p_area_id;

  IF NOT FOUND
     OR NOT v_area.is_active
     OR v_area.center_id <> v_center.id
     OR (v_area.governorate_id IS NOT NULL AND v_area.governorate_id <> v_gov.id) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, false, v_gov.name_ar, v_center.name_ar, NULL::TEXT,
      'المنطقة غير مفعّلة أو لا تتبع المركز والمحافظة المختارين في geo_areas';
    RETURN;
  END IF;

  v_ptr := v_area.id;
  WHILE v_ptr IS NOT NULL AND v_guard < 6 LOOP
    v_guard := v_guard + 1;
    EXIT WHEN v_ptr = ANY(v_area_chain);
    v_area_chain := array_append(v_area_chain, v_ptr);
    SELECT parent_area_id INTO v_ptr FROM public.geo_areas WHERE id = v_ptr;
  END LOOP;

  SELECT t.*
  INTO v_tariff
  FROM public.delivery_area_tariffs t
  WHERE t.is_enabled = true
    AND t.service_type IN ('pharmacy', 'pharmacy_delivery')
    AND (t.delivery_owner IS NULL OR t.delivery_owner = 'talabaty')
    AND t.restaurant_id IS NULL
    AND (t.governorate_id IS NULL OR t.governorate_id = v_gov.id)
    AND (t.center_id IS NULL OR t.center_id = v_center.id)
    AND (
      t.area_id = ANY(v_area_chain)
      OR (t.area_id IS NULL AND t.center_id = v_center.id)
      OR (t.area_id IS NULL AND t.center_id IS NULL AND t.governorate_id = v_gov.id)
    )
  ORDER BY
    CASE
      WHEN t.area_id IS NOT NULL THEN array_position(v_area_chain, t.area_id)
      WHEN t.center_id IS NOT NULL THEN 100
      ELSE 200
    END ASC,
    t.updated_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, false, v_gov.name_ar, v_center.name_ar, v_area.name_ar,
      'خدمة الصيدلية غير مغطاة أو غير مسعّرة لهذه المنطقة في delivery_area_tariffs';
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    v_tariff.id,
    CASE WHEN COALESCE(v_tariff.is_free_delivery, false) THEN 0::NUMERIC ELSE v_tariff.customer_delivery_fee END,
    COALESCE(v_tariff.is_free_delivery, false),
    v_gov.name_ar,
    v_center.name_ar,
    v_area.name_ar,
    NULL::TEXT;
END;
$$;

-- ------------------------------------------------------------------------------
-- STEP 3: VERIFICATION & ROLLBACK
-- Verify helper creation:
--   SELECT pg_get_functiondef('public.fn_resolve_central_pharmacy_tariff(uuid, uuid, uuid)'::regproc);
-- Rollback:
--   DROP FUNCTION IF EXISTS public.fn_resolve_central_pharmacy_tariff(uuid, uuid, uuid);
--   plus restore exact `pg_get_functiondef` output saved in Step 1 before patching
--   `pharmacy_create_order` / `create_bite_bait_order`.
-- ------------------------------------------------------------------------------
