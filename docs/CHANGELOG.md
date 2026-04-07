# Changelog

Tất cả các thay đổi quan trọng của dự án **Motocare** sẽ được ghi lại trong file này.

Format dựa theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2025-11-23

### Added - Phase 3: Advanced Reports

- **Báo cáo Top sản phẩm bán chạy**: Export Excel top 20 sản phẩm bán chạy nhất
  - Ranking theo số lượng bán
  - Doanh thu từng sản phẩm
  - Số đơn hàng và giá trị trung bình/đơn
- **Báo cáo Lợi nhuận theo sản phẩm**: Phân tích chi tiết lợi nhuận
  - Revenue vs Cost
  - Profit margins (%)
  - Sort theo profitability
- **Báo cáo Tồn kho Chi tiết**: 4 sheets Excel
  - Sheet Tổng quan: Thống kê tổng hợp
  - Sheet Tất cả sản phẩm: Full inventory
  - Sheet Tồn thấp: Cảnh báo stock ≤5
  - Sheet Hết hàng: Out of stock items
- **UI Improvements**:
  - Dropdown "Báo cáo nâng cao" trong Revenue tab
  - Button "Tồn kho chi tiết" trong Inventory tab
  - Hover menus với better UX

### Business Value

- Insights về sản phẩm bán chạy
- Tối ưu hóa lợi nhuận
- Quản lý tồn kho hiệu quả
- Data-driven decision making

## [1.2.0] - 2025-11-23

### Added - Phase 2: Validation System

- **Validation Utils** (`src/utils/validation.ts`):
  - `validatePhoneNumber()`: Vietnamese phone format (10-11 digits)
  - `validateStockQuantity()`: Prevent overselling
  - `validateDepositAmount()`: Deposit ≤ total amount
  - `validateDiscount()`: Discount ≤ subtotal
  - `validateLicensePlate()`: Vietnamese plate format
  - `validatePriceAndQty()`: Price & quantity limits

### Changed

- **ServiceManager**: Added phone & deposit validation
- **CustomerManager**: Added phone validation
- **SalesManager**: Stock validation (already existed, kept)

### Improved

- Error messages in Vietnamese
- Better data quality
- User experience with clear validation feedback

## [1.1.0] - 2025-11-23

### Added - Phase 1: Cleanup & Organization

- **Scripts Organization**: Reorganized 38 scripts into 3 folders
  - `scripts/test/` (12 files): Test scripts
  - `scripts/setup/` (4 files): Setup/bootstrap scripts
  - `scripts/maintenance/` (22 files): Maintenance utilities
- **Documentation**: Added README.md for each scripts folder
  - Test scripts documentation
  - Setup instructions
  - Maintenance scripts guide

### Removed

- **SQL Files**: Deleted 55 debug/fix files
  - 15 check/debug SQL files
  - 31 fix SQL files (already applied)
  - 9 cleanup/rollback temporary files
- **Documentation**: Deleted 11 completed/obsolete .md files
  - IMPLEMENTATION_COMPLETE.md
  - INVENTORY_FIX_COMPLETED.md
  - STEP_2_COMPLETED.md
  - VALIDATION_FIXES_REPORT.md
  - And 7 other completed milestone docs

### Changed

- Reduced SQL files from 109 to 54 (50% reduction)
- Reduced .md files from 23 to 12 (48% reduction)
- Better project structure and navigation

## [1.0.0] - 2025-11-10

### Initial Release

Hệ thống quản lý cửa hàng xe máy hoàn chỉnh

#### Core Features

- **Dashboard**: Thống kê tổng quan, biểu đồ doanh thu
- **Bán hàng (Sales)**:
  - Quản lý giỏ hàng realtime
  - Tính toán giảm giá tự động
  - Xuất hóa đơn PDF
  - Mã hóa đơn tự động (BH-YYYYMMDD-XXX)
- **Sửa chữa (Service)**:
  - Tạo/sửa phiếu sửa chữa
  - Quản lý phụ tùng + dịch vụ
  - Đặt cọc, thanh toán từng phần
  - Hoàn tiền với khôi phục tồn kho
  - Lịch sử sửa chữa theo biển số
- **Quản lý kho (Inventory)**:
  - Phiếu nhập/xuất/chuyển kho
  - Tính giá vốn bình quân động
  - Điều chỉnh tồn kho atomic
  - Cảnh báo tồn thấp
- **Khách hàng (Customers)**: CRUD, lịch sử giao dịch
- **Công nợ (Debts)**: Quản lý công nợ KH & NCC
- **Tài chính (Finance)**: Sổ quỹ, thu chi, vay/cho vay
- **Nhân viên (Employees)**: Quản lý nhân viên, lương
- **Báo cáo (Reports)**:
  - Báo cáo doanh thu
  - Báo cáo thu chi
  - Báo cáo tồn kho
  - Export Excel

#### Technical Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **State Management**: React Context + TanStack Query
- **Authentication**: Supabase Auth với roles (Owner/Manager/Staff)
- **Database**:
  - Row Level Security (RLS)
  - Atomic functions cho transactions
  - Audit logs

#### Features

- ✅ Responsive design (Desktop + Mobile)
- ✅ Dark mode
- ✅ Real-time updates
- ✅ Offline-first design
- ✅ Export to Excel/PDF
- ✅ Role-based access control

---

## Version History Summary

| Version | Date       | Description               |
| ------- | ---------- | ------------------------- |
| 1.3.0   | 2025-11-23 | Advanced Reports & Export |
| 1.2.0   | 2025-11-23 | Validation System         |
| 1.1.0   | 2025-11-23 | Cleanup & Organization    |
| 1.0.0   | 2025-11-10 | Initial Release           |

---

## Git Commits

```bash
# Phase 3: Advanced Reports
3554104 - feat: add advanced reports and enhanced Excel export (Phase 3)

# Phase 2: Validation
9ba93a8 - feat: add comprehensive validation system (Phase 2)

# Phase 1: Cleanup
058594d - chore: cleanup debug/fix SQL files and reorganize scripts

# Initial
b9c3a9d - init
8ba1d6a - init
```

---

## Upcoming Features (Roadmap)

### Version 1.4.0 (Planned)

- [ ] Multi-branch selector UI
- [ ] Print templates customization
- [ ] PWA (Progressive Web App) setup
- [ ] Automated backup system

### Version 1.5.0 (Planned)

- [ ] SMS/Email notifications
- [ ] QR code payment integration
- [ ] Warranty management
- [ ] Appointment scheduling

### Version 2.0.0 (Future)

- [ ] Mobile native app
- [ ] API for third-party integrations
- [ ] Advanced analytics with AI
- [ ] Multi-language support

---

## Breaking Changes

### Version 1.0.0

- Initial release, no breaking changes

---

## Migration Guide

### From 0.x to 1.0.0

This is the first stable release. Please follow the setup guide in README.md

---

## Support

For issues and questions:

- GitHub Issues: https://github.com/Nhan-Lam-SmartCare/Motocare/issues
- Documentation: See README.md and MANUAL_TESTING_CHECKLIST.md
