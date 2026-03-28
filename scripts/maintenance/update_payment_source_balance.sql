-- Script cập nhật số dư quỹ thực tế
-- Mục tiêu cuối cùng:
-- Tiền mặt: 7,345,000 đ
-- Ngân hàng: 4,593,000 đ
-- Ngày: 03/12/2025
-- Branch ID: CN1

-- BƯỚC 1: Kiểm tra số dư ban đầu hiện tại
SELECT id, name, balance FROM payment_sources;

-- BƯỚC 2: Tính delta cần điều chỉnh
-- Hiện tại hiển thị: Tiền mặt = 5,788,000 | Ngân hàng = -1,174,000
-- Muốn hiển thị:     Tiền mặt = 7,345,000 | Ngân hàng = 4,593,000
-- Delta cần thêm:    Tiền mặt = +1,557,000 | Ngân hàng = +5,767,000

-- Lấy số dư ban đầu hiện tại
-- Giả sử ban đầu là 0, thì cần set:
-- cash_initial = 7,345,000 - (tổng giao dịch cash)
-- bank_initial = 4,593,000 - (tổng giao dịch bank)

-- CÁCH ĐƠN GIẢN: Điều chỉnh trực tiếp số dư ban đầu
-- Tăng số dư ban đầu tiền mặt thêm 1,557,000
UPDATE payment_sources 
SET balance = jsonb_set(
  COALESCE(balance, '{"CN1": 0}'::jsonb),
  '{CN1}',
  (COALESCE((balance->>'CN1')::numeric, 0) + 1557000)::text::jsonb
)
WHERE id = 'cash';

-- Tăng số dư ban đầu ngân hàng thêm 5,767,000
UPDATE payment_sources 
SET balance = jsonb_set(
  COALESCE(balance, '{"CN1": 0}'::jsonb),
  '{CN1}',
  (COALESCE((balance->>'CN1')::numeric, 0) + 5767000)::text::jsonb
)
WHERE id = 'bank';

-- BƯỚC 3: Kiểm tra kết quả
SELECT id, name, balance FROM payment_sources;
