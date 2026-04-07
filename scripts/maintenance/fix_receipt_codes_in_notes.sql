-- Script để cập nhật receiptCode trong notes của inventory_transactions
-- dựa vào công nợ nhà cung cấp (supplier_debts)

-- Bước 1: Xem danh sách công nợ có mã phiếu nhập
SELECT 
    id,
    supplier_name,
    description,
    total_amount,
    created_date,
    -- Extract receipt code từ description (format: "Nhập kho NH-XXXXXXXX-XXX - ...")
    SUBSTRING(description FROM 'NH-[0-9]{8}-[0-9]{3}') as receipt_code
FROM supplier_debts
WHERE description LIKE '%NH-%'
ORDER BY created_date DESC;

-- Bước 2: Xem inventory_transactions cần cập nhật (chưa có receiptCode trong notes)
SELECT 
    id,
    "partName",
    quantity,
    "totalPrice",
    date,
    notes
FROM inventory_transactions
WHERE type = 'Nhập kho'
AND (notes IS NULL OR notes NOT LIKE 'NH-%')
ORDER BY date DESC
LIMIT 50;

-- Bước 3: Đối với công nợ cụ thể, tìm transactions tương ứng
-- Ví dụ cho công nợ Kim Thành (Dung) ngày 03/12/2025, tổng 987.000đ
/*
-- Tìm transactions cùng ngày, cùng nhà cung cấp
SELECT * 
FROM inventory_transactions 
WHERE type = 'Nhập kho'
AND date::date = '2025-12-03'
AND notes LIKE '%Kim Thành%'
ORDER BY date;

-- Cập nhật notes với receiptCode từ công nợ
UPDATE inventory_transactions
SET notes = 'NH-20251203-644 | ' || COALESCE(notes, '')
WHERE type = 'Nhập kho'
AND date::date = '2025-12-03'
AND notes LIKE '%Kim Thành%'
AND notes NOT LIKE 'NH-%';
*/

-- ⚠️ QUAN TRỌNG: Chạy SELECT trước để kiểm tra, sau đó mới chạy UPDATE
-- Thay thế mã phiếu và điều kiện phù hợp với dữ liệu thực tế

-- Bước 4: Xóa công nợ nếu đã thanh toán đầy đủ (remaining_amount = 0 hoặc âm)
-- SELECT * FROM supplier_debts WHERE remaining_amount <= 0;
-- DELETE FROM supplier_debts WHERE remaining_amount <= 0;
