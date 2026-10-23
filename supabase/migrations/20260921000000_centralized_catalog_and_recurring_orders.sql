-- ==============================================================================
-- MIGRATION: 20260921000000_centralized_catalog_and_recurring_orders.sql
-- Talabat Al-Bayt: Centralized Global & Household Catalog, Recurring Orders,
-- Governorate Delivery Fees, and Admin Notifications System.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GLOBAL CATALOG: global_categories & global_products
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.global_categories (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  image_url TEXT NOT NULL,
  icon_name TEXT DEFAULT 'ShoppingCart',
  color TEXT DEFAULT 'emerald',
  bg_light TEXT,
  badge_color TEXT,
  description TEXT,
  subcategories JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.global_products (
  id TEXT PRIMARY KEY,
  global_category_id TEXT NOT NULL REFERENCES public.global_categories(id) ON DELETE CASCADE,
  subcategory_id TEXT,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  image_url TEXT,
  default_quantity TEXT DEFAULT '١',
  default_unit TEXT DEFAULT 'قطعة',
  estimated_price NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. EVOLVE public.categories (Household Categories)
-- Keep all existing columns, add linkage to global catalog and timestamps
-- ------------------------------------------------------------------------------

ALTER TABLE public.categories 
  ADD COLUMN IF NOT EXISTS source_global_category_id TEXT REFERENCES public.global_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 3. HOUSEHOLD CATALOG: household_products
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.household_products (
  id TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  image_url TEXT,
  quantity TEXT DEFAULT '١',
  unit TEXT DEFAULT 'قطعة',
  estimated_price NUMERIC DEFAULT 0,
  source_global_product_id TEXT REFERENCES public.global_products(id) ON DELETE SET NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (household_id, id),
  FOREIGN KEY (household_id, category_id) REFERENCES public.categories(household_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 4. RECURRING ORDERS & TEMPORARY ORDER DRAFTS ("طلباتي")
-- ------------------------------------------------------------------------------

-- Template for recurring orders (Daily / Weekly / Monthly)
CREATE TABLE IF NOT EXISTS public.recurring_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot items inside the recurring order template
CREATE TABLE IF NOT EXISTS public.recurring_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_order_id UUID NOT NULL REFERENCES public.recurring_orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name_snapshot TEXT NOT NULL,
  category_id TEXT,
  category_name_snapshot TEXT,
  quantity TEXT NOT NULL DEFAULT '١',
  unit TEXT NOT NULL DEFAULT 'قطعة',
  estimated_unit_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Temporary Order Draft spawned upon clicking "اطلب الآن"
CREATE TABLE IF NOT EXISTS public.recurring_order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  recurring_order_id UUID REFERENCES public.recurring_orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_role TEXT NOT NULL DEFAULT 'home', -- 'home' | 'admin'
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'pending_review', 'approved', 'rejected', 'cancelled')
  ),
  notes TEXT,
  review_notes TEXT,
  delivery_order_id UUID REFERENCES public.delivery_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items inside the Temporary Order Draft (Snapshot editable without affecting the template)
CREATE TABLE IF NOT EXISTS public.recurring_order_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.recurring_order_requests(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  category_id TEXT,
  category_name TEXT,
  quantity TEXT NOT NULL DEFAULT '١',
  unit TEXT NOT NULL DEFAULT 'قطعة',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  is_modified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evolve delivery_orders to link to source recurring draft
ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS source_recurring_request_id UUID REFERENCES public.recurring_order_requests(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 5. GOVERNORATE DELIVERY SETTINGS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delivery_governorate_settings (
  governorate_name TEXT PRIMARY KEY,
  governorate_code TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  delivery_fee NUMERIC NOT NULL DEFAULT 15.00,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. ADMIN CENTRAL NOTIFICATIONS (Top banner, Modal, Bottom banner)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('top_banner', 'modal', 'bottom_banner')),
  image_url TEXT,
  icon_name TEXT DEFAULT 'Bell',
  action_type TEXT DEFAULT 'internal_route', -- 'internal_route' | 'none'
  action_route TEXT, -- 'home', 'categories', 'category:<id>', 'purchases', 'missing', 'recurring_orders', 'delivery', 'settings'
  target_scope TEXT NOT NULL DEFAULT 'all', -- 'all' | 'admin' | 'home' | 'household' | 'governorate'
  target_value TEXT,
  max_display_count INT NOT NULL DEFAULT 3,
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track views per household & role/user to enforce max_display_count
CREATE TABLE IF NOT EXISTS public.admin_notification_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.admin_notifications(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_role TEXT DEFAULT 'all',
  display_count INT NOT NULL DEFAULT 1,
  last_displayed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_admin_notif_view UNIQUE (notification_id, household_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_global_cat_active ON public.global_categories(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_global_prod_cat ON public.global_products(global_category_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_hh_source ON public.categories(household_id, source_global_category_id);
CREATE INDEX IF NOT EXISTS idx_household_products_hh ON public.household_products(household_id);
CREATE INDEX IF NOT EXISTS idx_household_products_cat ON public.household_products(household_id, category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_hh ON public.recurring_orders(household_id, frequency);
CREATE INDEX IF NOT EXISTS idx_recurring_order_items_order ON public.recurring_order_items(recurring_order_id);
CREATE INDEX IF NOT EXISTS idx_recurring_requests_hh ON public.recurring_order_requests(household_id, status);
CREATE INDEX IF NOT EXISTS idx_recurring_request_items_req ON public.recurring_order_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_admin_notif_active ON public.admin_notifications(is_active, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_admin_notif_views_hh ON public.admin_notification_views(household_id, user_id);

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.global_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_order_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_governorate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_views ENABLE ROW LEVEL SECURITY;

-- 8.1 Global Catalog RLS: Anyone can read, only system admin can write
CREATE POLICY "global_categories_read_all"
  ON public.global_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_system_admin());

CREATE POLICY "global_categories_admin_all"
  ON public.global_categories
  FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

CREATE POLICY "global_products_read_all"
  ON public.global_products
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_system_admin());

CREATE POLICY "global_products_admin_all"
  ON public.global_products
  FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- 8.2 Household Products RLS: Isolated by household_id
CREATE POLICY "household_products_member_access"
  ON public.household_products
  FOR ALL
  TO authenticated
  USING (public.is_household_member(household_id) OR public.is_system_admin())
  WITH CHECK (public.is_household_member(household_id) OR public.is_system_admin());

-- 8.3 Recurring Orders RLS: Isolated by household_id
CREATE POLICY "recurring_orders_member_access"
  ON public.recurring_orders
  FOR ALL
  TO authenticated
  USING (public.is_household_member(household_id) OR public.is_system_admin())
  WITH CHECK (public.is_household_member(household_id) OR public.is_system_admin());

CREATE POLICY "recurring_order_items_member_access"
  ON public.recurring_order_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_orders ro
      WHERE ro.id = recurring_order_items.recurring_order_id
        AND (public.is_household_member(ro.household_id) OR public.is_system_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recurring_orders ro
      WHERE ro.id = recurring_order_items.recurring_order_id
        AND (public.is_household_member(ro.household_id) OR public.is_system_admin())
    )
  );

-- 8.4 Recurring Order Requests (Drafts) RLS: Isolated by household_id
CREATE POLICY "recurring_order_requests_member_access"
  ON public.recurring_order_requests
  FOR ALL
  TO authenticated
  USING (public.is_household_member(household_id) OR public.is_system_admin())
  WITH CHECK (public.is_household_member(household_id) OR public.is_system_admin());

CREATE POLICY "recurring_order_request_items_member_access"
  ON public.recurring_order_request_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_order_requests ror
      WHERE ror.id = recurring_order_request_items.request_id
        AND (public.is_household_member(ror.household_id) OR public.is_system_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recurring_order_requests ror
      WHERE ror.id = recurring_order_request_items.request_id
        AND (public.is_household_member(ror.household_id) OR public.is_system_admin())
    )
  );

-- 8.5 Delivery Governorate Settings RLS: Read by all authenticated, write by system admin
CREATE POLICY "governorate_settings_read_all"
  ON public.delivery_governorate_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "governorate_settings_admin_all"
  ON public.delivery_governorate_settings
  FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- 8.6 Admin Notifications RLS: Read active notifications within time window, admin manages
CREATE POLICY "admin_notifications_read"
  ON public.admin_notifications
  FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND (start_at <= NOW()) 
    AND (end_at IS NULL OR end_at >= NOW())
    OR public.is_system_admin()
  );

CREATE POLICY "admin_notifications_admin_write"
  ON public.admin_notifications
  FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- 8.7 Admin Notification Views RLS: Members manage their household's view records
CREATE POLICY "admin_notification_views_member_access"
  ON public.admin_notification_views
  FOR ALL
  TO authenticated
  USING (public.is_household_member(household_id) OR public.is_system_admin())
  WITH CHECK (public.is_household_member(household_id) OR public.is_system_admin());

-- ------------------------------------------------------------------------------
-- 9. FUNCTIONS & RPCS
-- ------------------------------------------------------------------------------

-- 9.1 Seed Household from Global Catalog
CREATE OR REPLACE FUNCTION public.seed_household_catalog(p_household_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat RECORD;
  v_prod RECORD;
  v_count_cats INT := 0;
  v_count_prods INT := 0;
BEGIN
  -- Verify caller is household member or admin
  IF NOT (public.is_household_member(p_household_id) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية لتهيئة كتالوج هذا المنزل';
  END IF;

  -- 1. Copy active global categories to household categories
  FOR v_cat IN SELECT * FROM public.global_categories WHERE is_active = true ORDER BY sort_order ASC LOOP
    INSERT INTO public.categories (
      id,
      household_id,
      name_ar,
      name_en,
      image_url,
      color,
      bg_light,
      badge_color,
      description,
      common_items,
      subcategories,
      is_custom,
      source_global_category_id,
      is_active,
      sort_order,
      updated_at
    ) VALUES (
      v_cat.id,
      p_household_id,
      v_cat.name_ar,
      COALESCE(v_cat.name_en, ''),
      v_cat.image_url,
      COALESCE(v_cat.color, 'emerald'),
      COALESCE(v_cat.bg_light, ''),
      COALESCE(v_cat.badge_color, ''),
      COALESCE(v_cat.description, ''),
      '[]'::jsonb,
      COALESCE(v_cat.subcategories, '[]'::jsonb),
      false,
      v_cat.id,
      true,
      v_cat.sort_order,
      NOW()
    ) ON CONFLICT (household_id, id) DO UPDATE SET
      source_global_category_id = EXCLUDED.source_global_category_id,
      updated_at = NOW();

    v_count_cats := v_count_cats + 1;
  END LOOP;

  -- 2. Copy active global products to household_products
  FOR v_prod IN SELECT * FROM public.global_products WHERE is_active = true ORDER BY sort_order ASC LOOP
    INSERT INTO public.household_products (
      id,
      household_id,
      category_id,
      subcategory_id,
      name_ar,
      name_en,
      image_url,
      quantity,
      unit,
      estimated_price,
      source_global_product_id,
      is_custom,
      is_active,
      sort_order,
      created_at,
      updated_at
    ) VALUES (
      v_prod.id,
      p_household_id,
      v_prod.global_category_id,
      v_prod.subcategory_id,
      v_prod.name_ar,
      v_prod.name_en,
      v_prod.image_url,
      COALESCE(v_prod.default_quantity, '١'),
      COALESCE(v_prod.default_unit, 'قطعة'),
      COALESCE(v_prod.estimated_price, 0),
      v_prod.id,
      false,
      true,
      v_prod.sort_order,
      NOW(),
      NOW()
    ) ON CONFLICT (household_id, id) DO NOTHING;

    v_count_prods := v_count_prods + 1;
  END LOOP;

  -- Update common_items on categories for backward compatibility
  UPDATE public.categories c
  SET common_items = (
    SELECT COALESCE(jsonb_agg(hp.name_ar), '[]'::jsonb)
    FROM public.household_products hp
    WHERE hp.household_id = c.household_id
      AND hp.category_id = c.id
      AND hp.is_active = true
  )
  WHERE c.household_id = p_household_id;

  RETURN jsonb_build_object(
    'success', true,
    'categories_seeded', v_count_cats,
    'products_seeded', v_count_prods
  );
END;
$$;

-- 9.2 Approve Recurring Order Request and Convert to Delivery Order
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
  v_gov RECORD;
  v_fee NUMERIC := 15.00;
  v_subtotal NUMERIC := 0.00;
  v_total NUMERIC := 0.00;
  v_new_order_id UUID;
  v_item RECORD;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- 1. Fetch request
  SELECT * INTO v_req FROM public.recurring_order_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب المسودة غير موجود');
  END IF;

  -- Verify caller is household admin or system admin
  IF NOT (public.is_household_admin(v_req.household_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'الموافقة على الطلبات محصورة بمسؤول المنزل');
  END IF;

  IF v_req.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'message', 'تمت الموافقة على هذا الطلب بالفعل');
  END IF;

  -- 2. Fetch and validate address
  SELECT * INTO v_addr FROM public.household_addresses
  WHERE id = p_address_id AND household_id = v_req.household_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'عنوان التوصيل المحدد غير موجود');
  END IF;

  -- 3. Check governorate delivery fee and active status
  SELECT * INTO v_gov FROM public.delivery_governorate_settings
  WHERE governorate_name = v_addr.governorate_name;

  IF FOUND THEN
    IF NOT v_gov.is_enabled THEN
      RETURN jsonb_build_object('success', false, 'message', 'خدمة التوصيل معطلة حالياً في محافظة ' || v_addr.governorate_name);
    END IF;
    v_fee := v_gov.delivery_fee;
  ELSE
    -- Fallback to default delivery fee in delivery_settings
    SELECT default_delivery_fee INTO v_fee FROM public.delivery_settings LIMIT 1;
    IF v_fee IS NULL THEN
      v_fee := 15.00;
    END IF;
  END IF;

  -- 4. Calculate subtotal from draft items
  SELECT COALESCE(SUM(total_price), 0.00) INTO v_subtotal
  FROM public.recurring_order_request_items
  WHERE request_id = p_request_id;

  v_total := v_subtotal + v_fee;

  -- 5. Create delivery order
  INSERT INTO public.delivery_orders (
    household_id,
    user_id,
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
    v_addr.governorate_name,
    v_addr.markaz_name,
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

  -- 6. Copy items to delivery_order_items
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

  -- 7. Update request status
  UPDATE public.recurring_order_requests
  SET status = 'approved',
      reviewed_by = v_caller_id,
      delivery_order_id = v_new_order_id,
      updated_at = NOW()
  WHERE id = p_request_id;

  -- 8. Add notification to household members
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

-- 9.3 Evolve create_delivery_order RPC to enforce governorate fee and enabled status
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
  v_gov RECORD;
  v_order_id UUID;
  v_fee NUMERIC := 15.00;
  v_subtotal NUMERIC := 0.00;
  v_total NUMERIC := 0.00;
  v_item JSONB;
  v_item_price NUMERIC;
  v_item_qty_str TEXT;
  v_item_total NUMERIC;
  v_status public.delivery_order_status := 'pending_review';
BEGIN
  v_caller_id := auth.uid();

  -- 1. Check if delivery is globally enabled
  IF NOT public.is_delivery_enabled() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'خدمة التوصيل للمنزل غير متاحة حالياً'
    );
  END IF;

  -- 2. Verify household membership
  IF NOT (public.is_household_member(p_household_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'ليس لديك صلاحية لإنشاء طلب توصيل لهذا المنزل'
    );
  END IF;

  -- 3. Fetch and validate address
  SELECT * INTO v_address
  FROM public.household_addresses
  WHERE id = p_address_id AND household_id = p_household_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'عنوان التوصيل المحدد غير موجود'
    );
  END IF;

  -- 4. Check Governorate Settings (Enabled & Custom Fee)
  SELECT * INTO v_gov
  FROM public.delivery_governorate_settings
  WHERE governorate_name = v_address.governorate_name;

  IF FOUND THEN
    IF NOT v_gov.is_enabled THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'خدمة التوصيل غير متاحة حالياً في محافظة ' || v_address.governorate_name
      );
    END IF;
    v_fee := v_gov.delivery_fee;
  ELSE
    -- Use global default delivery fee
    SELECT default_delivery_fee INTO v_fee
    FROM public.delivery_settings
    LIMIT 1;
    IF v_fee IS NULL THEN
      v_fee := 15.00;
    END IF;
  END IF;

  -- 5. Calculate subtotal from items JSONB
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'لا يمكن إنشاء طلب توصيل بدون أصناف'
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0.00);
    v_item_total := COALESCE((v_item->>'total_price')::NUMERIC, v_item_price);
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  v_total := v_subtotal + v_fee;

  -- 6. Insert delivery order
  INSERT INTO public.delivery_orders (
    household_id,
    user_id,
    invoice_id,
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
    status,
    created_at,
    updated_at
  ) VALUES (
    p_household_id,
    v_caller_id,
    p_invoice_id,
    p_address_id,
    v_address.full_name,
    v_address.phone,
    v_address.country,
    v_address.governorate_name,
    v_address.markaz_name,
    v_address.detailed_address,
    v_fee,
    v_subtotal,
    v_total,
    p_delivery_notes,
    v_status,
    NOW(),
    NOW()
  ) RETURNING id INTO v_order_id;

  -- 7. Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0.00);
    v_item_total := COALESCE((v_item->>'total_price')::NUMERIC, v_item_price);
    v_item_qty_str := COALESCE(v_item->>'quantity', '١');

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
      COALESCE(v_item->>'product_name', 'صنف غير مسمى'),
      v_item->>'category_id',
      v_item->>'category_name',
      v_item_qty_str,
      v_item_price,
      v_item_total
    );
  END LOOP;

  -- 8. Log initial status
  INSERT INTO public.delivery_order_status_history (
    delivery_order_id,
    old_status,
    new_status,
    changed_by,
    note
  ) VALUES (
    v_order_id,
    NULL,
    v_status,
    v_caller_id,
    'إنشاء الطلب بنجاح وهو قيد المراجعة'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'delivery_fee', v_fee,
    'total_amount', v_total
  );
END;
$$;

-- 9.4 Record Admin Notification View and Increment Display Count
CREATE OR REPLACE FUNCTION public.record_admin_notification_view(
  p_notification_id UUID,
  p_household_id TEXT,
  p_device_role TEXT DEFAULT 'all',
  p_is_dismiss BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_view RECORD;
BEGIN
  v_user_id := auth.uid();

  INSERT INTO public.admin_notification_views (
    notification_id,
    household_id,
    user_id,
    device_role,
    display_count,
    last_displayed_at,
    dismissed_at
  ) VALUES (
    p_notification_id,
    p_household_id,
    v_user_id,
    p_device_role,
    1,
    NOW(),
    CASE WHEN p_is_dismiss THEN NOW() ELSE NULL END
  )
  ON CONFLICT (notification_id, household_id, user_id)
  DO UPDATE SET
    display_count = public.admin_notification_views.display_count + CASE WHEN p_is_dismiss THEN 0 ELSE 1 END,
    last_displayed_at = NOW(),
    dismissed_at = CASE WHEN p_is_dismiss THEN NOW() ELSE public.admin_notification_views.dismissed_at END
  RETURNING * INTO v_view;

  RETURN jsonb_build_object(
    'success', true,
    'display_count', v_view.display_count,
    'is_dismissed', (v_view.dismissed_at IS NOT NULL)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. SEEDING EGYPT GOVERNORATES & INITIAL GLOBAL CATALOG
-- ------------------------------------------------------------------------------

-- 10.1 Seed Egypt 27 Governorates with default delivery fee
INSERT INTO public.delivery_governorate_settings (governorate_name, governorate_code, is_enabled, delivery_fee)
VALUES
  ('سوهاج', 'EG-SHG', true, 15.00),
  ('القاهرة', 'EG-C', true, 15.00),
  ('الجيزة', 'EG-GZ', true, 15.00),
  ('الإسكندرية', 'EG-ALX', true, 15.00),
  ('أسيوط', 'EG-AST', true, 15.00),
  ('قنا', 'EG-KN', true, 15.00),
  ('الأقصر', 'EG-LX', true, 15.00),
  ('أسوان', 'EG-ASN', true, 15.00),
  ('المنيا', 'EG-MN', true, 15.00),
  ('بني سويف', 'EG-BNS', true, 15.00),
  ('الفيوم', 'EG-FYM', true, 15.00),
  ('البحر الأحمر', 'EG-BA', true, 15.00),
  ('الوادي الجديد', 'EG-WAD', true, 15.00),
  ('مطروح', 'EG-MT', true, 15.00),
  ('شمال سيناء', 'EG-SIN', true, 15.00),
  ('جنوب سيناء', 'EG-JS', true, 15.00),
  ('بورسعيد', 'EG-PTS', true, 15.00),
  ('الإسماعيلية', 'EG-IS', true, 15.00),
  ('السويس', 'EG-SUZ', true, 15.00),
  ('الشرقية', 'EG-SHR', true, 15.00),
  ('الدقهلية', 'EG-DK', true, 15.00),
  ('القليوبية', 'EG-KB', true, 15.00),
  ('الغربية', 'EG-GH', true, 15.00),
  ('المنوفية', 'EG-MNF', true, 15.00),
  ('البحيرة', 'EG-BH', true, 15.00),
  ('كفر الشيخ', 'EG-KFS', true, 15.00),
  ('دمياط', 'EG-DT', true, 15.00)
ON CONFLICT (governorate_name) DO NOTHING;

-- 10.2 Seed Global Categories from categories.ts
INSERT INTO public.global_categories (id, name_ar, name_en, image_url, icon_name, color, bg_light, badge_color, description, subcategories, sort_order)
VALUES
  (
    'supermarket',
    'سوبرماركت وتموين',
    'Supermarket & Pantry',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    'ShoppingCart',
    'emerald',
    'bg-emerald-50 text-emerald-800 border-emerald-200',
    'bg-emerald-100 text-emerald-800',
    'الألبان، الأجبان، البقوليات، الزيوت، الحبوب، والمعلبات',
    '[
      {"id": "dairy", "nameAr": "ألبان وأجبان", "items": ["لبن بلدي طازج", "جبنة تلاجة", "جبنة براميلي", "جبنة فيتا بيضاء", "لبنة بلدية", "زبادي سادة", "قشطة بلدي", "زبدة غير مملحة", "بيض طازج (طبق ٣٠ بيضة)"]},
      {"id": "legumes", "nameAr": "بقوليات وحبوب", "items": ["عدس أصفر", "عدس بجبة", "فاصوليا بيضاء", "فول تدميس بلدي", "حمص الشام", "لوبيا جافة", "أرز بسمتي فاخر (٥ كجم)", "أرز مصري درجة أولى", "مكرونة متنوعة"]},
      {"id": "oils_sugars", "nameAr": "زيوت وسكريات", "items": ["زيت دوار الشمس (١.٥ لتر)", "زيت زيتون بكر ممتاز", "سمن بلدي طبيعي", "سكر أبيض (٥ كجم)"]},
      {"id": "canned_beverages", "nameAr": "معلبات ومشروبات", "items": ["شاي أحمر فاخر", "قهوة عربية مطحونة", "معجون طماطم معلب", "تونة في الزيت"]}
    ]'::jsonb,
    1
  ),
  (
    'vegetables_fruits',
    'خضروات وفواكه طازجة',
    'Vegetables & Fruits',
    'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80',
    'Apple',
    'amber',
    'bg-amber-50 text-amber-800 border-amber-200',
    'bg-amber-100 text-amber-800',
    'الخضروات الطازجة، الفواكه الموسمية، والورقيات الخضراء',
    '[
      {"id": "fresh_veg", "nameAr": "خضار طازج", "items": ["طماطم سلطة طازجة (٢ كجم)", "خيار بلدي (١.٥ كجم)", "بطاطس للطبخ والقلي (٣ كجم)", "بصل أحمر (٢ كجم)", "ثوم طازج", "جزر بلدي", "فلفل رومي ألوان", "باذنجان رومي وعروس", "كوسة خضراء", "ليمون بلدي (نصف كجم)"]},
      {"id": "fruits", "nameAr": "فواكه موسمية", "items": ["موز بلدي فاخر", "تفاح سكري أحمر", "برتقال عصير وبصرة", "جوافة بلدي", "رمان سكري", "عنب بناتي"]},
      {"id": "herbs_greens", "nameAr": "ورقيات وأعشاب", "items": ["خس كابوتشا بلدي", "جرجير طازج (٣ حزم)", "بقدونس وشبت وكزبرة", "نعناع بلدي أخضر"]}
    ]'::jsonb,
    2
  ),
  (
    'meat_poultry',
    'لحوم ودواجن وأسماك',
    'Meat, Poultry & Fish',
    'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=800&q=80',
    'Beef',
    'rose',
    'bg-rose-50 text-rose-800 border-rose-200',
    'bg-rose-100 text-rose-800',
    'اللحوم البلدية، الدواجن الطازجة، والأسماك والمأكولات البحرية',
    '[
      {"id": "fresh_meat", "nameAr": "لحوم بلدية طازجة", "items": ["لحم بقري مفروم (١ كجم)", "مكعبات لحم كندوز (١ كجم)", "كبدة إسكندراني بلدي", "شاورما لحم متبلة", "سجق بلدي مخصوص"]},
      {"id": "poultry", "nameAr": "دواجن طازجة", "items": ["صدور دجاج بانيه (١ كجم)", "دجاجة كاملة منظفة (١.٥ كجم)", "أوراك دجاج مخلية", "شيش طاووق متبل", "كبد وقوانص دجاج"]},
      {"id": "seafood", "nameAr": "مأكولات بحرية", "items": ["سمك بلطي طازج (منظف)", "سمك بوري سنجاري", "جمبري بحري وسط", "فيليه قشر بياض"]}
    ]'::jsonb,
    3
  ),
  (
    'spices',
    'عطارة وتوابل ومكسرات',
    'Spices, Herbs & Nuts',
    'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    'Sparkles',
    'orange',
    'bg-orange-50 text-orange-800 border-orange-200',
    'bg-orange-100 text-orange-800',
    'التوابل الأساسية، بهارات الطبخ الخاصة، والمكسرات والياميش',
    '[
      {"id": "basic_spices", "nameAr": "توابل أساسية", "items": ["كمون حصى ومطحون", "كزبرة ناشفة مطحونة", "فلفل أسود حصى ومطحون", "كركم أصفر ناعم", "بابريكا مدخنة وحلوة", "شطة حارة ناعمة", "حبهان (هيل) مطحون وحصى", "قرفة خشب ومطحونة", "ورق لورا (غار)"]},
      {"id": "special_blends", "nameAr": "بهارات خاصة", "items": ["بهارات لحمة مشكلة (السبع بهارات)", "بهارات كبسة ومكبوس", "خلطة حواوشي ممتازة", "بهارات شاورما وفراخ", "ثوم بودرة وبصل بودرة"]},
      {"id": "nuts", "nameAr": "مكسرات وياميش", "items": ["سوداني محمص ومملح", "لوز وعين جمل نيء", "زبيب مصري وإيراني", "سمسم أبيض ومحمص"]}
    ]'::jsonb,
    4
  ),
  (
    'home_essentials',
    'مستلزمات البيت والمطبخ',
    'Home & Kitchen Essentials',
    'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=800&q=80',
    'Home',
    'sky',
    'bg-sky-50 text-sky-800 border-sky-200',
    'bg-sky-100 text-sky-800',
    'المناديل الورقية، أكياس القمامة، مستلزمات الحفظ، وأدوات المطبخ',
    '[
      {"id": "paper_tissue", "nameAr": "ورقيات ومناديل", "items": ["مناديل مطبخ رول كبير", "مناديل جيب وعلب صالون", "مناديل تواليت رول مضغوط"]},
      {"id": "wrapping_bags", "nameAr": "أكياس وتغليف", "items": ["أكياس قمامة مقاس ٧٠", "أكياس ثلاجة لحفظ الخضار", "ورق ألومنيوم فويل", "ورق زبدة للخبز", "بلاستيك رول استريتش"]},
      {"id": "consumables", "nameAr": "مستهلكات منزلية", "items": ["إسفنج وسلك مواعين", "أكياس حفظ أطعمة بسحاب", "شموع إنارة وكبريت"]}
    ]'::jsonb,
    5
  ),
  (
    'cleaning',
    'منظفات وعناية بالمنزل',
    'Cleaning & Home Care',
    'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=800&q=80',
    'Sparkle',
    'purple',
    'bg-purple-50 text-purple-800 border-purple-200',
    'bg-purple-100 text-purple-800',
    'مساحيق الغسيل، سوائل الأطباق، مطهرات الأرضيات، ومعطرات الجو',
    '[
      {"id": "laundry", "nameAr": "غسيل الملابس", "items": ["مسحوق غسيل أوتوماتيك (٣ كجم)", "كلور أبيض وكلور ألوان", "منعم ومعطر أقمشة ملابس"]},
      {"id": "dish_kitchen", "nameAr": "المطبخ والأواني", "items": ["سائل غسيل صحون بالليمون", "مذيب دهون وشحوم للبوتاجاز"]},
      {"id": "disinfection_floor", "nameAr": "تطهير وأرضيات", "items": ["مطهر أرضيات برائحة الصنوبر", "منظف زجاج ومرايا ملمع", "معطر جو بخاخ للمنزل"]}
    ]'::jsonb,
    6
  )
