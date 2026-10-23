-- ==============================================================================
-- MIGRATION: 20261007000000_add_display_width_to_pharmacy_settings.sql
-- Description: Add central display_width column to public.pharmacy_settings
-- Allowed values: 'full' (Full Width) or 'half' (Half Width), default: 'full'
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pharmacy_settings'
      AND column_name = 'display_width'
  ) THEN
    ALTER TABLE public.pharmacy_settings
      ADD COLUMN display_width TEXT NOT NULL DEFAULT 'full';

    ALTER TABLE public.pharmacy_settings
      ADD CONSTRAINT pharmacy_settings_display_width_check
      CHECK (display_width IN ('full', 'half'));
  END IF;
END $$;
