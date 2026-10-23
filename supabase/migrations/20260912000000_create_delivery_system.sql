-- ==============================================================================
-- TALABAT AL-BAYT (طلبات البيت) — UNIFIED DELIVERY SYSTEM MIGRATION
-- ==============================================================================
-- Migration: 20260912000000_create_delivery_system.sql
-- Description:
-- Establishes the authoritative, unified delivery database schema and Row-Level
-- Security (RLS) policies shared across:
--   1. User Application & Home Phone (تطبيق المستخدم وهاتف المنزل)
--   2. Separate Admin Dashboard (لوحة الإدارة المنفصلة)
--   3. Delivery Driver Application (تطبيق الدليفري)
--
-- Target Entities:
--   1. delivery_settings
--   2. household_addresses
--   3. delivery_drivers
--   4. delivery_orders
--   5. delivery_order_items
--   6. delivery_order_status_history
--
-- Standard Order Statuses:
--   - pending_review        (قيد المراجعة)
--   - accepted              (تم قبول الطلب)
--   - cancellation_pending  (بانتظار موافقة الإدارة على الإلغاء)
--   - cancelled             (تم الإلغاء)
--   - completed             (مكتمل)
--
-- Idempotent & Non-destructive: Safe for repeated executions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Security Definer Functions
-- ------------------------------------------------------------------------------

-- Check if current user has administrative authority
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'manager')
  ) OR EXISTS (
    SELECT 1 FROM public.households
    WHERE admin_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.household_members
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Check if current user is an active delivery driver
CREATE OR REPLACE FUNCTION public.is_active_driver()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_drivers
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- Get current driver's delivery_drivers record ID
CREATE OR REPLACE FUNCTION public.get_current_driver_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.delivery_drivers
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- Check if delivery service is currently globally enabled
CREATE OR REPLACE FUNCTION public.is_delivery_enabled()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT delivery_enabled FROM public.delivery_settings LIMIT 1),
    true
  );
$$;


-- ------------------------------------------------------------------------------
-- 2. Create Tables
-- ------------------------------------------------------------------------------

