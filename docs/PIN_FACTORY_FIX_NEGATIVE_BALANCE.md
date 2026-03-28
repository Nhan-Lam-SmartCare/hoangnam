# Hướng dẫn sửa số âm trên Sổ Quỹ Pin Factory

## Vấn đề
Sổ quỹ hiển thị số âm (ví dụ: -1.517.987 đ) vì **chưa thiết lập số dư ban đầu**.

## Nguyên nhân
Hệ thống tính số dư theo công thức:
```
Số dư hiện tại = Số dư ban đầu + (Tổng thu - Tổng chi)
```

Khi số dư ban đầu = 0, và có nhiều chi hơn thu → Kết quả âm.

## Giải pháp

### Bước 1: Kiểm tra số dư thực tế
1. Mở ứng dụng **Pin Corp** trên điện thoại
2. Vào phần **Sổ quỹ**
3. **Đếm tiền mặt trong két** (ví dụ: 5.000.000 đ)
4. **Kiểm tra sao kê ngân hàng** (ví dụ: 10.000.000 đ)

### Bước 2: Thiết lập số dư ban đầu
1. Truy cập **Supabase Dashboard** của Pin Factory:
   - URL: https://supabase.com/dashboard/project/jvigqtcbtzaxmrdsbfru
   
2. Vào **SQL Editor** (icon database ở menu bên trái)

3. Chạy script sau (thay số tiền theo thực tế):

```sql
-- Tạo bảng payment_sources nếu chưa có
CREATE TABLE IF NOT EXISTS payment_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  balance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cập nhật số dư ban đầu (THAY ĐỔI SỐ TIỀN THEO THỰC TẾ)
INSERT INTO payment_sources (id, name, type, balance)
VALUES 
  ('cash', 'Tiền mặt', 'cash', '{"CN1": 5000000}'::jsonb),  -- 5 triệu tiền mặt
  ('bank', 'Ngân hàng', 'bank', '{"CN1": 10000000}'::jsonb) -- 10 triệu ngân hàng
ON CONFLICT (id) 
DO UPDATE SET 
  balance = EXCLUDED.balance,
  updated_at = NOW();

-- Kiểm tra kết quả
SELECT 
  id,
  name,
  balance->>'CN1' as cn1_balance
FROM payment_sources
WHERE id IN ('cash', 'bank');
```

4. Nhấn **Run** để thực thi

### Bước 3: Xác nhận
1. Reload trang web **Tổng hợp Tài chính**
2. Số liệu Pin Factory sẽ hiển thị đúng:
   - Tiền mặt = Số dư ban đầu + Biến động
   - Ngân hàng = Số dư ban đầu + Biến động

## Lưu ý quan trọng

⚠️ **Số dư ban đầu** phải là số dư **THỰC TẾ HIỆN TẠI**, không phải số dư khi bắt đầu kinh doanh.

📌 **Ví dụ:**
- Tiền mặt trong két hiện tại: 3.500.000 đ
- Ngân hàng hiện tại: 8.200.000 đ
- Nhập đúng 2 số này vào script, **KHÔNG** nhập số dư cũ

## Cập nhật sau này

Nếu cần thay đổi số dư ban đầu sau này:

```sql
-- Cập nhật tiền mặt
UPDATE payment_sources 
SET 
  balance = jsonb_set(balance, '{CN1}', '7000000', true),
  updated_at = NOW()
WHERE id = 'cash';

-- Cập nhật ngân hàng
UPDATE payment_sources 
SET 
  balance = jsonb_set(balance, '{CN1}', '15000000', true),
  updated_at = NOW()
WHERE id = 'bank';
```

## Hỗ trợ

Nếu sau khi làm theo vẫn bị lỗi, kiểm tra:
1. RLS có đang chặn truy cập không? Chạy script `pin_factory_fix_rls.sql`
2. Có đúng database Pin Factory không? Kiểm tra URL có chứa `jvigqtcbtzaxmrdsbfru`
3. Console log có báo lỗi gì không? (F12 → Console tab)
