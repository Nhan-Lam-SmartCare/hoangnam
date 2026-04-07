-- ============================================
-- FIX: Tạo bảng inventory_transactions (nếu chưa tồn tại)
-- và thêm RLS policy để cho phép truy vấn dữ liệu
-- ============================================

-- 1. Tạo bảng nếu chưa có
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'Nhập kho',
  "partId" TEXT,
  "partName" TEXT,
  quantity NUMERIC DEFAULT 0,
  date TIMESTAMPTZ DEFAULT NOW(),
  "unitPrice" NUMERIC DEFAULT 0,
  "totalPrice" NUMERIC DEFAULT 0,
  "branchId" TEXT DEFAULT 'CN1',
  notes TEXT,
  "saleId" TEXT,
  "workOrderId" TEXT,
  "supplierId" TEXT,
  "userId" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bật RLS
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Xóa policy cũ nếu có (tránh lỗi "policy already exists")
DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Allow all access" ON public.inventory_transactions;

-- 4. Tạo policy cho phép tất cả user truy cập
CREATE POLICY "Enable all access for all users" 
  ON public.inventory_transactions 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- 5. Kiểm tra
SELECT 
  'inventory_transactions table ready!' as status,
  (SELECT COUNT(*) FROM public.inventory_transactions) as total_rows;
