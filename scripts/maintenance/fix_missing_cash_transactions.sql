-- Script để thêm giao dịch chi tiền bị thiếu cho các phiếu nhập kho đã thanh toán đầy đủ
-- nhưng không được ghi vào sổ quỹ do bug paidAmount = 0

-- Bước 1: Xem các phiếu nhập kho hôm nay (03/12/2025)
SELECT 
    it.id,
    it."partName",
    it.quantity,
    it."unitPrice",
    it."totalPrice",
    it.date,
    it.notes,
    -- Extract receipt code
    SUBSTRING(it.notes FROM 'NH-[0-9]{8}-[0-9]{3}') as receipt_code
FROM inventory_transactions it
WHERE it.type = 'Nhập kho'
AND it.date::date = '2025-12-03'
ORDER BY it.date DESC;

-- Bước 2: Xem các giao dịch sổ quỹ hôm nay liên quan đến nhập kho
SELECT * 
FROM cash_transactions 
WHERE date::date = '2025-12-03'
AND (category = 'supplier_payment' OR notes LIKE '%Phiếu nhập%')
ORDER BY date DESC;

-- Bước 3: Xem công nợ nhà cung cấp được tạo hôm nay
SELECT * 
FROM supplier_debts 
WHERE created_date = '2025-12-03'
ORDER BY created_at DESC;

-- ⚠️ CHẠY TỪNG BƯỚC MỘT, KIỂM TRA KẾT QUẢ TRƯỚC KHI TIẾP TỤC

-- Bước 4: Nếu xác nhận phiếu đã thanh toán đầy đủ nhưng chưa có giao dịch chi tiền
-- Thêm giao dịch chi tiền cho phiếu 1 (Kim Thành - 987.000đ)
/*
INSERT INTO cash_transactions (
    id,
    type,
    amount,
    "branchId",
    "paymentSourceId",
    date,
    notes,
    category,
    recipient
) VALUES (
    'CT-FIX-' || extract(epoch from now())::text,
    'expense',
    987000,
    'CN1', -- Thay bằng branch_id đúng
    'bank', -- hoặc 'cash' tùy phương thức thanh toán
    '2025-12-03T10:49:00+07:00',
    'Chi trả NCC Kim Thành (Dung) - Phiếu nhập NH-20251203-084 (Bổ sung do lỗi hệ thống)',
    'supplier_payment',
    'Kim Thành (Dung)'
);
*/

-- Bước 5: Thêm giao dịch chi tiền cho phiếu 2 (Kho sỉ Thập Nhất Phong - 4.979.178đ)
/*
INSERT INTO cash_transactions (
    id,
    type,
    amount,
    "branchId",
    "paymentSourceId",
    date,
    notes,
    category,
    recipient
) VALUES (
    'CT-FIX-' || (extract(epoch from now()) + 1)::text,
    'expense',
    4979178,
    'CN1', -- Thay bằng branch_id đúng
    'bank', -- hoặc 'cash' tùy phương thức thanh toán
    '2025-12-03T10:18:00+07:00',
    'Chi trả NCC Kho sỉ Thập Nhất Phong - Phiếu nhập NH-20251203-083 (Bổ sung do lỗi hệ thống)',
    'supplier_payment',
    'Kho sỉ Thập Nhất Phong'
);
*/

-- Bước 6: Xóa công nợ sai (nếu đã thanh toán đầy đủ)
-- Chỉ xóa nếu bạn chắc chắn đã thanh toán đầy đủ!
/*
DELETE FROM supplier_debts 
WHERE created_date = '2025-12-03'
AND description LIKE '%NH-20251203-084%'; -- Phiếu Kim Thành

DELETE FROM supplier_debts 
WHERE created_date = '2025-12-03'
AND description LIKE '%NH-20251203-083%'; -- Phiếu Kho sỉ Thập Nhất Phong
*/

-- Sau khi fix, verify lại:
-- SELECT * FROM cash_transactions WHERE date::date = '2025-12-03' ORDER BY date DESC;
-- SELECT * FROM supplier_debts WHERE created_date = '2025-12-03';
