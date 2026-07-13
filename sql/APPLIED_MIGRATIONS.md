# Nhật ký migration đã apply lên production

> Repo chưa có bảng `schema_migrations`. File này ghi thủ công migration nào đã
> chạy lên DB production (project `xduimljokohsqslwbtja`) để đối chiếu về sau.
> Khi apply file SQL mới lên prod, thêm 1 dòng vào bảng dưới.

## Đã áp dụng

| Ngày | File / Thao tác | Mục đích | Verify |
|---|---|---|---|
| 2026-07-10 | `2026-06-16_tighten_rls_sensitive_tables.sql` (+ các file secure trước đó) | Siết RLS bảng tài chính theo vai trò/chi nhánh | pg_policies |
| 2026-07-10 | `2026-07-10_drop_leftover_open_public_policies.sql` | Xóa 7 policy mở `{public}` còn sót (tài chính/labor) + REVOKE anon | probe anon |
| 2026-07-10 | `2026-07-10_secure_categories_suppliers.sql` | Chặn anon + policy authenticated cho categories, suppliers | probe anon |
| 2026-07-10 | `2026-07-10_revoke_anon_grants.sql` (gộp) + `2026-07-10_enable_rls_notifications_repair_templates.sql` | REVOKE anon trên views/tables còn hở + bật RLS notifications, repair_templates | **probe anon: 16/16 blocked** |
| 2026-07-11 | `2026-07-11_views_security_invoker.sql` | `security_invoker=on` cho `cash_transactions_ledger`, `inventory_balances_view` (chống lộ chéo chi nhánh) | reloptions |
| 2026-07-11 | `2026-07-11_labor_rpc_security_definer.sql` | `upsert_repair_order_labor_bundle` + `recalculate_repair_order_labor_totals` → SECURITY DEFINER + search_path=public | prosecdef=true |
| 2026-07-11 | `2026-07-11_tighten_labor_rls_final.sql` | Siết RLS 4 bảng labor: SELECT authenticated, GHI owner/manager (services: GHI owner) | pg_policies |

## Trạng thái bảo mật sau các bước trên
- ✅ Không đối tượng nào trong `public` lộ dữ liệu cho `anon` (verify bằng `scripts/setup/verify-anon-access.mjs`: 16/16 `permission denied`).
- ✅ Bảng tài chính/kho/labor: chỉ owner/manager (hoặc theo chi nhánh) mới ghi; staff ghi labor qua RPC SECURITY DEFINER.
- ✅ 2 view tôn trọng RLS bảng gốc.

## Nợ bảo mật còn lại (P1, chưa apply)
- [ ] `notifications` đang là `authenticated USING(true)` → nên scope theo chi nhánh/role (cần test hook useNotifications không vỡ).
- [ ] Xác nhận cuối: đăng nhập **staff** trên app → tạo phiếu sửa có tiền công phải thành công (bằng chứng RPC labor hoạt động sau siết).

## Cách kiểm chứng nhanh (bất kỳ lúc nào)
```bash
node scripts/setup/verify-anon-access.mjs   # kỳ vọng: 16/16 blocked
```
