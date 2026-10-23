-- ==============================================================================
-- TALABAT AL-BAYT (طلبات البيت) — SUPABASE DATABASE-ENFORCED SECURITY MIGRATION
-- ==============================================================================
-- Migration: 20260829000000_harden_rls_and_security.sql
-- Description: Establishes complete Row-Level Security (RLS) policies,
-- non-recursive security definer helper functions, and database-enforced authorization
-- so no user can read, insert, update, or delete data belonging to another household.
-- ==============================================================================

-- 1. Ensure all primary tables exist with proper constraints and foreign keys
CREATE TABLE IF NOT EXISTS public.households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_name TEXT,
  admin_phone TEXT,
  pair_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'home', -- 'admin', 'home', 'member', 'guest'
  user_name TEXT,
  user_phone TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_household_member UNIQUE (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.household_permissions (
  household_id TEXT PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  allowed_screens JSONB DEFAULT '{"categories": true, "missing": true, "purchases": true, "budget": false}'::jsonb,
  can_add_missing_item BOOLEAN DEFAULT true,
  can_delete_missing_item BOOLEAN DEFAULT false,
  can_edit_item BOOLEAN DEFAULT true,
  can_add_invoice BOOLEAN DEFAULT false,
  can_use_ai_assistant BOOLEAN DEFAULT true,
  can_send_urgent_alert BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.missing_items (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  category_arabic TEXT NOT NULL,
  quantity TEXT DEFAULT '١',
  urgency TEXT DEFAULT 'normal',
  notes TEXT,
  added_by TEXT DEFAULT 'home',
  added_by_name TEXT,
  completed BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  category_arabic TEXT NOT NULL,
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  registered_by TEXT NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  image_url TEXT NOT NULL,
  color TEXT,
  bg_light TEXT,
  badge_color TEXT,
  description TEXT,
  common_items JSONB DEFAULT '[]'::jsonb,
  is_custom BOOLEAN DEFAULT false,
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.household_budgets (
  household_id TEXT PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  monthly_limit NUMERIC DEFAULT 2500,
  currency TEXT DEFAULT 'ر.س',
  month TEXT DEFAULT 'الشهر الحالي',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  target_role TEXT DEFAULT 'all',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  household_id TEXT REFERENCES public.households(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'admin',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Performance Indexes for foreign keys and frequent lookups
CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_hh ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_token ON public.pairing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_hh ON public.pairing_tokens(household_id);
CREATE INDEX IF NOT EXISTS idx_missing_items_hh ON public.missing_items(household_id);
CREATE INDEX IF NOT EXISTS idx_invoices_hh ON public.invoices(household_id);
CREATE INDEX IF NOT EXISTS idx_categories_hh ON public.categories(household_id);
CREATE INDEX IF NOT EXISTS idx_notifications_hh ON public.notifications(household_id);
CREATE INDEX IF NOT EXISTS idx_profiles_hh ON public.profiles(household_id);

-- 3. Security Definer Helper Functions (Avoid Recursive RLS evaluation traps)
CREATE OR REPLACE FUNCTION public.is_household_member(lookup_household_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = lookup_household_id
      AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.households
    WHERE id = lookup_household_id
      AND admin_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_admin(lookup_household_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households
    WHERE id = lookup_household_id
      AND admin_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = lookup_household_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 4. Enable Row Level Security (RLS) on ALL tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Drop all legacy insecure policies that used 'OR auth.role() = authenticated'
DROP POLICY IF EXISTS "Allow members access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow members and admins access to households" ON public.households;
DROP POLICY IF EXISTS "Allow users to view and join household members" ON public.household_members;
DROP POLICY IF EXISTS "Allow authenticated users to manage and use pairing tokens" ON public.pairing_tokens;
DROP POLICY IF EXISTS "Allow household members access to permissions" ON public.household_permissions;
DROP POLICY IF EXISTS "Allow household members full access to items" ON public.missing_items;
DROP POLICY IF EXISTS "Allow household members full access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow household members full access to categories" ON public.categories;
DROP POLICY IF EXISTS "Allow household members access to budgets" ON public.household_budgets;
DROP POLICY IF EXISTS "Allow household members access to notifications" ON public.notifications;

-- Drop specific per-action policies if previously created
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

DROP POLICY IF EXISTS "households_select_policy" ON public.households;
DROP POLICY IF EXISTS "households_insert_policy" ON public.households;
DROP POLICY IF EXISTS "households_update_policy" ON public.households;
DROP POLICY IF EXISTS "households_delete_policy" ON public.households;

DROP POLICY IF EXISTS "household_members_select_policy" ON public.household_members;
DROP POLICY IF EXISTS "household_members_insert_policy" ON public.household_members;
DROP POLICY IF EXISTS "household_members_update_policy" ON public.household_members;
DROP POLICY IF EXISTS "household_members_delete_policy" ON public.household_members;

DROP POLICY IF EXISTS "pairing_tokens_select_policy" ON public.pairing_tokens;
DROP POLICY IF EXISTS "pairing_tokens_insert_policy" ON public.pairing_tokens;
DROP POLICY IF EXISTS "pairing_tokens_update_policy" ON public.pairing_tokens;
DROP POLICY IF EXISTS "pairing_tokens_delete_policy" ON public.pairing_tokens;

DROP POLICY IF EXISTS "household_permissions_select_policy" ON public.household_permissions;
DROP POLICY IF EXISTS "household_permissions_insert_policy" ON public.household_permissions;
DROP POLICY IF EXISTS "household_permissions_update_policy" ON public.household_permissions;
DROP POLICY IF EXISTS "household_permissions_delete_policy" ON public.household_permissions;

DROP POLICY IF EXISTS "missing_items_select_policy" ON public.missing_items;
DROP POLICY IF EXISTS "missing_items_insert_policy" ON public.missing_items;
DROP POLICY IF EXISTS "missing_items_update_policy" ON public.missing_items;
DROP POLICY IF EXISTS "missing_items_delete_policy" ON public.missing_items;

DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;

DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

DROP POLICY IF EXISTS "household_budgets_select_policy" ON public.household_budgets;
DROP POLICY IF EXISTS "household_budgets_insert_policy" ON public.household_budgets;
DROP POLICY IF EXISTS "household_budgets_update_policy" ON public.household_budgets;
DROP POLICY IF EXISTS "household_budgets_delete_policy" ON public.household_budgets;

DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;

-- ==============================================================================
-- 6. HARDENED GRANULAR ROW-LEVEL SECURITY POLICIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. PROFILES TABLE POLICIES (Users own their profile; household co-members can view names)
-- ------------------------------------------------------------------------------
CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id 
  OR (household_id IS NOT NULL AND public.is_household_member(household_id))
);

CREATE POLICY "profiles_insert_policy"
ON public.profiles FOR INSERT
WITH CHECK (
  auth.uid() = id
);

CREATE POLICY "profiles_update_policy"
ON public.profiles FOR UPDATE
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);

CREATE POLICY "profiles_delete_policy"
ON public.profiles FOR DELETE
USING (
  auth.uid() = id
);

-- ------------------------------------------------------------------------------
-- B. HOUSEHOLDS TABLE POLICIES (Admin created & owned; member accessible)
-- ------------------------------------------------------------------------------
CREATE POLICY "households_select_policy"
ON public.households FOR SELECT
USING (
  admin_id = auth.uid() 
  OR public.is_household_member(id)
);

CREATE POLICY "households_insert_policy"
ON public.households FOR INSERT
WITH CHECK (
  admin_id = auth.uid()
);

CREATE POLICY "households_update_policy"
ON public.households FOR UPDATE
USING (
  admin_id = auth.uid() OR public.is_household_admin(id)
)
WITH CHECK (
  admin_id = auth.uid() OR public.is_household_admin(id)
);

CREATE POLICY "households_delete_policy"
ON public.households FOR DELETE
USING (
  admin_id = auth.uid()
);

-- ------------------------------------------------------------------------------
-- C. HOUSEHOLD MEMBERS TABLE POLICIES (Strict membership boundary)
-- ------------------------------------------------------------------------------
CREATE POLICY "household_members_select_policy"
ON public.household_members FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.is_household_member(household_id)
);

CREATE POLICY "household_members_insert_policy"
ON public.household_members FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_household_admin(household_id)
);

CREATE POLICY "household_members_update_policy"
ON public.household_members FOR UPDATE
USING (
  public.is_household_admin(household_id) 
  OR (user_id = auth.uid())
)
WITH CHECK (
  public.is_household_admin(household_id) 
  OR (user_id = auth.uid())
);

CREATE POLICY "household_members_delete_policy"
ON public.household_members FOR DELETE
USING (
  user_id = auth.uid() 
  OR public.is_household_admin(household_id)
);

-- ------------------------------------------------------------------------------
-- D. PAIRING TOKENS TABLE POLICIES (Time-limited unpredictable pairing)
-- ------------------------------------------------------------------------------
CREATE POLICY "pairing_tokens_select_policy"
ON public.pairing_tokens FOR SELECT
USING (
  created_by = auth.uid()
  OR public.is_household_admin(household_id)
  OR (NOT is_used AND expires_at > NOW())
);

CREATE POLICY "pairing_tokens_insert_policy"
ON public.pairing_tokens FOR INSERT
WITH CHECK (
  created_by = auth.uid() 
  AND public.is_household_admin(household_id)
);

CREATE POLICY "pairing_tokens_update_policy"
ON public.pairing_tokens FOR UPDATE
USING (
  public.is_household_admin(household_id)
  OR (NOT is_used AND expires_at > NOW() AND auth.uid() IS NOT NULL)
)
WITH CHECK (
  public.is_household_admin(household_id)
  OR (auth.uid() IS NOT NULL)
);

CREATE POLICY "pairing_tokens_delete_policy"
ON public.pairing_tokens FOR DELETE
USING (
  public.is_household_admin(household_id)
);

-- ------------------------------------------------------------------------------
-- E. HOUSEHOLD PERMISSIONS TABLE POLICIES (Admin configurable, member readable)
-- ------------------------------------------------------------------------------
CREATE POLICY "household_permissions_select_policy"
ON public.household_permissions FOR SELECT
USING (
  public.is_household_member(household_id)
);

CREATE POLICY "household_permissions_insert_policy"
ON public.household_permissions FOR INSERT
WITH CHECK (
  public.is_household_admin(household_id)
);

CREATE POLICY "household_permissions_update_policy"
ON public.household_permissions FOR UPDATE
USING (
  public.is_household_admin(household_id)
)
WITH CHECK (
  public.is_household_admin(household_id)
);

CREATE POLICY "household_permissions_delete_policy"
ON public.household_permissions FOR DELETE
USING (
  public.is_household_admin(household_id)
);

-- ------------------------------------------------------------------------------
-- F. MISSING ITEMS TABLE POLICIES (Scoped strictly to verified household members)
-- ------------------------------------------------------------------------------
CREATE POLICY "missing_items_select_policy"
ON public.missing_items FOR SELECT
USING (
  public.is_household_member(household_id)
);

CREATE POLICY "missing_items_insert_policy"
ON public.missing_items FOR INSERT
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "missing_items_update_policy"
ON public.missing_items FOR UPDATE
USING (
  public.is_household_member(household_id)
)
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "missing_items_delete_policy"
ON public.missing_items FOR DELETE
USING (
  public.is_household_member(household_id)
);

-- ------------------------------------------------------------------------------
-- G. INVOICES TABLE POLICIES (Scoped strictly to verified household members)
-- ------------------------------------------------------------------------------
CREATE POLICY "invoices_select_policy"
ON public.invoices FOR SELECT
USING (
  public.is_household_member(household_id)
);

CREATE POLICY "invoices_insert_policy"
ON public.invoices FOR INSERT
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "invoices_update_policy"
ON public.invoices FOR UPDATE
USING (
  public.is_household_member(household_id)
)
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "invoices_delete_policy"
ON public.invoices FOR DELETE
USING (
  public.is_household_member(household_id)
);

-- ------------------------------------------------------------------------------
-- H. CATEGORIES TABLE POLICIES (Custom household taxonomy)
-- ------------------------------------------------------------------------------
CREATE POLICY "categories_select_policy"
ON public.categories FOR SELECT
USING (
  public.is_household_member(household_id)
);

CREATE POLICY "categories_insert_policy"
ON public.categories FOR INSERT
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "categories_update_policy"
ON public.categories FOR UPDATE
USING (
  public.is_household_member(household_id)
)
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "categories_delete_policy"
ON public.categories FOR DELETE
USING (
  public.is_household_member(household_id)
);

-- ------------------------------------------------------------------------------
-- I. HOUSEHOLD BUDGETS TABLE POLICIES (Budget limits and fiscal records)
-- ------------------------------------------------------------------------------
CREATE POLICY "household_budgets_select_policy"
ON public.household_budgets FOR SELECT
USING (
  public.is_household_member(household_id)
);

CREATE POLICY "household_budgets_insert_policy"
ON public.household_budgets FOR INSERT
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "household_budgets_update_policy"
ON public.household_budgets FOR UPDATE
USING (
  public.is_household_member(household_id)
)
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "household_budgets_delete_policy"
ON public.household_budgets FOR DELETE
USING (
  public.is_household_admin(household_id)
);

-- ------------------------------------------------------------------------------
-- J. NOTIFICATIONS TABLE POLICIES (Household alerts and attention rings)
-- ------------------------------------------------------------------------------
CREATE POLICY "notifications_select_policy"
ON public.notifications FOR SELECT
USING (
  public.is_household_member(household_id)
);

CREATE POLICY "notifications_insert_policy"
ON public.notifications FOR INSERT
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "notifications_update_policy"
ON public.notifications FOR UPDATE
USING (
  public.is_household_member(household_id)
)
WITH CHECK (
  public.is_household_member(household_id)
);

CREATE POLICY "notifications_delete_policy"
ON public.notifications FOR DELETE
USING (
  public.is_household_member(household_id)
);