-- 1. delivery_settings (Central Settings / الإعدادات المركزية)
CREATE TABLE IF NOT EXISTS public.delivery_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  default_delivery_fee NUMERIC NOT NULL DEFAULT 15.00,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default configuration if empty (delivery_enabled = true for testing as requested)
INSERT INTO public.delivery_settings (id, delivery_enabled, default_delivery_fee, updated_at)
VALUES ('default', true, 15.00, NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. household_addresses (عناوين المنازل)
CREATE TABLE IF NOT EXISTS public.household_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  address_label TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'مصر',
  governorate_code TEXT,
  governorate_name TEXT NOT NULL,
  markaz_code TEXT,
  markaz_name TEXT NOT NULL,
  detailed_address TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. delivery_drivers (بيانات الدليفري)
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. delivery_orders (الجدول الرئيسي للطلبات)
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  address_id UUID REFERENCES public.household_addresses(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'مصر',
  governorate_name TEXT NOT NULL,
  markaz_name TEXT NOT NULL,
  detailed_address TEXT NOT NULL,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (
    status IN ('pending_review', 'accepted', 'cancellation_pending', 'cancelled', 'completed')
  ),
  assigned_driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  cancellation_requested_at TIMESTAMPTZ,
  cancellation_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_decided_at TIMESTAMPTZ,
  cancellation_decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_decision_note TEXT,
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. delivery_order_items (نسخة ثابتة من عناصر الطلب)
-- Note: product_id is TEXT to match both missing_items.id and JSONB invoice product ids
CREATE TABLE IF NOT EXISTS public.delivery_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  category_id TEXT,
  category_name TEXT,
  quantity TEXT DEFAULT '١',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. delivery_order_status_history (سجل تغيّر الحالات)
CREATE TABLE IF NOT EXISTS public.delivery_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  old_status TEXT CHECK (
    old_status IS NULL OR old_status IN ('pending_review', 'accepted', 'cancellation_pending', 'cancelled', 'completed')
  ),
  new_status TEXT NOT NULL CHECK (
    new_status IN ('pending_review', 'accepted', 'cancellation_pending', 'cancelled', 'completed')
  ),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 3. Performance Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_addresses_household ON public.household_addresses(household_id);
CREATE INDEX IF NOT EXISTS idx_drivers_user ON public.delivery_drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_active ON public.delivery_drivers(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_household ON public.delivery_orders(household_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON public.delivery_orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.delivery_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_invoice ON public.delivery_orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.delivery_order_items(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_status_history_order ON public.delivery_order_status_history(delivery_order_id);


-- ------------------------------------------------------------------------------
-- 4. Automated Triggers & Business Logic Enforcements
-- ------------------------------------------------------------------------------

-- A. Auto-maintain single default address per household
CREATE OR REPLACE FUNCTION public.fn_household_address_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.household_addresses
    SET is_default = false
    WHERE household_id = NEW.household_id
      AND id <> NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_household_address_single_default ON public.household_addresses;
CREATE TRIGGER trg_household_address_single_default
BEFORE INSERT OR UPDATE OF is_default ON public.household_addresses
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.fn_household_address_single_default();


-- B. Enforce creation constraints on delivery_orders
CREATE OR REPLACE FUNCTION public.fn_enforce_delivery_orders_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_default_fee NUMERIC;
  v_is_enabled BOOLEAN;
BEGIN
  v_is_admin := public.is_system_admin();

  -- 1. Check if delivery is globally enabled
  SELECT delivery_enabled, default_delivery_fee
  INTO v_is_enabled, v_default_fee
  FROM public.delivery_settings
  LIMIT 1;

  IF (v_is_enabled = false OR v_is_enabled IS NULL) AND NOT v_is_admin THEN
    RAISE EXCEPTION 'خدمة التوصيل معطلة حالياً. لا يمكن إنشاء طلبات جديدة.';
  END IF;

  -- 2. User cannot forge a foreign household_id
  IF NOT v_is_admin AND NOT public.is_household_member(NEW.household_id) THEN
    RAISE EXCEPTION 'غير مصرح بإنشاء طلب لهذا المنزل.';
  END IF;

  -- 3. Regular users cannot manipulate delivery_fee; snapshot from settings
  IF NOT v_is_admin OR NEW.delivery_fee IS NULL OR NEW.delivery_fee = 0 THEN
    NEW.delivery_fee := COALESCE(v_default_fee, 15.00);
  END IF;

  -- 4. Initial status must always start at 'pending_review'
  NEW.status := 'pending_review';

  -- 5. Force calculation of total_amount
  NEW.subtotal := COALESCE(NEW.subtotal, 0);
  NEW.total_amount := NEW.subtotal + NEW.delivery_fee;

  -- 6. Attach creator
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  NEW.created_at := NOW();
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_delivery_orders_insert ON public.delivery_orders;
CREATE TRIGGER trg_enforce_delivery_orders_insert
BEFORE INSERT ON public.delivery_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_enforce_delivery_orders_insert();


-- C. Enforce valid state machine transitions & security on UPDATE
CREATE OR REPLACE FUNCTION public.fn_enforce_delivery_orders_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_driver BOOLEAN;
  v_driver_id UUID;
BEGIN
  v_is_admin := public.is_system_admin();
  v_is_driver := public.is_active_driver();
  v_driver_id := public.get_current_driver_id();

  NEW.updated_at := NOW();

  -- 1. Household/fee immutability for non-admins
  IF NOT v_is_admin THEN
    NEW.household_id := OLD.household_id;
    NEW.delivery_fee := OLD.delivery_fee;
    NEW.invoice_id := OLD.invoice_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;

  -- 2. Status Transitions Validation
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    -- Non-admins/non-drivers (e.g. household members) CANNOT change status to completed or cancelled
    IF NOT v_is_admin AND NOT v_is_driver THEN
      RAISE EXCEPTION 'غير مصرح لهاتف المنزل أو المستخدم بتغيير حالة الطلب مباشرة.';
    END IF;

    -- Case 1: pending_review -> accepted
    IF OLD.status = 'pending_review' AND NEW.status = 'accepted' THEN
      IF NOT v_is_admin AND NOT v_is_driver THEN
        RAISE EXCEPTION 'فقط الدليفري أو الإدارة يمكنهم قبول الطلب.';
      END IF;
      -- Assign to accepting driver if not set
      IF NEW.assigned_driver_id IS NULL AND v_is_driver THEN
        NEW.assigned_driver_id := v_driver_id;
      END IF;
      NEW.accepted_at := NOW();

    -- Case 2: accepted -> completed
    ELSIF OLD.status = 'accepted' AND NEW.status = 'completed' THEN
      IF NOT v_is_admin AND (NOT v_is_driver OR OLD.assigned_driver_id <> v_driver_id) THEN
        RAISE EXCEPTION 'فقط السائق المكلف بهذا الطلب أو الإدارة يمكنهم إكمال التوصيل.';
      END IF;
      NEW.delivered_at := NOW();

    -- Case 3: accepted -> cancellation_pending
    ELSIF OLD.status = 'accepted' AND NEW.status = 'cancellation_pending' THEN
      IF NOT v_is_admin AND (NOT v_is_driver OR OLD.assigned_driver_id <> v_driver_id) THEN
        RAISE EXCEPTION 'فقط السائق المكلف أو الإدارة يمكنهم طلب إلغاء هذا الطلب.';
      END IF;
      IF NEW.cancellation_reason IS NULL OR TRIM(NEW.cancellation_reason) = '' THEN
        RAISE EXCEPTION 'ملاحظة وسبب طلب الإلغاء إجبارية.';
      END IF;
      NEW.cancellation_requested_at := NOW();
      NEW.cancellation_requested_by := auth.uid();

    -- Case 4: cancellation_pending -> cancelled (Admin approval)
    ELSIF OLD.status = 'cancellation_pending' AND NEW.status = 'cancelled' THEN
      IF NOT v_is_admin THEN
        RAISE EXCEPTION 'فقط الإدارة تملك صلاحية الموافقة النهائية على الإلغاء.';
      END IF;
      NEW.cancellation_decided_at := NOW();
      NEW.cancellation_decided_by := auth.uid();

    -- Case 5: cancellation_pending -> accepted (Admin rejection of cancellation)
    ELSIF OLD.status = 'cancellation_pending' AND NEW.status = 'accepted' THEN
      IF NOT v_is_admin THEN
        RAISE EXCEPTION 'فقط الإدارة تملك صلاحية رفض طلب الإلغاء وإعادة الطلب للقبول.';
      END IF;
      NEW.cancellation_decided_at := NOW();
      NEW.cancellation_decided_by := auth.uid();

    -- Any other transition is blocked
    ELSE
      IF NOT v_is_admin THEN
        RAISE EXCEPTION 'انتقال غير مسموح به لحالة الطلب من % إلى %', OLD.status, NEW.status;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_delivery_orders_update ON public.delivery_orders;
CREATE TRIGGER trg_enforce_delivery_orders_update
BEFORE UPDATE ON public.delivery_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_enforce_delivery_orders_update();


-- D. Automatic Status History Logging
CREATE OR REPLACE FUNCTION public.fn_log_delivery_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.delivery_order_status_history (
      delivery_order_id,
      old_status,
      new_status,
      changed_by,
      note,
      created_at
    ) VALUES (
      NEW.id,
      NULL,
      NEW.status,
      COALESCE(auth.uid(), NEW.created_by),
      'إنشاء الطلب في النظام',
      NOW()
    );
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.delivery_order_status_history (
      delivery_order_id,
      old_status,
      new_status,
      changed_by,
      note,
      created_at
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      COALESCE(NEW.cancellation_decision_note, NEW.cancellation_reason, 'تغيير حالة الطلب'),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_delivery_order_status ON public.delivery_orders;
CREATE TRIGGER trg_log_delivery_order_status
AFTER INSERT OR UPDATE ON public.delivery_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_delivery_order_status();


-- ------------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------

ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_status_history ENABLE ROW LEVEL SECURITY;

-- 5.1 delivery_settings Policies
DROP POLICY IF EXISTS "delivery_settings_select_policy" ON public.delivery_settings;
CREATE POLICY "delivery_settings_select_policy"
ON public.delivery_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "delivery_settings_admin_policy" ON public.delivery_settings;
CREATE POLICY "delivery_settings_admin_policy"
ON public.delivery_settings FOR ALL
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());


-- 5.2 household_addresses Policies
DROP POLICY IF EXISTS "household_addresses_select_policy" ON public.household_addresses;
CREATE POLICY "household_addresses_select_policy"
ON public.household_addresses FOR SELECT
TO authenticated
USING (
  public.is_household_member(household_id)
  OR public.is_active_driver()
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS "household_addresses_insert_policy" ON public.household_addresses;
CREATE POLICY "household_addresses_insert_policy"
ON public.household_addresses FOR INSERT
TO authenticated
WITH CHECK (
  public.is_household_member(household_id)
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS "household_addresses_update_policy" ON public.household_addresses;
CREATE POLICY "household_addresses_update_policy"
ON public.household_addresses FOR UPDATE
TO authenticated
USING (
  public.is_household_member(household_id)
  OR public.is_system_admin()
)
WITH CHECK (
  public.is_household_member(household_id)
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS "household_addresses_delete_policy" ON public.household_addresses;
CREATE POLICY "household_addresses_delete_policy"
ON public.household_addresses FOR DELETE
TO authenticated
USING (
  public.is_household_member(household_id)
  OR public.is_system_admin()
);


-- 5.3 delivery_drivers Policies
DROP POLICY IF EXISTS "delivery_drivers_select_policy" ON public.delivery_drivers;
CREATE POLICY "delivery_drivers_select_policy"
ON public.delivery_drivers FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_system_admin()
  OR public.is_active_driver()
);

DROP POLICY IF EXISTS "delivery_drivers_admin_modify_policy" ON public.delivery_drivers;
CREATE POLICY "delivery_drivers_admin_modify_policy"
ON public.delivery_drivers FOR ALL
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());


-- 5.4 delivery_orders Policies
DROP POLICY IF EXISTS "delivery_orders_select_policy" ON public.delivery_orders;
CREATE POLICY "delivery_orders_select_policy"
ON public.delivery_orders FOR SELECT
TO authenticated
USING (
  public.is_household_member(household_id)
  OR assigned_driver_id = public.get_current_driver_id()
  OR (public.is_active_driver() AND status = 'pending_review')
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS "delivery_orders_insert_policy" ON public.delivery_orders;
CREATE POLICY "delivery_orders_insert_policy"
ON public.delivery_orders FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_household_member(household_id) AND public.is_delivery_enabled())
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS "delivery_orders_update_policy" ON public.delivery_orders;
CREATE POLICY "delivery_orders_update_policy"
ON public.delivery_orders FOR UPDATE
TO authenticated
USING (
  public.is_system_admin()
  OR (public.is_active_driver() AND (assigned_driver_id = public.get_current_driver_id() OR status = 'pending_review'))
  OR (public.is_household_member(household_id) AND status = 'pending_review')
)
WITH CHECK (
  public.is_system_admin()
  OR (public.is_active_driver() AND (assigned_driver_id = public.get_current_driver_id() OR status = 'pending_review'))
  OR (public.is_household_member(household_id) AND status = 'pending_review')
);

DROP POLICY IF EXISTS "delivery_orders_delete_policy" ON public.delivery_orders;
CREATE POLICY "delivery_orders_delete_policy"
ON public.delivery_orders FOR DELETE
TO authenticated
USING (public.is_system_admin());


-- 5.5 delivery_order_items Policies
DROP POLICY IF EXISTS "delivery_order_items_select_policy" ON public.delivery_order_items;
CREATE POLICY "delivery_order_items_select_policy"
ON public.delivery_order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = delivery_order_items.delivery_order_id
      AND (
        public.is_household_member(o.household_id)
        OR o.assigned_driver_id = public.get_current_driver_id()
        OR (public.is_active_driver() AND o.status = 'pending_review')
        OR public.is_system_admin()
      )
  )
);

DROP POLICY IF EXISTS "delivery_order_items_insert_policy" ON public.delivery_order_items;
CREATE POLICY "delivery_order_items_insert_policy"
ON public.delivery_order_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = delivery_order_items.delivery_order_id
      AND (public.is_household_member(o.household_id) OR public.is_system_admin())
  )
);

DROP POLICY IF EXISTS "delivery_order_items_modify_policy" ON public.delivery_order_items;
CREATE POLICY "delivery_order_items_modify_policy"
ON public.delivery_order_items FOR ALL
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());


-- 5.6 delivery_order_status_history Policies
DROP POLICY IF EXISTS "status_history_select_policy" ON public.delivery_order_status_history;
CREATE POLICY "status_history_select_policy"
ON public.delivery_order_status_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = delivery_order_status_history.delivery_order_id
      AND (
        public.is_household_member(o.household_id)
        OR o.assigned_driver_id = public.get_current_driver_id()
        OR public.is_system_admin()
      )
  )
);


