-- supabase/migrations/20260413000000_ocr_jobs_category_created_by.sql
ALTER TABLE ocr_jobs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS category   text NOT NULL DEFAULT 'prescription';
