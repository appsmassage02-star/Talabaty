-- ==============================================================================
-- PHASE B - REVIEW-ONLY SQL PROPOSAL 002
-- Purpose: Unify Household Delivery Orders (`delivery_orders`) and Recurring Draft
--          Approval (`approve_recurring_order_request`) on central `geo_*` tables
--          and central `delivery_area_tariffs` (removing hardcoded 15.00 / legacy
--          `delivery_governorate_settings` overrides in trigger & RPCs).
-- Target Environment: Supabase DEV ONLY (itbfqpjwgjvvybffunkm)
-- IMPORTANT: DO NOT RUN AUTOMATICALLY. Review & verify DEV schemas first!
--            Does NOT delete `delivery_governorate_settings` or any order rows.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: PRE-EXECUTION DIAGNOSTICS (READ-ONLY)
-- Inspect current trigger/RPC definitions and active `delivery_area_tariffs` rows.
-- ------------------------------------------------------------------------------
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fn_enforce_delivery_orders_insert',
    'create_delivery_order',
    'approve_recurring_order_request'
  );

SELECT
  service_type,
  delivery_owner,
  is_enabled,
  COUNT(*) AS tariff_rows
FROM public.delivery_area_tariffs
GROUP BY service_type, delivery_owner, is_enabled
ORDER BY service_type, delivery_owner;


-- ------------------------------------------------------------------------------
-- STEP 2: TRANSACTIONAL MIGRATION (CENTRAL GEO + CENTRAL TARIFFS)
-- Impact Summary:
-- 1) Adds helper `public.fn_resolve_central_household_tariff(uuid, uuid, uuid)`
--    that validates active geo hierarchy (geo_governorates -> geo_centers -> geo_areas,
--    including parent_area_id walk) and picks the most specific enabled row in
--    `delivery_area_tariffs` for household delivery (`service_type IN (...)`).
-- 2) Updates trigger `public.fn_enforce_delivery_orders_insert()` so it NO LONGER
--    overwrites valid central `delivery_area_tariffs` fees (including 0 free delivery)
--    with `delivery_settings.default_delivery_fee` or `15.00`.
-- 3) Updates `public.approve_recurring_order_request(...)` and `public.create_delivery_order(...)`
--    to enforce geo_* hierarchy, valid non-zero GPS, and central `delivery_area_tariffs`,
--    copying `governorate_id`, `center_id`, `area_id`, `area_name`, `latitude`, `longitude`
--    into `delivery_orders`.
-- ------------------------------------------------------------------------------

BEGIN;

-- Ensure snapshot columns exist on delivery_orders (non-destructive IF NOT EXISTS)
ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS governorate_id UUID,
  ADD COLUMN IF NOT EXISTS center_id UUID,
  ADD COLUMN IF NOT EXISTS area_id UUID,
  ADD COLUMN IF NOT EXISTS area_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- 2A. Central Geo Hierarchy & Tariff Resolution Helper for Household Delivery