-- ------------------------------------------------------------------------------
-- 6. Authoritative RPC Functions for Applications & Dashboards
-- ------------------------------------------------------------------------------

-- 6.1 Atomic Order Creation RPC
CREATE OR REPLACE FUNCTION public.create_delivery_order(
  p_household_id TEXT,
  p_address_id UUID,
  p_invoice_id TEXT DEFAULT NULL,
  p_delivery_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address RECORD;
  v_settings RECORD;
  v_order_id UUID;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_item JSONB;
BEGIN
  -- 1. Check if delivery is enabled
  SELECT * INTO v_settings FROM public.delivery_settings LIMIT 1;
  IF (v_settings.delivery_enabled = false OR v_settings IS NULL) AND NOT public.is_system_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'SERVICE_DISABLED', 'message', 'خدمة التوصيل غير مفعلة حالياً');
  END IF;

  -- 2. Check authorization
  IF NOT public.is_household_member(p_household_id) AND NOT public.is_system_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'غير مصرح بإنشاء طلب لهذا المنزل');
  END IF;

  -- 3. Fetch address snapshot
  SELECT * INTO v_address FROM public.household_addresses
  WHERE id = p_address_id AND household_id = p_household_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADDRESS_NOT_FOUND', 'message', 'عنوان التوصيل المحدد غير موجود');
  END IF;

  -- 4. Calculate subtotal from items array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + (COALESCE((v_item->>'total_price')::numeric, 0));
  END LOOP;

  v_total := v_subtotal + COALESCE(v_settings.default_delivery_fee, 15.00);

  -- 5. Insert main order
  INSERT INTO public.delivery_orders (
    household_id,
    invoice_id,
    created_by,
    address_id,
    customer_name,
    customer_phone,
    country,
    governorate_name,
    markaz_name,
    detailed_address,
    delivery_fee,
    subtotal,
    total_amount,
    delivery_notes,
    status
  ) VALUES (
    p_household_id,
    p_invoice_id,
    auth.uid(),
    v_address.id,
    v_address.full_name,
    v_address.phone,
    v_address.country,
    v_address.governorate_name,
    v_address.markaz_name,
    v_address.detailed_address,
    COALESCE(v_settings.default_delivery_fee, 15.00),
    v_subtotal,
    v_total,
    p_delivery_notes,
    'pending_review'
  ) RETURNING id INTO v_order_id;

  -- 6. Insert items snapshot
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.delivery_order_items (
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
      v_item->>'product_id',
      COALESCE(v_item->>'product_name', 'صنف غير مسمى'),
      v_item->>'category_id',
      v_item->>'category_name',
      COALESCE(v_item->>'quantity', '١'),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'total_price')::numeric, 0)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'delivery_fee', COALESCE(v_settings.default_delivery_fee, 15.00),
    'total_amount', v_total,
    'status', 'pending_review',
    'message', 'تم إرسال طلب التوصيل بنجاح وهو الآن قيد المراجعة'
  );