ON CONFLICT (id) DO NOTHING;

-- 10.3 Seed Global Products from categories
INSERT INTO public.global_products (id, global_category_id, subcategory_id, name_ar, default_quantity, default_unit, sort_order)
VALUES
  -- Supermarket
  ('gp-sm-1', 'supermarket', 'dairy', 'لبن بلدي طازج', '١', 'لتر', 1),
  ('gp-sm-2', 'supermarket', 'dairy', 'جبنة تلاجة', 'نصف كجم', 'كجم', 2),
  ('gp-sm-3', 'supermarket', 'dairy', 'جبنة براميلي', 'نصف كجم', 'كجم', 3),
  ('gp-sm-4', 'supermarket', 'dairy', 'جبنة فيتا بيضاء', '١', 'علبة', 4),
  ('gp-sm-5', 'supermarket', 'dairy', 'لبنة بلدية', '١', 'علبة', 5),
  ('gp-sm-6', 'supermarket', 'dairy', 'زبادي سادة', '٦', 'علب', 6),
  ('gp-sm-7', 'supermarket', 'dairy', 'قشطة بلدي', '١', 'علبة', 7),
  ('gp-sm-8', 'supermarket', 'dairy', 'زبدة غير مملحة', '١', 'قالب', 8),
  ('gp-sm-9', 'supermarket', 'dairy', 'بيض طازج (طبق ٣٠ بيضة)', '١', 'طبق', 9),
  ('gp-sm-10', 'supermarket', 'legumes', 'عدس أصفر', '١', 'كجم', 10),
  ('gp-sm-11', 'supermarket', 'legumes', 'عدس بجبة', '١', 'كجم', 11),
  ('gp-sm-12', 'supermarket', 'legumes', 'فاصوليا بيضاء', '١', 'كجم', 12),
  ('gp-sm-13', 'supermarket', 'legumes', 'فول تدميس بلدي', '١', 'كجم', 13),
  ('gp-sm-14', 'supermarket', 'legumes', 'حمص الشام', '١', 'كجم', 14),
  ('gp-sm-15', 'supermarket', 'legumes', 'لوبيا جافة', '١', 'كجم', 15),
  ('gp-sm-16', 'supermarket', 'legumes', 'أرز بسمتي فاخر (٥ كجم)', '١', 'شيكارة', 16),
  ('gp-sm-17', 'supermarket', 'legumes', 'أرز مصري درجة أولى', '٥', 'كجم', 17),
  ('gp-sm-18', 'supermarket', 'legumes', 'مكرونة متنوعة', '٤', 'أكياس', 18),
  ('gp-sm-19', 'supermarket', 'oils_sugars', 'زيت دوار الشمس (١.٥ لتر)', '١', 'زجاجة', 19),
  ('gp-sm-20', 'supermarket', 'oils_sugars', 'زيت زيتون بكر ممتاز', '١', 'زجاجة', 20),
  ('gp-sm-21', 'supermarket', 'oils_sugars', 'سمن بلدي طبيعي', '١', 'برطمان', 21),
  ('gp-sm-22', 'supermarket', 'oils_sugars', 'سكر أبيض (٥ كجم)', '١', 'كيس', 22),
  ('gp-sm-23', 'supermarket', 'canned_beverages', 'شاي أحمر فاخر', '١', 'باكت', 23),
  ('gp-sm-24', 'supermarket', 'canned_beverages', 'قهوة عربية مطحونة', '١', 'كيس', 24),
  ('gp-sm-25', 'supermarket', 'canned_beverages', 'معجون طماطم معلب', '٣', 'علب', 25),
  ('gp-sm-26', 'supermarket', 'canned_beverages', 'تونة في الزيت', '٣', 'علب', 26),

  -- Vegetables & Fruits
  ('gp-vf-1', 'vegetables_fruits', 'fresh_veg', 'طماطم سلطة طازجة (٢ كجم)', '٢', 'كجم', 1),
  ('gp-vf-2', 'vegetables_fruits', 'fresh_veg', 'خيار بلدي (١.٥ كجم)', '١.٥', 'كجم', 2),
  ('gp-vf-3', 'vegetables_fruits', 'fresh_veg', 'بطاطس للطبخ والقلي (٣ كجم)', '٣', 'كجم', 3),
  ('gp-vf-4', 'vegetables_fruits', 'fresh_veg', 'بصل أحمر (٢ كجم)', '٢', 'كجم', 4),
  ('gp-vf-5', 'vegetables_fruits', 'fresh_veg', 'ثوم طازج', 'نصف كجم', 'كجم', 5),
  ('gp-vf-6', 'vegetables_fruits', 'fresh_veg', 'جزر بلدي', '١', 'كجم', 6),
  ('gp-vf-7', 'vegetables_fruits', 'fresh_veg', 'فلفل رومي ألوان', '١', 'كجم', 7),
  ('gp-vf-8', 'vegetables_fruits', 'fresh_veg', 'باذنجان رومي وعروس', '١', 'كجم', 8),
  ('gp-vf-9', 'vegetables_fruits', 'fresh_veg', 'كوسة خضراء', '١', 'كجم', 9),
  ('gp-vf-10', 'vegetables_fruits', 'fresh_veg', 'ليمون بلدي (نصف كجم)', 'نصف كجم', 'كجم', 10),
  ('gp-vf-11', 'vegetables_fruits', 'fruits', 'موز بلدي فاخر', '٢', 'كجم', 11),
  ('gp-vf-12', 'vegetables_fruits', 'fruits', 'تفاح سكري أحمر', '١.٥', 'كجم', 12),
  ('gp-vf-13', 'vegetables_fruits', 'fruits', 'برتقال عصير وبصرة', '٢', 'كجم', 13),
  ('gp-vf-14', 'vegetables_fruits', 'fruits', 'جوافة بلدي', '١.٥', 'كجم', 14),
  ('gp-vf-15', 'vegetables_fruits', 'fruits', 'رمان سكري', '٢', 'كجم', 15),
  ('gp-vf-16', 'vegetables_fruits', 'fruits', 'عنب بناتي', '١', 'كجم', 16),
  ('gp-vf-17', 'vegetables_fruits', 'herbs_greens', 'خس كابوتشا بلدي', '٢', 'حبة', 17),
  ('gp-vf-18', 'vegetables_fruits', 'herbs_greens', 'جرجير طازج (٣ حزم)', '٣', 'حزم', 18),
  ('gp-vf-19', 'vegetables_fruits', 'herbs_greens', 'بقدونس وشبت وكزبرة', '٣', 'حزم', 19),
  ('gp-vf-20', 'vegetables_fruits', 'herbs_greens', 'نعناع بلدي أخضر', '٢', 'حزمة', 20),

  -- Meat & Poultry
  ('gp-mp-1', 'meat_poultry', 'fresh_meat', 'لحم بقري مفروم (١ كجم)', '١', 'كجم', 1),
  ('gp-mp-2', 'meat_poultry', 'fresh_meat', 'مكعبات لحم كندوز (١ كجم)', '١', 'كجم', 2),
  ('gp-mp-3', 'meat_poultry', 'fresh_meat', 'كبدة إسكندراني بلدي', '١', 'كجم', 3),
  ('gp-mp-4', 'meat_poultry', 'fresh_meat', 'شاورما لحم متبلة', '١', 'كجم', 4),
  ('gp-mp-5', 'meat_poultry', 'fresh_meat', 'سجق بلدي مخصوص', '١', 'كجم', 5),
  ('gp-mp-6', 'meat_poultry', 'poultry', 'صدور دجاج بانيه (١ كجم)', '١', 'كجم', 6),
  ('gp-mp-7', 'meat_poultry', 'poultry', 'دجاجة كاملة منظفة (١.٥ كجم)', '١', 'دجاجة', 7),
  ('gp-mp-8', 'meat_poultry', 'poultry', 'أوراك دجاج مخلية', '١', 'كجم', 8),
  ('gp-mp-9', 'meat_poultry', 'poultry', 'شيش طاووق متبل', '١', 'كجم', 9),
  ('gp-mp-10', 'meat_poultry', 'poultry', 'كبد وقوانص دجاج', '١', 'كجم', 10),
  ('gp-mp-11', 'meat_poultry', 'seafood', 'سمك بلطي طازج (منظف)', '٢', 'كجم', 11),
  ('gp-mp-12', 'meat_poultry', 'seafood', 'سمك بوري سنجاري', '١.٥', 'كجم', 12),
  ('gp-mp-13', 'meat_poultry', 'seafood', 'جمبري بحري وسط', '١', 'كجم', 13),
  ('gp-mp-14', 'meat_poultry', 'seafood', 'فيليه قشر بياض', '١', 'كجم', 14),

  -- Spices
  ('gp-sp-1', 'spices', 'basic_spices', 'كمون حصى ومطحون', '١', 'برطمان', 1),
  ('gp-sp-2', 'spices', 'basic_spices', 'كزبرة ناشفة مطحونة', '١', 'برطمان', 2),
  ('gp-sp-3', 'spices', 'basic_spices', 'فلفل أسود حصى ومطحون', '١', 'برطمان', 3),
  ('gp-sp-4', 'spices', 'basic_spices', 'كركم أصفر ناعم', '١', 'برطمان', 4),
  ('gp-sp-5', 'spices', 'basic_spices', 'بابريكا مدخنة وحلوة', '١', 'برطمان', 5),
  ('gp-sp-6', 'spices', 'basic_spices', 'شطة حارة ناعمة', '١', 'برطمان', 6),
  ('gp-sp-7', 'spices', 'basic_spices', 'حبهان (هيل) مطحون وحصى', '١', 'عبوة', 7),
  ('gp-sp-8', 'spices', 'basic_spices', 'قرفة خشب ومطحونة', '١', 'عبوة', 8),
  ('gp-sp-9', 'spices', 'basic_spices', 'ورق لورا (غار)', '١', 'كيس', 9),
  ('gp-sp-10', 'spices', 'special_blends', 'بهارات لحمة مشكلة (السبع بهارات)', '١', 'برطمان', 10),
  ('gp-sp-11', 'spices', 'special_blends', 'بهارات كبسة ومكبوس', '١', 'برطمان', 11),
  ('gp-sp-12', 'spices', 'special_blends', 'خلطة حواوشي ممتازة', '١', 'كيس', 12),
  ('gp-sp-13', 'spices', 'special_blends', 'بهارات شاورما وفراخ', '١', 'برطمان', 13),
  ('gp-sp-14', 'spices', 'special_blends', 'ثوم بودرة وبصل بودرة', '١', 'برطمان', 14),
  ('gp-sp-15', 'spices', 'nuts', 'سوداني محمص ومملح', 'نصف كجم', 'كجم', 15),
  ('gp-sp-16', 'spices', 'nuts', 'لوز وعين جمل نيء', 'ربع كجم', 'كجم', 16),
  ('gp-sp-17', 'spices', 'nuts', 'زبيب مصري وإيراني', 'ربع كجم', 'كجم', 17),
  ('gp-sp-18', 'spices', 'nuts', 'سمسم أبيض ومحمص', 'ربع كجم', 'كجم', 18),

  -- Home Essentials
  ('gp-he-1', 'home_essentials', 'paper_tissue', 'مناديل مطبخ رول كبير', '٢', 'رول', 1),
  ('gp-he-2', 'home_essentials', 'paper_tissue', 'مناديل جيب وعلب صالون', '٣', 'علب', 2),
  ('gp-he-3', 'home_essentials', 'paper_tissue', 'مناديل تواليت رول مضغوط', '١', 'باكت', 3),
  ('gp-he-4', 'home_essentials', 'wrapping_bags', 'أكياس قمامة مقاس ٧٠', '٢', 'رول', 4),
  ('gp-he-5', 'home_essentials', 'wrapping_bags', 'أكياس ثلاجة لحفظ الخضار', '٣', 'رول', 5),
  ('gp-he-6', 'home_essentials', 'wrapping_bags', 'ورق ألومنيوم فويل', '١', 'رول', 6),
  ('gp-he-7', 'home_essentials', 'wrapping_bags', 'ورق زبدة للخبز', '١', 'رول', 7),
  ('gp-he-8', 'home_essentials', 'wrapping_bags', 'بلاستيك رول استريتش', '١', 'رول', 8),
  ('gp-he-9', 'home_essentials', 'consumables', 'إسفنج وسلك مواعين', '١', 'باكت', 9),
  ('gp-he-10', 'home_essentials', 'consumables', 'أكياس حفظ أطعمة بسحاب', '١', 'علبة', 10),
  ('gp-he-11', 'home_essentials', 'consumables', 'شموع إنارة وكبريت', '١', 'علبة', 11),

  -- Cleaning
  ('gp-cl-1', 'cleaning', 'laundry', 'مسحوق غسيل أوتوماتيك (٣ كجم)', '١', 'كيس', 1),
  ('gp-cl-2', 'cleaning', 'laundry', 'كلور أبيض وكلور ألوان', '٢', 'زجاجة', 2),
  ('gp-cl-3', 'cleaning', 'laundry', 'منعم ومعطر أقمشة ملابس', '١', 'زجاجة', 3),
  ('gp-cl-4', 'cleaning', 'dish_kitchen', 'سائل غسيل صحون بالليمون', '١', 'زجاجة', 4),
  ('gp-cl-5', 'cleaning', 'dish_kitchen', 'مذيب دهون وشحوم للبوتاجاز', '١', 'بخاخ', 5),
  ('gp-cl-6', 'cleaning', 'disinfection_floor', 'مطهر أرضيات برائحة الصنوبر', '١', 'جركن', 6),
  ('gp-cl-7', 'cleaning', 'disinfection_floor', 'منظف زجاج ومرايا ملمع', '١', 'بخاخ', 7),
  ('gp-cl-8', 'cleaning', 'disinfection_floor', 'معطر جو بخاخ للمنزل', '١', 'بخاخ', 8)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 11. SAFE MIGRATION OF EXISTING HOUSEHOLDS
-- Copy all global products to existing households in household_products table
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  v_hh RECORD;
BEGIN
  FOR v_hh IN SELECT id FROM public.households LOOP
    -- Call seed function for each existing household
    PERFORM public.seed_household_catalog(v_hh.id);
  END LOOP;
END;
$$;
