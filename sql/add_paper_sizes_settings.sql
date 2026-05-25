ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS print_paper_size_receipt TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS print_paper_size_warranty TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS print_paper_size_sales TEXT;