END;
$$;


-- 6.2 Driver Accept Order RPC
CREATE OR REPLACE FUNCTION public.driver_accept_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_order RECORD;
BEGIN
  IF NOT public.is_active_driver() AND NOT public.is_system_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_DRIVER', 'message', 'يجب أن تكون سائق توصيل نشط لقبول الطلب');
  END IF;

  v_driver_id := public.get_current_driver_id();

  SELECT * INTO v_order FROM public.delivery_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'الطلب غير موجود');
  END IF;

  IF v_order.status <> 'pending_review' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'لا يمكن قبول طلب ليس قيد المراجعة');
  END IF;

  UPDATE public.delivery_orders
  SET
    status = 'accepted',
    assigned_driver_id = COALESCE(v_driver_id, assigned_driver_id),
    accepted_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'accepted',
    'message', 'تم قبول الطلب بنجاح وتعيينه للدليفري'
  );
END;
$$;


-- 6.3 Driver Request Cancellation RPC (Mandatory Reason)
CREATE OR REPLACE FUNCTION public.driver_request_cancellation(
  p_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_order RECORD;
BEGIN
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'REASON_REQUIRED', 'message', 'سبب طلب الإلغاء إجباري');
  END IF;

  v_driver_id := public.get_current_driver_id();

  SELECT * INTO v_order FROM public.delivery_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'الطلب غير موجود');
  END IF;

  IF NOT public.is_system_admin() AND (v_order.assigned_driver_id <> v_driver_id OR v_driver_id IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'غير مصرح لك بطلب إلغاء هذا الطلب');
  END IF;

  IF v_order.status <> 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'يمكن طلب الإلغاء فقط للطلبات المقبولة');
  END IF;

  UPDATE public.delivery_orders
  SET
    status = 'cancellation_pending',
    cancellation_reason = TRIM(p_reason),
    cancellation_requested_at = NOW(),
    cancellation_requested_by = auth.uid()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'cancellation_pending',
    'message', 'تم إرسال طلب الإلغاء وبانتظار موافقة الإدارة'
  );
