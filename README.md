# Motocare - Hệ thống Quản lý Cửa hàng Xe máy

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](CHANGELOG.md)
[![React](https://img.shields.io/badge/React-19.1.1-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green.svg)](https://supabase.com/)

Hệ thống quản lý toàn diện cho cửa hàng xe máy, hỗ trợ bán hàng, sửa chữa, quản lý kho, tài chính và báo cáo.

---

## 📋 Mục lục

- [Tính năng chính](#-tính-năng-chính)
- [Demo và Screenshots](#-demo-và-screenshots)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt](#-cài-đặt)
- [Cấu hình](#-cấu-hình)
- [Chạy ứng dụng](#-chạy-ứng-dụng)
- [Build Production](#-build-production)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Database Schema](#-database-schema)
- [API và Functions](#-api-và-functions)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Bảo mật](#-bảo-mật)
- [Backup và Recovery](#-backup-và-recovery)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

---

## ✨ Tính năng chính

### 🏠 Dashboard

- Thống kê doanh thu, chi phí, lợi nhuận theo ngày/tháng/năm
- Biểu đồ trực quan (Line chart, Bar chart)
- Top sản phẩm bán chạy
- Cảnh báo tồn kho thấp
- Thống kê công nợ khách hàng/nhà cung cấp

### 💰 Bán hàng (Sales)

- Quản lý giỏ hàng realtime với tính toán tự động
- Mã hóa đơn tự động: `BH-YYYYMMDD-XXX`
- Giảm giá sản phẩm và tổng đơn
- Thanh toán đa phương thức (Tiền mặt, Chuyển khoản, Công nợ)
- In hóa đơn PDF với logo và thông tin cửa hàng
- Hoàn tiền và khôi phục tồn kho
- Lịch sử bán hàng, tìm kiếm và lọc

### 🔧 Sửa chữa (Service)

- Tạo phiếu sửa chữa với biển số xe
- Quản lý phụ tùng + dịch vụ trong một phiếu
- Đặt cọc, thanh toán từng phần
- Mã phiếu tự động: `SC-XXXXXX`
- Theo dõi trạng thái: Đang sửa → Hoàn thành
- Hoàn tiền với khôi phục tồn kho atomic
- Lịch sử sửa chữa theo biển số xe
- In phiếu sửa chữa PDF
- **Validation**: Số điện thoại, deposit amount

### 📦 Quản lý Kho (Inventory)

- CRUD phụ tùng với mã SKU
- Phiếu nhập hàng (từ nhà cung cấp)
- Phiếu xuất hàng (cho chi nhánh khác)
- Phiếu chuyển kho (giữa các chi nhánh)
- Điều chỉnh tồn kho (Atomic functions)
- Tính giá vốn bình quân động (Weighted Average Cost)
- Cảnh báo tồn thấp, out of stock
- Lịch sử biến động tồn kho
- **Validation**: Stock quantity để tránh overselling

### 👥 Khách hàng (Customers)

- CRUD khách hàng: Tên, SĐT, biển số xe
- Lịch sử mua hàng và sửa chữa
- Thống kê tổng chi tiêu, công nợ
- Tìm kiếm theo tên, SĐT, biển số
- **Validation**: Số điện thoại format VN

### 💳 Công nợ (Debts)

- Quản lý công nợ khách hàng
- Quản lý công nợ nhà cung cấp
- Thanh toán công nợ từng phần
- Lịch sử thanh toán
- Cảnh báo nợ quá hạn

### 💵 Tài chính (Finance)

- Sổ quỹ (Cash book)
- Quản lý thu/chi
- Vay/Cho vay
- Báo cáo thu chi theo kỳ
- Đối soát số dư

### 👷 Nhân viên (Employees)

- CRUD nhân viên
- Vai trò: Owner, Manager, Staff
- Quản lý lương
- Chấm công (nếu có)

### 📊 Báo cáo (Reports)

- **Báo cáo Doanh thu**: Export Excel với chi tiết từng đơn
- **Báo cáo Thu chi**: Phân tích cash flow
- **Báo cáo Tồn kho**: Stock levels với giá trị
- **Báo cáo Top sản phẩm** (NEW): Top 20 bán chạy nhất
- **Báo cáo Lợi nhuận theo sản phẩm** (NEW): Profit analysis
- **Báo cáo Tồn kho Chi tiết** (NEW): 4 sheets Excel
  - Tổng quan
  - Tất cả sản phẩm
  - Tồn thấp (≤5)
  - Hết hàng

### 🔒 Bảo mật

- Authentication với Supabase Auth
- Role-based access control (Owner/Manager/Staff)
- Row Level Security (RLS) trên database
- Audit logs cho mọi thao tác quan trọng

---

## 🖼️ Demo và Screenshots

_(Placeholder - Thêm screenshots sau)_

| Module    | Preview                                      |
| --------- | -------------------------------------------- |
| Dashboard | ![Dashboard](docs/screenshots/dashboard.png) |
| Sales     | ![Sales](docs/screenshots/sales.png)         |
| Service   | ![Service](docs/screenshots/service.png)     |
| Inventory | ![Inventory](docs/screenshots/inventory.png) |

---

## 💻 Yêu cầu hệ thống

- **Node.js**: >= 18.x
- **npm**: >= 9.x hoặc **yarn**: >= 1.22
- **Git**: >= 2.x
- **Supabase Account**: [Đăng ký miễn phí](https://supabase.com)
- **Browser**: Chrome, Firefox, Edge (latest versions)

---

## 🚀 Cài đặt

### 1. Clone repository

```powershell
git clone https://github.com/Nhan-Lam-SmartCare/Motocare.git
cd Motocare
```

### 2. Cài đặt dependencies

```powershell
npm install
```

### 3. Setup Supabase

Tạo project mới trên [Supabase Dashboard](https://app.supabase.com)

### 4. Chạy migrations

```powershell
# Apply all SQL files in sql/ folder
node scripts/setup/apply-sql.mjs
```

---

## ⚙️ Cấu hình

### Biến môi trường

Tạo file `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Lấy credentials từ**: Supabase Dashboard → Settings → API

---

## 🏃 Chạy ứng dụng

### Development

```powershell
npm run dev
```

Mở trình duyệt: `http://localhost:5173`

### Production Preview

```powershell
npm run build
npm run preview
```

---

## 📦 Build Production

```powershell
npm run build
```

Output: `dist/` folder

Deploy lên:

- Vercel: `vercel --prod`
- Netlify: `netlify deploy --prod`
- Static hosting: Upload `dist/` folder

---

## 🛠️ Công nghệ sử dụng

| Category     | Technology                           |
| ------------ | ------------------------------------ |
| **Frontend** | React 19.1.1, TypeScript 5.8.2       |
| **Styling**  | Tailwind CSS 3.4.4                   |
| **State**    | React Context, TanStack Query 5.90.5 |
| **Backend**  | Supabase (PostgreSQL, Auth, Storage) |
| **Build**    | Vite 6.2.0                           |
| **Icons**    | Lucide React                         |
| **Export**   | XLSX, jsPDF                          |
| **Forms**    | React Hook Form (optional)           |

---

## 📁 Cấu trúc dự án

```
Motocare/
├── src/
│   ├── components/        # React components
│   │   ├── customer/      # Customer management
│   │   ├── dashboard/     # Dashboard widgets
│   │   ├── inventory/     # Inventory management
│   │   ├── reports/       # Reports & exports
│   │   ├── sales/         # Sales module
│   │   ├── service/       # Service/workorder module
│   │   └── ...
│   ├── contexts/          # React contexts
│   │   ├── AppContext.tsx # Global state
│   │   └── AuthContext.tsx
│   ├── types.ts           # TypeScript types
│   ├── supabaseClient.ts  # Supabase client
│   ├── utils/             # Utilities
│   │   ├── validation.ts  # Validation functions
│   │   └── excelExport.ts # Excel export utilities
│   ├── App.tsx            # Main app component
│   └── index.tsx          # Entry point
├── sql/                   # Database migrations
│   ├── 2025-11-10_*.sql  # Schema definitions
│   └── ...
├── scripts/               # Dev/maintenance scripts
│   ├── test/             # Test scripts
│   ├── setup/            # Setup scripts
│   └── maintenance/      # Maintenance utilities
├── docs/                  # Documentation
├── public/                # Static assets
├── CHANGELOG.md           # Version history
├── README.md              # This file
└── package.json
```

---

## 🗄️ Database Schema

Xem chi tiết trong `sql/` folder. Các bảng chính:

- `parts`: Sản phẩm/phụ tùng
- `sales`: Đơn bán hàng
- `work_orders`: Phiếu sửa chữa
- `customers`: Khách hàng
- `inventory_transactions`: Biến động kho
- `payment_sources`: Nguồn tiền (quỹ)
- `financial_transactions`: Thu chi
- `profiles`: User profiles với roles

**RLS Policies**: Mỗi bảng có policies cho Owner/Manager/Staff

---

## 🔧 API và Functions

### Supabase Functions

- `finalize_sale_v7`: Xử lý đơn bán hàng (atomic)
- `refund_work_order_v3`: Hoàn tiền sửa chữa
- `adjust_part_stock_v5`: Điều chỉnh tồn kho
- `update_weighted_avg_cost`: Cập nhật giá vốn

Xem chi tiết: `sql/functions/`

---

## 🧪 Testing

### Manual Testing

Xem: `MANUAL_TESTING_CHECKLIST.md`

### Automated Tests (Planned)

```powershell
npm run test
```

---

## 🚢 Deployment

### Vercel (Recommended)

```powershell
npm install -g vercel
vercel --prod
```

### Netlify

```powershell
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Environment Variables

Thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` vào deployment settings.

---

## 🔐 Bảo mật

- ✅ RLS policies cho mọi bảng
- ✅ JWT authentication
- ✅ Role-based permissions
- ✅ Input validation
- ✅ SQL injection prevention (Prepared statements)
- ✅ CORS configuration
- ⚠️ **Chú ý**: Không commit `.env` files

---

## 💾 Backup và Recovery

Xem chi tiết: [BACKUP_GUIDE.md](BACKUP_GUIDE.md) _(sẽ tạo)_

Quick backup:

```powershell
# Export database from Supabase Dashboard
# Settings → Database → Backups → Create Backup
```

---

## 🐛 Troubleshooting

### Lỗi kết nối Supabase

```powershell
# Check .env.local file
cat .env.local

# Test connection
node scripts/test/check-supabase-status.mjs
```

### Build errors

```powershell
# Clear cache
rm -rf node_modules dist .vite
npm install
npm run build
```

### Database issues

Xem: `LOGIN_TROUBLESHOOTING.md`, `RLS_VALIDATION.md`

---

## 🗺️ Roadmap

Xem chi tiết: [CHANGELOG.md](CHANGELOG.md)

### Version 1.4.0 (Next)

- [ ] Multi-branch selector UI
- [ ] PWA support
- [ ] Print templates customization

### Version 1.5.0

- [ ] SMS notifications
- [ ] QR payment integration
- [ ] Warranty management

---

## 🤝 Contributing

Contributions are welcome! Vui lòng:

1. Fork repository
2. Tạo branch mới: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add some feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Tạo Pull Request

---

## 📄 License

MIT License - Xem [LICENSE](LICENSE) file

---

## 📞 Contact

- **Author**: Nhan Lam
- **Organization**: SmartCare
- **GitHub**: [Nhan-Lam-SmartCare/Motocare](https://github.com/Nhan-Lam-SmartCare/Motocare)
- **Issues**: [GitHub Issues](https://github.com/Nhan-Lam-SmartCare/Motocare/issues)

---

**Made with ❤️ for Vietnamese motorcycle shops**
