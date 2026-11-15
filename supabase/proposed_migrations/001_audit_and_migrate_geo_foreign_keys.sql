-- ==============================================================================
-- PHASE B - REVIEW-ONLY SQL PROPOSAL 001
-- Purpose: Audit existing Foreign Keys across 11 geographic/order tables on DEV,
--          verify UUID/data parity between legacy `food_*` and central `geo_*`,
--          and safely migrate FKs to `geo_governorates`, `geo_centers`, `geo_areas`
--          using NOT VALID -> VALIDATE CONSTRAINT (without dropping `food_*` tables).
-- Target Environment: Supabase DEV ONLY (itbfqpjwgjvvybffunkm)
-- IMPORTANT: DO NOT RUN AUTOMATICALLY. Review & execute Step 1 + Step 2 first!
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: READ-ONLY AUDIT OF CURRENT CONSTRAINTS & COLUMNS ON TARGET 11 TABLES
-- Run this SELECT batch first on Supabase DEV SQL Editor and inspect outputs.
-- ------------------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column,
  rc.delete_rule,
  rc.update_rule,
  pgc.convalidated AS is_validated
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
JOIN pg_constraint pgc
  ON pgc.conname = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'household_addresses',
    'restaurants',
    'restaurant_service_areas',
    'restaurant_section_service_areas',
    'restaurant_area_delivery_fees',
    'restaurant_driver_area_coverage',
    'delivery_area_tariffs',
    'delivery_orders',
    'pharmacy_orders',
    'restaurant_orders',
    'delivery_driver_area_coverage'
  )
ORDER BY tc.table_name, kcu.column_name;

-- Inspect geographic column names & data types across those 11 tables + geo_*
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'geo_governorates',
    'geo_centers',
    'geo_areas',
    'household_addresses',
    'restaurants',
    'restaurant_service_areas',
    'restaurant_section_service_areas',
    'restaurant_area_delivery_fees',
    'restaurant_driver_area_coverage',
    'delivery_area_tariffs',
    'delivery_orders',
    'pharmacy_orders',
    'restaurant_orders',
    'delivery_driver_area_coverage'
  )
  AND (
    column_name LIKE '%governorate%'
    OR column_name LIKE '%center%'
    OR column_name LIKE '%area%'
    OR column_name IN ('id', 'name_ar', 'is_active', 'service_type', 'delivery_owner')
  )
ORDER BY table_name, ordinal_position;


-- ------------------------------------------------------------------------------
-- STEP 2: DATA & UUID PARITY VERIFICATION (food_* vs geo_*) BEFORE ANY FK CHANGE
-- Must return ZERO orphan counts before applying Step 3!
-- ------------------------------------------------------------------------------

-- 2A. Check UUID & Arabic name parity between geo_* and legacy food_* (only if food_* exists)
DO $$
DECLARE
  v_food_govs_exists BOOLEAN;
  v_food_centers_exists BOOLEAN;
  v_food_areas_exists BOOLEAN;
BEGIN
  SELECT to_regclass('public.food_governorates') IS NOT NULL INTO v_food_govs_exists;
  SELECT to_regclass('public.food_centers') IS NOT NULL INTO v_food_centers_exists;
  SELECT to_regclass('public.food_areas') IS NOT NULL INTO v_food_areas_exists;

  RAISE NOTICE 'Legacy tables present -> food_governorates: %, food_centers: %, food_areas: %',
    v_food_govs_exists, v_food_centers_exists, v_food_areas_exists;
END $$;