END;
$$;


-- 6.4 Admin Decide Cancellation RPC
CREATE OR REPLACE FUNCTION public.admin_decide_cancellation(
  p_order_id UUID,
  p_approve BOOLEAN,
  p_decision_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT public.is_system_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'صلاحية اتخاذ قرار الإلغاء مقتصرة على الإدارة فقط');
  END IF;

  SELECT * INTO v_order FROM public.delivery_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'الطلب غير موجود');
  END IF;

  IF v_order.status <> 'cancellation_pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'الطلب ليس في حالة انتظار موافقة الإلغاء');
  END IF;

  IF p_approve = true THEN
    UPDATE public.delivery_orders
    SET
      status = 'cancelled',
      cancellation_decided_at = NOW(),
      cancellation_decided_by = auth.uid(),
      cancellation_decision_note = p_decision_note
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'status', 'cancelled',
      'message', 'تمت الموافقة على إلغاء الطلب بنجاح'
    );
  ELSE
    UPDATE public.delivery_orders
    SET
      status = 'accepted',
      cancellation_decided_at = NOW(),
      cancellation_decided_by = auth.uid(),
      cancellation_decision_note = COALESCE(p_decision_note, 'تم رفض طلب الإلغاء واستمرار الطلب')
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'status', 'accepted',
      'message', 'تم رفض طلب الإلغاء وإعادة الطلب إلى قائمة المقبول'
    );
  END IF;
