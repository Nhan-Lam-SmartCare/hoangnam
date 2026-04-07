# Repair Labor Demo Setup

File nay huong dan nap bo du lieu demo cho module:
- Dich vu / cong sua trong phieu
- Chia cong cho tho
- Tong hop luong theo thang

## 1. Dieu kien truoc khi chay

Can chay file migration labor module truoc:

`sql/2026-04-01_add_repair_labor_module.sql`

Sau do moi chay file demo:

`sql/2026-04-01_seed_repair_labor_demo.sql`

## 2. Du lieu demo se tao

### Nhan vien demo

- `EMP-LABOR-DEMO-001` - Nguyen Van Duc
- `EMP-LABOR-DEMO-002` - Pham Van Son
- `EMP-LABOR-DEMO-003` - Tran Minh Tuan

### Phieu sua demo

- `WO-LABOR-DEMO-001`
  - Parts total: `310,000`
  - Labor total: `120,000`
  - Worker total: `36,000`
  - Grand total: `430,000`
  - Tinh huong: 1 tho, gom `Thay bugi` + `Ve sinh hong ga`

- `WO-LABOR-DEMO-002`
  - Parts total: `1,190,000`
  - Labor total: `164,000`
  - Worker total: `94,000`
  - Grand total: `1,354,000`
  - Tinh huong: 2 tho chia `70/30`, gom `Thay bom xang` + `Ve sinh hong ga`

- `WO-LABOR-DEMO-003`
  - Parts total: `0`
  - Labor total: `180,000`
  - Worker total: `63,000`
  - Grand total: `180,000`
  - Tinh huong: cong `manual` + 1 muc bao hanh `is_billable = false`, `is_payable_to_worker = false`

## 3. Cach chay

1. Mo Supabase SQL Editor
2. Chay `sql/2026-04-01_add_repair_labor_module.sql` neu DB chua co labor module
3. Chay `sql/2026-04-01_seed_repair_labor_demo.sql`
4. Reload app

## 4. Cach kiem tra trong app

### Man hinh Phieu sua

Tim 3 ma phieu:
- `WO-LABOR-DEMO-001`
- `WO-LABOR-DEMO-002`
- `WO-LABOR-DEMO-003`

Ban se thay:
- Danh sach cong sua
- So tien labor amount
- Danh sach tho va worker amount
- Tong `labor_total` va `worker_total`

### Man hinh Nhan vien / Cong sua / Luong

Loc thang hien tai se thay:
- Nguyen Van Duc co tong cong `36,000`
- Pham Van Son co tong cong `74,800`
- Tran Minh Tuan co tong cong `82,200`

## 5. Query kiem tra nhanh

```sql
SELECT
  id,
  "customerName",
  total,
  labor_total,
  worker_total,
  "paymentStatus"
FROM public.work_orders
WHERE id LIKE 'WO-LABOR-DEMO-%'
ORDER BY id;
```

```sql
SELECT
  worker_id,
  worker_name,
  share_percent,
  worker_amount
FROM public.repair_order_service_workers
WHERE worker_id LIKE 'EMP-LABOR-DEMO-%'
ORDER BY worker_name, created_at;
```

## 6. Luu y

- File demo nay co tinh idempotent: chay lai se refresh lai cung bo demo, khong nhan ban vo han.
- Script chi dong vao cac ID demo `WO-LABOR-DEMO-*` va `EMP-LABOR-DEMO-*`.
- Du lieu that cua app se khong bi xoa neu khong trung cac ID demo tren.