CREATE OR REPLACE FUNCTION public.fn_resolve_central_household_tariff(
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
      'يجب تحديد المحافظة والمركز والمنطقة من النظام الجغرافي المركزي أولاً';
    RETURN;
  END IF;

  -- Validate Governorate
  SELECT g.id, g.name_ar, COALESCE(g.is_active, true) AS is_active
  INTO v_gov
  FROM public.geo_governorates g
  WHERE g.id = p_governorate_id;

  IF NOT FOUND OR NOT v_gov.is_active THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, false, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      'المحافظة المحددة غير موجودة أو غير مفعّلة في geo_governorates';
    RETURN;
  END IF;

  -- Validate Center belongs to Governorate
  SELECT c.id, c.governorate_id, c.name_ar, COALESCE(c.is_active, true) AS is_active
  INTO v_center
  FROM public.geo_centers c
  WHERE c.id = p_center_id;

  IF NOT FOUND OR NOT v_center.is_active OR v_center.governorate_id <> v_gov.id THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, false, v_gov.name_ar, NULL::TEXT, NULL::TEXT,
      'المركز المحدد غير مفعّل أو لا يتبع المحافظة المختارة في geo_centers';
    RETURN;
  END IF;

  -- Validate Area belongs to Center & Governorate
  SELECT a.id, a.governorate_id, a.center_id, a.parent_area_id, a.name_ar, COALESCE(a.is_active, true) AS is_active
  INTO v_area
  FROM public.geo_areas a
  WHERE a.id = p_area_id;

  IF NOT FOUND
     OR NOT v_area.is_active
     OR v_area.center_id <> v_center.id
     OR (v_area.governorate_id IS NOT NULL AND v_area.governorate_id <> v_gov.id) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, false, v_gov.name_ar, v_center.name_ar, NULL::TEXT,
      'المنطقة المحددة غير مفعّلة أو لا تتبع المركز والمحافظة المختارين في geo_areas';
    RETURN;
  END IF;

  -- Build parent_area_id ancestor chain (child first, up to 6 levels)
  v_ptr := v_area.id;
  WHILE v_ptr IS NOT NULL AND v_guard < 6 LOOP
    v_guard := v_guard + 1;
    EXIT WHEN v_ptr = ANY(v_area_chain);
    v_area_chain := array_append(v_area_chain, v_ptr);

    SELECT parent_area_id INTO v_ptr
    FROM public.geo_areas
    WHERE id = v_ptr;
  END LOOP;

  -- Pick most specific active tariff in delivery_area_tariffs (area_chain -> center -> governorate)
  SELECT t.*
  INTO v_tariff
  FROM public.delivery_area_tariffs t
  WHERE t.is_enabled = true
    AND t.service_type IN ('household', 'household_delivery', 'delivery', 'home_delivery', 'groceries')
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
      'لا توجد تسعيرة توصيل مفعّلة لهذا النطاق الجغرافي في delivery_area_tariffs';
    RETURN;
  END IF;

  IF NOT COALESCE(v_tariff.is_free_delivery, false)
     AND (v_tariff.customer_delivery_fee IS NULL OR v_tariff.customer_delivery_fee < 0) THEN
    RETURN QUERY SELECT false, v_tariff.id, NULL::NUMERIC, false, v_gov.name_ar, v_center.name_ar, v_area.name_ar,
      'تسعيرة التوصيل لهذه المنطقة غير مكتملة في النظام المركزي';
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


-- 2B. Fix BEFORE INSERT Trigger on public.delivery_orders
-- Stops overwriting central tariff / free delivery fees with 15.00!
CREATE OR REPLACE FUNCTION public.fn_enforce_delivery_orders_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_enabled BOOLEAN;
  v_tariff RECORD;
BEGIN
  v_is_admin := public.is_system_admin();

  -- 1. Global delivery kill switch check
  SELECT delivery_enabled
  INTO v_is_enabled
  FROM public.delivery_settings
  LIMIT 1;

  IF (v_is_enabled = false OR v_is_enabled IS NULL) AND NOT v_is_admin THEN
    RAISE EXCEPTION 'خدمة التوصيل معطلة حالياً. لا يمكن إنشاء طلبات جديدة.';
  END IF;

  -- 2. Household membership check
  IF NOT v_is_admin AND NOT public.is_household_member(NEW.household_id) THEN
    RAISE EXCEPTION 'غير مصرح بإنشاء طلب لهذا المنزل.';
  END IF;

  -- 3. Strict GPS coordinate validation (reject NULL and 0,0)
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL
     OR (ABS(NEW.latitude) < 0.0001 AND ABS(NEW.longitude) < 0.0001)
     OR NEW.latitude < -90 OR NEW.latitude > 90
     OR NEW.longitude < -180 OR NEW.longitude > 180 THEN
    RAISE EXCEPTION 'إحداثيات GPS غير صالحة أو مفقودة على طلب التوصيل.';
  END IF;

  -- 4. Validate central geo hierarchy & compute authoritative central delivery fee
  SELECT *
  INTO v_tariff
  FROM public.fn_resolve_central_household_tariff(
    NEW.governorate_id,
    NEW.center_id,
    NEW.area_id
  );

  IF NOT COALESCE(v_tariff.covered, false) OR v_tariff.customer_delivery_fee IS NULL THEN
    RAISE EXCEPTION '%', COALESCE(v_tariff.reason, 'المنطقة غير مغطاة بالتسعيرة المركزية للتوصيل.');
  END IF;

  -- Canonicalize names and enforce server-authoritative central fee (respects 0 EGP free delivery)
  NEW.governorate_name := COALESCE(NULLIF(TRIM(v_tariff.governorate_name), ''), NEW.governorate_name);
  NEW.markaz_name := COALESCE(NULLIF(TRIM(v_tariff.center_name), ''), NEW.markaz_name);
  NEW.area_name := COALESCE(NULLIF(TRIM(v_tariff.area_name), ''), NEW.area_name);
  NEW.delivery_fee := v_tariff.customer_delivery_fee;

  -- 5. Initial status & total calculation
  NEW.status := 'pending_review';
  NEW.subtotal := COALESCE(NEW.subtotal, 0);
  NEW.total_amount := NEW.subtotal + NEW.delivery_fee;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  NEW.created_at := NOW();
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$;


-- 2C. Update approve_recurring_order_request to use central geo + delivery_area_tariffs + GPS
CREATE OR REPLACE FUNCTION public.approve_recurring_order_request(
  p_request_id UUID,
  p_address_id UUID,
  p_delivery_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_addr RECORD;
  v_tariff RECORD;
  v_fee NUMERIC;
  v_subtotal NUMERIC := 0.00;
  v_total NUMERIC := 0.00;
  v_new_order_id UUID;
  v_item RECORD;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_req FROM public.recurring_order_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب المسودة غير موجود');
  END IF;

  IF NOT (public.is_household_admin(v_req.household_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'الموافقة على الطلبات محصورة بمسؤول المنزل');
  END IF;

  IF v_req.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'message', 'تمت الموافقة على هذا الطلب بالفعل');
  END IF;

  SELECT * INTO v_addr
  FROM public.household_addresses
  WHERE id = p_address_id AND household_id = v_req.household_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'عنوان التوصيل المحدد غير موجود');
  END IF;

  IF v_addr.latitude IS NULL OR v_addr.longitude IS NULL
     OR (ABS(v_addr.latitude) < 0.0001 AND ABS(v_addr.longitude) < 0.0001) THEN
    RETURN jsonb_build_object('success', false, 'message', 'العنوان المحدد يفتقد إحداثيات GPS صالحة');
  END IF;

  SELECT *
  INTO v_tariff
  FROM public.fn_resolve_central_household_tariff(
    v_addr.governorate_id,
    v_addr.center_id,
    v_addr.area_id
  );

  IF NOT COALESCE(v_tariff.covered, false) OR v_tariff.customer_delivery_fee IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', COALESCE(v_tariff.reason, 'لا توجد تسعيرة توصيل مركزية مفعّلة لهذا العنوان')
    );
  END IF;

  v_fee := v_tariff.customer_delivery_fee;

  SELECT COALESCE(SUM(total_price), 0.00) INTO v_subtotal
  FROM public.recurring_order_request_items
  WHERE request_id = p_request_id;

  v_total := v_subtotal + v_fee;

  INSERT INTO public.delivery_orders (
    household_id,
    user_id,
    address_id,
    customer_name,
    customer_phone,
    country,
    governorate_id,
    governorate_name,
    center_id,
    markaz_name,
    area_id,
    area_name,
    latitude,
    longitude,
    detailed_address,
    delivery_fee,
    subtotal,
    total_amount,
    delivery_notes,
    status,
    source_recurring_request_id,
    created_at,
    updated_at
  ) VALUES (
    v_req.household_id,
    v_caller_id,
    v_addr.id,
    v_addr.full_name,
    v_addr.phone,
    v_addr.country,
    v_addr.governorate_id,
    COALESCE(v_tariff.governorate_name, v_addr.governorate_name),
    v_addr.center_id,
    COALESCE(v_tariff.center_name, v_addr.markaz_name),
    v_addr.area_id,
    COALESCE(v_tariff.area_name, v_addr.area_name),
    v_addr.latitude,
    v_addr.longitude,
    v_addr.detailed_address,
    v_fee,
    v_subtotal,
    v_total,
    COALESCE(p_delivery_notes, v_req.notes),
    'pending_review',
    p_request_id,
    NOW(),
    NOW()
  ) RETURNING id INTO v_new_order_id;

  FOR v_item IN SELECT * FROM public.recurring_order_request_items WHERE request_id = p_request_id LOOP
    INSERT INTO public.delivery_order_items (
      order_id,
      delivery_order_id,
      product_id,
      product_name,
      category_id,
      category_name,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_new_order_id,
      v_new_order_id,
      v_item.product_id,
      v_item.product_name,
      v_item.category_id,
      v_item.category_name,
      v_item.quantity,
      v_item.unit_price,
      v_item.total_price
    );
  END LOOP;

  UPDATE public.recurring_order_requests
  SET status = 'approved',
      reviewed_by = v_caller_id,
      delivery_order_id = v_new_order_id,
      updated_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO public.notifications (
    id,
    household_id,
    title,
    message,
    type,
    target_role,
    read,
    created_at
  ) VALUES (
    'notif-' || gen_random_uuid(),
    v_req.household_id,
    'تم اعتماد طلب التوصيل',
    'وافق المسؤول على طلب القائمة المتكررة وتم إرساله لنظام الدليفري بنجاح.',
    'item_added',
    'all',
    false,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_new_order_id,
    'delivery_fee', v_fee,
    'total_amount', v_total
  );