END;
$$;


-- 6.5 Driver Mark Completed RPC
CREATE OR REPLACE FUNCTION public.driver_complete_order(
  p_order_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_order RECORD;
BEGIN
  v_driver_id := public.get_current_driver_id();

  SELECT * INTO v_order FROM public.delivery_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'الطلب غير موجود');
  END IF;

  IF NOT public.is_system_admin() AND (v_order.assigned_driver_id <> v_driver_id OR v_driver_id IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'فقط السائق المكلف بالطلب أو الإدارة يمكنهم إكماله');
  END IF;

  IF v_order.status <> 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'يمكن إكمال التوصيل فقط للطلبات المقبولة');
  END IF;

  UPDATE public.delivery_orders
  SET
    status = 'completed',
    delivered_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'completed',
    'message', 'تم تسجيل اكتمال توصيل الطلب بنجاح'
  );
END;
$$;


-- 6.6 Toggle Delivery Service & Fees (Admin only)
CREATE OR REPLACE FUNCTION public.toggle_delivery_service(
  p_enabled BOOLEAN,
  p_default_fee NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'فقط الإدارة تملك صلاحية تعديل إعدادات التوصيل');
  END IF;

  UPDATE public.delivery_settings
  SET
    delivery_enabled = p_enabled,
    default_delivery_fee = COALESCE(p_default_fee, default_delivery_fee),
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = 'default';

  RETURN jsonb_build_object(
    'success', true,
    'delivery_enabled', p_enabled,
    'message', CASE WHEN p_enabled THEN 'تم تفعيل خدمة التوصيل بنجاح' ELSE 'تم تعطيل خدمة التوصيل بنجاح' END
  );
END;
$$;