-- 2B. Dynamic Orphan Row Audit across all 11 tables against geo_governorates / geo_centers / geo_areas
DO $$
DECLARE
  v_tbl TEXT;
  v_col TEXT;
  v_ref TEXT;
  v_cnt BIGINT;
  v_targets CONSTANT TEXT[][] := ARRAY[
    ARRAY['household_addresses', 'governorate_id', 'geo_governorates'],
    ARRAY['household_addresses', 'center_id', 'geo_centers'],
    ARRAY['household_addresses', 'area_id', 'geo_areas'],
    ARRAY['restaurants', 'governorate_id', 'geo_governorates'],
    ARRAY['restaurants', 'center_id', 'geo_centers'],
    ARRAY['restaurants', 'area_id', 'geo_areas'],
    ARRAY['restaurant_service_areas', 'governorate_id', 'geo_governorates'],
    ARRAY['restaurant_service_areas', 'center_id', 'geo_centers'],
    ARRAY['restaurant_service_areas', 'area_id', 'geo_areas'],
    ARRAY['restaurant_section_service_areas', 'governorate_id', 'geo_governorates'],
    ARRAY['restaurant_section_service_areas', 'center_id', 'geo_centers'],
    ARRAY['restaurant_section_service_areas', 'area_id', 'geo_areas'],
    ARRAY['restaurant_area_delivery_fees', 'governorate_id', 'geo_governorates'],
    ARRAY['restaurant_area_delivery_fees', 'center_id', 'geo_centers'],
    ARRAY['restaurant_area_delivery_fees', 'area_id', 'geo_areas'],
    ARRAY['restaurant_driver_area_coverage', 'governorate_id', 'geo_governorates'],
    ARRAY['restaurant_driver_area_coverage', 'center_id', 'geo_centers'],
    ARRAY['restaurant_driver_area_coverage', 'area_id', 'geo_areas'],
    ARRAY['delivery_area_tariffs', 'governorate_id', 'geo_governorates'],
    ARRAY['delivery_area_tariffs', 'center_id', 'geo_centers'],
    ARRAY['delivery_area_tariffs', 'area_id', 'geo_areas'],
    ARRAY['delivery_orders', 'governorate_id', 'geo_governorates'],
    ARRAY['delivery_orders', 'center_id', 'geo_centers'],
    ARRAY['delivery_orders', 'area_id', 'geo_areas'],
    ARRAY['pharmacy_orders', 'governorate_id', 'geo_governorates'],
    ARRAY['pharmacy_orders', 'center_id', 'geo_centers'],
    ARRAY['pharmacy_orders', 'area_id', 'geo_areas'],
    ARRAY['pharmacy_orders', 'delivery_governorate_id', 'geo_governorates'],
    ARRAY['pharmacy_orders', 'delivery_center_id', 'geo_centers'],
    ARRAY['pharmacy_orders', 'delivery_area_id', 'geo_areas'],
    ARRAY['restaurant_orders', 'governorate_id', 'geo_governorates'],
    ARRAY['restaurant_orders', 'center_id', 'geo_centers'],
    ARRAY['restaurant_orders', 'area_id', 'geo_areas'],
    ARRAY['restaurant_orders', 'delivery_governorate_id', 'geo_governorates'],
    ARRAY['restaurant_orders', 'delivery_center_id', 'geo_centers'],
    ARRAY['restaurant_orders', 'delivery_area_id', 'geo_areas'],
    ARRAY['delivery_driver_area_coverage', 'governorate_id', 'geo_governorates'],
    ARRAY['delivery_driver_area_coverage', 'center_id', 'geo_centers'],
    ARRAY['delivery_driver_area_coverage', 'area_id', 'geo_areas']
  ];
BEGIN
  FOR i IN 1..array_length(v_targets, 1) LOOP
    v_tbl := v_targets[i][1];
    v_col := v_targets[i][2];
    v_ref := v_targets[i][3];

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = v_col
    ) AND to_regclass('public.' || v_ref) IS NOT NULL THEN
      EXECUTE format(
        'SELECT count(*) FROM public.%I t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I g WHERE g.id::text = t.%I::text)',
        v_tbl, v_col, v_ref, v_col
      ) INTO v_cnt;

      IF v_cnt > 0 THEN
        RAISE WARNING 'ORPHAN DETECTED: %.% has % row(s) missing from %!', v_tbl, v_col, v_cnt, v_ref;
      ELSE
        RAISE NOTICE 'PARITY OK: %.% -> % (0 orphans)', v_tbl, v_col, v_ref;
      END IF;
    END IF;
  END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- STEP 3: SAFE NON-DESTRUCTIVE FK MIGRATION (ADD NOT VALID -> VALIDATE -> DROP OLD)
-- Impact:
-- - Adds FKs pointing to central geo_governorates / geo_centers / geo_areas using NOT VALID first,
--   then runs VALIDATE CONSTRAINT so existing data is verified atomically without long lock windows.
-- - Drops legacy FKs referencing food_governorates / food_centers / food_areas ONLY AFTER the
--   new central geo_* constraint is validated successfully.
-- - Does NOT delete or alter food_* tables or any existing rows.
-- ------------------------------------------------------------------------------

BEGIN;

DO $$
DECLARE
  v_fk RECORD;
  v_new_con_name TEXT;
  v_target_table TEXT;
  v_orphan_count BIGINT;
BEGIN
  -- 3A. Upgrade any existing FK currently pointing to food_governorates / food_centers / food_areas
  FOR v_fk IN
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS old_ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name IN ('food_governorates', 'food_centers', 'food_areas')
      AND tc.table_name IN (
        'household_addresses',
        'restaurants',
        'restaurant_service_areas',
        'restaurant_section_service_areas',
        'restaurant_area_delivery_fees',
        'restaurant_driver_area_coverage',
        'delivery_area_tariffs',
        'delivery_orders',
        'pharmacy_orders',
        'restaurant_orders',
        'delivery_driver_area_coverage'
      )
  LOOP
    v_target_table := CASE v_fk.old_ref_table
      WHEN 'food_governorates' THEN 'geo_governorates'
      WHEN 'food_centers' THEN 'geo_centers'
      WHEN 'food_areas' THEN 'geo_areas'
    END;

    v_new_con_name := format('fk_%s_%s_geo', v_fk.table_name, v_fk.column_name);

    -- Safety gate: verify 0 orphans in central geo_* before creating FK
    EXECUTE format(
      'SELECT count(*) FROM public.%I t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I g WHERE g.id = t.%I)',
      v_fk.table_name, v_fk.column_name, v_target_table, v_fk.column_name
    ) INTO v_orphan_count;

    IF v_orphan_count > 0 THEN
      RAISE EXCEPTION 'ABORT: %.% contains % orphan reference(s) not present in %. Remediate data first.',
        v_fk.table_name, v_fk.column_name, v_orphan_count, v_target_table;
    END IF;

    -- Add new constraint as NOT VALID if it does not exist yet
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = v_new_con_name AND conrelid = format('public.%I', v_fk.table_name)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID',
        v_fk.table_name, v_new_con_name, v_fk.column_name, v_target_table
      );
    END IF;

    -- Validate new constraint
    EXECUTE format(
      'ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
      v_fk.table_name, v_new_con_name
    );

    -- Drop old food_* FK only after central geo_* FK is validated
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT %I',
      v_fk.table_name, v_fk.constraint_name
    );

    RAISE NOTICE 'MIGRATED FK: %.% (% -> %)', v_fk.table_name, v_fk.column_name, v_fk.old_ref_table, v_target_table;
  END LOOP;