END;
$$;


-- 2D. Update create_delivery_order to also enforce central geo_* + delivery_area_tariffs
CREATE OR REPLACE FUNCTION public.create_delivery_order(
  p_household_id TEXT,
  p_address_id UUID,
  p_items JSONB,
  p_invoice_id TEXT DEFAULT NULL,
  p_delivery_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_address RECORD;
  v_tariff RECORD;
  v_order_id UUID;
  v_fee NUMERIC;
  v_subtotal NUMERIC := 0.00;
  v_total NUMERIC := 0.00;
  v_item JSONB;
  v_item_price NUMERIC;
  v_item_qty_str TEXT;
  v_item_total NUMERIC;
BEGIN
  v_caller_id := auth.uid();

  IF NOT public.is_delivery_enabled() THEN
    RETURN jsonb_build_object('success', false, 'message', 'خدمة التوصيل للمنزل غير متاحة حالياً');
  END IF;

  IF NOT (public.is_household_member(p_household_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'ليس لديك صلاحية لإنشاء طلب توصيل لهذا المنزل');
  END IF;

  SELECT * INTO v_address
  FROM public.household_addresses
  WHERE id = p_address_id AND household_id = p_household_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'عنوان التوصيل المحدد غير موجود');
  END IF;

  IF v_address.latitude IS NULL OR v_address.longitude IS NULL
     OR (ABS(v_address.latitude) < 0.0001 AND ABS(v_address.longitude) < 0.0001) THEN
    RETURN jsonb_build_object('success', false, 'message', 'العنوان المحدد يفتقد إحداثيات GPS صالحة');
  END IF;

  SELECT *
  INTO v_tariff
  FROM public.fn_resolve_central_household_tariff(
    v_address.governorate_id,
    v_address.center_id,
    v_address.area_id
  );

  IF NOT COALESCE(v_tariff.covered, false) OR v_tariff.customer_delivery_fee IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', COALESCE(v_tariff.reason, 'خدمة التوصيل غير متاحة أو غير مسعرة في هذه المنطقة حالياً')
    );
  END IF;

  v_fee := v_tariff.customer_delivery_fee;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_price := COALESCE((v_item->>'total_price')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);
    v_subtotal := v_subtotal + v_item_price;
  END LOOP;

  v_total := v_subtotal + v_fee;

  INSERT INTO public.delivery_orders (
    household_id,
    user_id,
    invoice_id,
    address_id,
    customer_name,
    customer_phone,
    country,
    governorate_id,
    governorate_name,
    center_id,
    markaz_name,
    area_id,
    area_name,
    latitude,
    longitude,
    detailed_address,
    delivery_fee,
    subtotal,
    total_amount,
    delivery_notes,
    status
  ) VALUES (
    p_household_id,
    v_caller_id,
    p_invoice_id,
    v_address.id,
    v_address.full_name,
    v_address.phone,
    v_address.country,
    v_address.governorate_id,
    COALESCE(v_tariff.governorate_name, v_address.governorate_name),
    v_address.center_id,
    COALESCE(v_tariff.center_name, v_address.markaz_name),
    v_address.area_id,
    COALESCE(v_tariff.area_name, v_address.area_name),
    v_address.latitude,
    v_address.longitude,
    v_address.detailed_address,
    v_fee,
    v_subtotal,
    v_total,
    p_delivery_notes,
    'pending_review'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_qty_str := COALESCE(v_item->>'quantity', '١');
    v_item_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);
    v_item_total := COALESCE((v_item->>'total_price')::NUMERIC, v_item_price);

    INSERT INTO public.delivery_order_items (
      order_id,
      delivery_order_id,
      product_id,
      product_name,
      category_id,
      category_name,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      v_order_id,
      v_item->>'product_id',
      v_item->>'product_name',
      v_item->>'category_id',
      v_item->>'category_name',
      v_item_qty_str,
      v_item_price,
      v_item_total
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'delivery_fee', v_fee,
    'total_amount', v_total,
    'message', 'تم إنشاء طلب التوصيل بنجاح'
  );
END;
$$;

COMMIT;


-- ------------------------------------------------------------------------------
-- STEP 3: POST-EXECUTION VERIFICATION
-- ------------------------------------------------------------------------------
-- Example smoke check (replace UUIDs with real active IDs on DEV):
-- SELECT * FROM public.fn_resolve_central_household_tariff('<gov_uuid>', '<center_uuid>', '<area_uuid>');
SELECT pg_get_functiondef('public.fn_enforce_delivery_orders_insert()'::regproc) AS trigger_def_check;


-- ------------------------------------------------------------------------------
-- STEP 4: ROLLBACK GUIDANCE
-- Before applying Step 2 on DEV, export:
--   SELECT pg_get_functiondef('public.fn_enforce_delivery_orders_insert()'::regproc);
--   SELECT pg_get_functiondef('public.approve_recurring_order_request(uuid, uuid, text)'::regproc);
--   SELECT pg_get_functiondef('public.create_delivery_order(text, uuid, jsonb, text, text)'::regproc);
-- Re-running those captured CREATE OR REPLACE FUNCTION statements restores
-- prior DB behavior safely without touching any order records.
-- ------------------------------------------------------------------------------
