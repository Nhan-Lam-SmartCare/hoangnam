-- Add warranty column for parts table (compatible with current app logic)
ALTER TABLE IF EXISTS public.parts
ADD COLUMN IF NOT EXISTS warranty TEXT;