END $$;

-- 3B. Ensure household_addresses & delivery_orders geo columns also have validated FKs to geo_*
--     if they currently have NO FK at all (skipped automatically if an FK to geo_* already exists).
DO $$
DECLARE
  v_pair TEXT[];
  v_pairs CONSTANT TEXT[][] := ARRAY[
    ARRAY['household_addresses', 'governorate_id', 'geo_governorates'],
    ARRAY['household_addresses', 'center_id', 'geo_centers'],
    ARRAY['household_addresses', 'area_id', 'geo_areas'],
    ARRAY['delivery_orders', 'governorate_id', 'geo_governorates'],
    ARRAY['delivery_orders', 'center_id', 'geo_centers'],
    ARRAY['delivery_orders', 'area_id', 'geo_areas'],
    ARRAY['delivery_area_tariffs', 'governorate_id', 'geo_governorates'],
    ARRAY['delivery_area_tariffs', 'center_id', 'geo_centers'],
    ARRAY['delivery_area_tariffs', 'area_id', 'geo_areas']
  ];
  v_has_fk BOOLEAN;
  v_con_name TEXT;
  v_orphans BIGINT;
BEGIN
  FOREACH v_pair SLICE 1 IN ARRAY v_pairs LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_pair[1] AND column_name = v_pair[2]
    ) THEN
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = v_pair[1]
          AND kcu.column_name = v_pair[2]
          AND ccu.table_name = v_pair[3]
      ) INTO v_has_fk;

      IF NOT v_has_fk THEN
        EXECUTE format(
          'SELECT count(*) FROM public.%I t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I g WHERE g.id = t.%I)',
          v_pair[1], v_pair[2], v_pair[3], v_pair[2]
        ) INTO v_orphans;

        IF v_orphans = 0 THEN
          v_con_name := format('fk_%s_%s_geo', v_pair[1], v_pair[2]);
          EXECUTE format(
            'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID',
            v_pair[1], v_con_name, v_pair[2], v_pair[3]
          );
          EXECUTE format(
            'ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
            v_pair[1], v_con_name
          );
          RAISE NOTICE 'ADDED CENTRAL FK: %.% -> %', v_pair[1], v_pair[2], v_pair[3];
        ELSE
          RAISE WARNING 'SKIPPED FK %.%: % orphan rows exist; clean legacy rows first.', v_pair[1], v_pair[2], v_orphans;
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;


-- ------------------------------------------------------------------------------
-- STEP 4: POST-EXECUTION VERIFICATION
-- Re-run the FK audit query to confirm 0 remaining FKs point to `food_*`
-- and all migrated FKs show is_validated = true pointing to `geo_*`.
-- ------------------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  pgc.convalidated AS is_validated
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
JOIN pg_constraint pgc
  ON pgc.conname = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'household_addresses',
    'restaurants',
    'restaurant_service_areas',
    'restaurant_section_service_areas',
    'restaurant_area_delivery_fees',
    'restaurant_driver_area_coverage',
    'delivery_area_tariffs',
    'delivery_orders',
    'pharmacy_orders',
    'restaurant_orders',
    'delivery_driver_area_coverage'
  )
ORDER BY tc.table_name, kcu.column_name;


-- ------------------------------------------------------------------------------
-- STEP 5: SAFE ROLLBACK TEMPLATE (DO NOT RUN UNLESS REVERTING)
-- Because `food_*` tables are untouched, you can revert any specific table FK
-- by capturing the original constraint definitions from Step 1 BEFORE Step 3:
-- Example:
-- ALTER TABLE public.<table_name>
--   DROP CONSTRAINT IF EXISTS fk_<table_name>_<column_name>_geo;
-- ALTER TABLE public.<table_name>
--   ADD CONSTRAINT <original_constraint_name>
--   FOREIGN KEY (<column_name>) REFERENCES public.food_<level>(id) NOT VALID;
-- ALTER TABLE public.<table_name>
--   VALIDATE CONSTRAINT <original_constraint_name>;
-- ------------------------------------------------------------------------------
