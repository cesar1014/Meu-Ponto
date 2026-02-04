-- Migration: Add 'atestado' to ajustes.tipo constraint and pontos_dia UNIQUE
-- Run this in Supabase SQL Editor
-- Date: 2026-02-03

-- =============================================
-- PART 1: Fix ajustes.tipo constraint
-- =============================================

-- Drop existing constraint (may have different name depending on schema)
-- Try common naming patterns
DO $$ 
BEGIN
  -- Try dropping by known constraint names
  ALTER TABLE ajustes DROP CONSTRAINT IF EXISTS ajustes_tipo_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Also try to drop any check constraint on tipo column
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  WHERE c.conrelid = 'ajustes'::regclass
    AND c.contype = 'c'
    AND a.attname = 'tipo';
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ajustes DROP CONSTRAINT %I', constraint_name);
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint with 'atestado' included
-- The app uses uppercase internally (ATESTADO), but we normalize to lowercase for storage
ALTER TABLE ajustes
ADD CONSTRAINT ajustes_tipo_check
CHECK (tipo IN ('pontos', 'horas', 'credito', 'debito', 'atestado'));

-- =============================================
-- PART 2: Add UNIQUE constraint on pontos_dia
-- =============================================

-- This enables proper upsert behavior with onConflict: 'user_id,data'
ALTER TABLE pontos_dia 
DROP CONSTRAINT IF EXISTS pontos_dia_user_data_unique;

ALTER TABLE pontos_dia 
ADD CONSTRAINT pontos_dia_user_data_unique 
UNIQUE (user_id, data);

-- =============================================
-- PART 3: Create ajustes_local table for app sync
-- (if it doesn't exist - for storing app-side ajustes)
-- =============================================

-- Note: The existing 'ajustes' table schema from user:
-- ajustes(id uuid PK, user_id uuid, data_alvo date, tipo text, delta_minutos int, pontos_json jsonb, justificativa text NOT NULL)
-- 
-- The app uses a different schema locally:
-- AjusteBanco { id, atISO, tipo: 'CREDITO'|'DEBITO'|'ATESTADO', minutos, justificativa }
--
-- We need to ensure the remote table can store app-format ajustes
-- OR we need to transform data during sync

-- Add missing columns if they don't exist (for app-format storage)
DO $$
BEGIN
  -- Add at_iso column for app timestamp format
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ajustes' AND column_name = 'at_iso'
  ) THEN
    ALTER TABLE ajustes ADD COLUMN at_iso timestamptz;
  END IF;
  
  -- Make justificativa nullable (app allows undefined)
  ALTER TABLE ajustes ALTER COLUMN justificativa DROP NOT NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_column THEN NULL;
END $$;

-- =============================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================

-- Check ajustes constraint:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'ajustes'::regclass AND contype = 'c';

-- Check pontos_dia unique constraint:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint 
-- WHERE conrelid = 'pontos_dia'::regclass AND contype = 'u';
