-- ==============================================================================
-- PHASE B - REVIEW-ONLY SQL PROPOSAL 003
-- Purpose: Inspection queries + compatibility patch template for DEV-hosted RPCs
--          `public.pharmacy_create_order` and `public.create_bite_bait_order`.
-- NOTE ON SCOPE:
--   Neither `pharmacy_create_order` nor `create_bite_bait_order` is defined inside
--   this client repository's `supabase/migrations/` folder; they live directly in
--   Supabase DEV (`itbfqpjwgjvvybffunkm`). Exact live bodies MUST be inspected
--   via Step 1 before applying Step 2.
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
    OR column_name LIKE '%tariff%'
    OR column_name LIKE '%base_fee%'
    OR column_name LIKE '%commission%'
    OR column_name LIKE '%driver_net%'
    OR column_name IN ('delivery_fee', 'customer_delivery_fee', 'delivery_latitude', 'delivery_longitude', 'fulfillment_route')
  )
ORDER BY table_name, ordinal_position;


-- ------------------------------------------------------------------------------
-- STEP 2: CENTRAL PHARMACY & READY-FOOD TARIFF PATCH CHECKLIST FOR DEV DBA
-- What `pharmacy_create_order` on DEV must guarantee (preserving exact parameter list):
--   1. Make `p_address_governorate_code TEXT DEFAULT NULL` optional (nullable)
--      so callers do NOT need to supply a fake/empty governorate code when `geo_*`
--      tables store UUIDs rather than legacy text codes.
--   2. Fetch `household_addresses` row by `p_source_address_id` & verify ownership.
--   3. Validate the 3 direct geo levels `governorate_id -> center_id -> area_id`
--      against `geo_governorates`, `geo_centers`, `geo_areas` (active + strict
--      parent-child link, NO `parent_area_id`), validate non-zero GPS coordinates
--      (`latitude`, `longitude`), and validate GPS against `geo_areas.boundary`
--      -> `geo_centers.boundary` -> `geo_governorates.boundary` (allow if no boundary exists).
--   4. Remove any legacy lookup against `food_*`, `delivery_governorate_settings`,
--      or hardcoded Sohag restriction (`'سوهاج'`), and replace with central lookup in
--      `delivery_area_tariffs` strictly matching:
--        `service_type = 'pharmacy'` AND `delivery_owner = 'platform'` AND `is_enabled = true`
--      in specificity order: Area -> Center -> Governorate.
--   5. Raise a clear Arabic exception if area/center/governorate is uncovered or disabled.
--
-- What `create_bite_bait_order` on DEV must guarantee:
--   1. Validate delivery location via `household_addresses` (when `p_address_id IS NOT NULL`)
--      or optional explicit geo IDs against the 3 direct levels `geo_governorates`,
--      `geo_centers`, `geo_areas` (active + strict direct link, NO `parent_area_id`, NO `food_*`).
--   2. Validate non-zero GPS coordinates (`p_delivery_latitude`, `p_delivery_longitude`)
--      and GPS containment against `geo_areas.boundary` -> `geo_centers.boundary` ->
--      `geo_governorates.boundary` (allow if none of those levels defines a boundary).
--   3. Query `delivery_area_tariffs` ONLY (FORBIDDEN: `restaurant_service_areas`,
--      `restaurant_section_service_areas`, `restaurant_area_delivery_fees`):
--        Step A: `is_enabled = true`, `service_type = 'ready_food'`,
--                `delivery_owner = 'restaurant'`, `restaurant_id = p_restaurant_id`
--                (precedence: Area -> Center -> Governorate).
--        Step B: If Step A finds no enabled tariff, check platform coverage:
--                `is_enabled = true`, `service_type = 'ready_food'`,
--                `delivery_owner = 'platform'`, `restaurant_id IS NULL`
--                (precedence: Area -> Center -> Governorate).
--        Step C: If neither Step A nor Step B matches, reject the order with exact message:
--                `'أنت خارج نطاق التوصيل'`.
--   4. Persist immutable tariff & geo snapshot on `restaurant_orders`
--      (`delivery_tariff_id`, `delivery_base_fee`, `delivery_admin_commission`,
--      `delivery_driver_net`, `customer_delivery_fee`, `delivery_fee`,
--      `delivery_governorate_id`, `delivery_center_id`, `delivery_area_id`,
--      `delivery_area_name`, `delivery_latitude`, `delivery_longitude`,
--      `fulfillment_route`).
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_resolve_central_pharmacy_tariff(
  p_governorate_id UUID,
  p_center_id UUID,
  p_area_id UUID
)
RETURNS TABLE (
  covered BOOLEAN,
  tariff_id UUID,
  matched_level TEXT,
  base_fee NUMERIC,
  admin_commission NUMERIC,
  driver_net NUMERIC,
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
  v_tariff RECORD;
  v_customer_fee NUMERIC;
  v_base_fee NUMERIC;
  v_admin_comm NUMERIC;
  v_driver_net NUMERIC;
  v_level TEXT;
BEGIN
  IF p_governorate_id IS NULL OR p_center_id IS NULL OR p_area_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, false,
      NULL::TEXT, NULL::TEXT, NULL::TEXT,
      'العنوان المحدد غير مربوط بالنظام الجغرافي المركزي (المحافظة / المركز / المنطقة)';
    RETURN;
  END IF;

  SELECT g.id, g.name_ar, COALESCE(g.is_active, true) AS is_active
  INTO v_gov
  FROM public.geo_governorates g
  WHERE g.id = p_governorate_id;

  IF NOT FOUND OR NOT v_gov.is_active THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, false,
      NULL::TEXT, NULL::TEXT, NULL::TEXT,
      'المحافظة غير مفعّلة في geo_governorates';
    RETURN;
  END IF;

  SELECT c.id, c.governorate_id, c.name_ar, COALESCE(c.is_active, true) AS is_active
  INTO v_center
  FROM public.geo_centers c
  WHERE c.id = p_center_id;

  IF NOT FOUND OR NOT v_center.is_active OR v_center.governorate_id <> v_gov.id THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, false,
      v_gov.name_ar, NULL::TEXT, NULL::TEXT,
      'المركز غير مفعّل أو لا يتبع المحافظة المختارة في geo_centers';
    RETURN;
  END IF;

  SELECT a.id, a.governorate_id, a.center_id, a.name_ar, COALESCE(a.is_active, true) AS is_active
  INTO v_area
  FROM public.geo_areas a
  WHERE a.id = p_area_id;

  IF NOT FOUND
     OR NOT v_area.is_active
     OR v_area.center_id <> v_center.id
     OR (v_area.governorate_id IS NOT NULL AND v_area.governorate_id <> v_gov.id) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, false,
      v_gov.name_ar, v_center.name_ar, NULL::TEXT,
      'المنطقة غير مفعّلة أو لا تتبع المركز والمحافظة المختارين في geo_areas';
    RETURN;
  END IF;

  -- Strictly 3-level precedence: Area -> Center -> Governorate
  -- Exact service_type='pharmacy' and delivery_owner='platform'
  SELECT t.*
  INTO v_tariff
  FROM public.delivery_area_tariffs t
  WHERE t.is_enabled = true
    AND t.service_type = 'pharmacy'
    AND t.delivery_owner = 'platform'
    AND t.restaurant_id IS NULL
    AND (t.governorate_id IS NULL OR t.governorate_id = v_gov.id)
    AND (t.center_id IS NULL OR t.center_id = v_center.id)
    AND (
      t.area_id = v_area.id
      OR (t.area_id IS NULL AND t.center_id = v_center.id)
      OR (t.area_id IS NULL AND t.center_id IS NULL AND t.governorate_id = v_gov.id)
    )
  ORDER BY
    CASE
      WHEN t.area_id = v_area.id THEN 1
      WHEN t.area_id IS NULL AND t.center_id = v_center.id THEN 2
      ELSE 3
    END ASC,
    t.updated_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, false,
      v_gov.name_ar, v_center.name_ar, v_area.name_ar,
      'خدمة الصيدلية غير مغطاة أو غير مسعّرة لهذه المنطقة في delivery_area_tariffs';
    RETURN;
  END IF;

  IF NOT COALESCE(v_tariff.is_free_delivery, false)
     AND (v_tariff.customer_delivery_fee IS NULL OR v_tariff.customer_delivery_fee < 0) THEN
    RETURN QUERY SELECT false, v_tariff.id, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, false,
      v_gov.name_ar, v_center.name_ar, v_area.name_ar,
      'تسعيرة خدمة الصيدلية غير مكتملة في النظام المركزي';
    RETURN;
  END IF;

  v_level := CASE
    WHEN v_tariff.area_id IS NOT NULL THEN 'area'
    WHEN v_tariff.center_id IS NOT NULL THEN 'center'
    ELSE 'governorate'
  END;

  v_customer_fee := CASE
    WHEN COALESCE(v_tariff.is_free_delivery, false) THEN 0::NUMERIC
    ELSE v_tariff.customer_delivery_fee
  END;
  v_base_fee := CASE
    WHEN COALESCE(v_tariff.is_free_delivery, false) THEN 0::NUMERIC
    ELSE COALESCE(v_tariff.base_fee, v_customer_fee)
  END;
  v_admin_comm := CASE
    WHEN COALESCE(v_tariff.is_free_delivery, false) THEN 0::NUMERIC
    ELSE COALESCE(v_tariff.admin_commission, 0::NUMERIC)
  END;
  v_driver_net := CASE
    WHEN COALESCE(v_tariff.is_free_delivery, false) THEN 0::NUMERIC
    ELSE COALESCE(v_tariff.driver_net, GREATEST(0::NUMERIC, v_customer_fee - v_admin_comm))
  END;

  RETURN QUERY SELECT
    true,
    v_tariff.id,
    v_level,
    v_base_fee,
    v_admin_comm,
    v_driver_net,
    v_customer_fee,
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
