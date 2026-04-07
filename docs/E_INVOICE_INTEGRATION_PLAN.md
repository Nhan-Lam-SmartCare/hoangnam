# 📋 KẾ HOẠCH TÍCH HỢP HÓA ĐƠN ĐIỆN TỬ - MOTOCARE

> **⚠️ LƯU Ý:** Đây là kế hoạch cho **PHƯƠNG ÁN 1** - Tích hợp API với nhà cung cấp hóa đơn điện tử.  
> Hiện tại dự án đang sử dụng **PHƯƠNG ÁN 2** (Xuất XML). Xem `TAX_REPORT_USER_GUIDE.md` để biết chi tiết.
>
> Kế hoạch này sẽ được triển khai khi doanh nghiệp phát triển lớn hơn và cần tự động hóa 100%.

## 🎯 MỤC TIÊU

Tích hợp hóa đơn điện tử hợp pháp cho hệ thống Motocare, tuân thủ quy định Tổng cục Thuế.

## 📊 PHÂN TÍCH HIỆN TRẠNG

### ✅ Đã có:

- Thông tin doanh nghiệp (tax_code, address, phone, email)
- Dữ liệu giao dịch đầy đủ (Sales, Work Orders)
- Thông tin khách hàng
- Hệ thống báo cáo tài chính
- Xuất Excel/PDF

### ❌ Cần bổ sung:

- API tích hợp nhà cung cấp hóa đơn điện tử
- Chuyển đổi dữ liệu sang định dạng XML chuẩn
- Quản lý mã tra cứu hóa đơn
- Gửi email hóa đơn cho khách hàng
- Hủy/điều chỉnh hóa đơn

## 🏆 KHUYẾN NGHỊ: SỬ DỤNG VNPT INVOICE

**Lý do:**

- ✅ Giá rẻ nhất (300,000 - 500,000 VNĐ/năm)
- ✅ API đơn giản, dễ tích hợp
- ✅ Hỗ trợ tốt
- ✅ Phổ biến, nhiều doanh nghiệp tin dùng

**Thông tin:**

- Website: https://vnpt-invoice.vn
- Hotline: 1900 8000
- Gói phù hợp: **Gói Start** (100 hóa đơn/tháng - 300k/năm)

## 📅 KẾ HOẠCH TRIỂN KHAI

### **Phase 1: Chuẩn bị (1-2 tuần)**

#### 1.1. Bổ sung thông tin doanh nghiệp

```sql
-- Thêm vào bảng organization_settings
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS einvoice_enabled BOOLEAN DEFAULT false;
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS einvoice_provider TEXT; -- 'vnpt', 'viettel', 'fpt'
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS einvoice_api_url TEXT;
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS einvoice_api_key TEXT;
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS einvoice_username TEXT;
```

#### 1.2. Bổ sung thông tin khách hàng

```sql
-- Thêm mã số thuế khách hàng (nếu là doanh nghiệp)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_code TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_company BOOLEAN DEFAULT false;
```

#### 1.3. Cập nhật bảng Sales để lưu thông tin hóa đơn điện tử

```sql
ALTER TABLE sales ADD COLUMN IF NOT EXISTS einvoice_number TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS einvoice_url TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS einvoice_lookup_code TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS einvoice_status TEXT; -- 'pending', 'issued', 'cancelled'
ALTER TABLE sales ADD COLUMN IF NOT EXISTS einvoice_issued_at TIMESTAMPTZ;
```

### **Phase 2: Đăng ký dịch vụ (3-5 ngày)**

#### 2.1. Đăng ký với VNPT Invoice

1. Truy cập https://vnpt-invoice.vn/dang-ky
2. Chuẩn bị hồ sơ:
   - Giấy phép kinh doanh
   - Giấy đăng ký MST
   - Thông tin đại diện
3. Chọn gói dịch vụ: **Gói Start**
4. Thanh toán và nhận thông tin:
   - API URL
   - API Key
   - Username/Password

#### 2.2. Cấu hình trong hệ thống

- Vào Settings > Organization > E-Invoice tab
- Nhập thông tin từ VNPT
- Test kết nối

### **Phase 3: Phát triển tính năng (2-3 tuần)**

#### 3.1. Backend: Tạo E-Invoice Service

```typescript
// src/lib/services/einvoice/VNPTInvoiceService.ts

interface VNPTInvoiceRequest {
  invoiceNumber: string;
  date: string;
  customer: {
    name: string;
    taxCode?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  items: Array<{
    name: string;
    unit: string;
    quantity: number;
    price: number;
    amount: number;
    vatRate: number; // 0, 5, 10 (%)
  }>;
  subtotal: number;
  vatAmount: number;
  total: number;
  paymentMethod: string;
  notes?: string;
}

interface VNPTInvoiceResponse {
  success: boolean;
  invoiceNumber: string;
  lookupCode: string;
  pdfUrl: string;
  xmlUrl: string;
  errorMessage?: string;
}

class VNPTInvoiceService {
  private apiUrl: string;
  private apiKey: string;
  private username: string;
  private password: string;
  private taxCode: string;

  constructor(config: EInvoiceConfig) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.username = config.username;
    this.password = config.password;
    this.taxCode = config.taxCode;
  }

  async authenticate(): Promise<string> {
    // Lấy access token
    const response = await fetch(`${this.apiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    const data = await response.json();
    return data.access_token;
  }

  async createInvoice(data: VNPTInvoiceRequest): Promise<VNPTInvoiceResponse> {
    try {
      const token = await this.authenticate();

      // Chuyển đổi sang format VNPT
      const vnptFormat = this.convertToVNPTFormat(data);

      const response = await fetch(`${this.apiUrl}/api/invoices/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(vnptFormat),
      });

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          invoiceNumber: result.data.invoiceNumber,
          lookupCode: result.data.lookupCode,
          pdfUrl: result.data.pdfUrl,
          xmlUrl: result.data.xmlUrl,
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error creating e-invoice:", error);
      return {
        success: false,
        invoiceNumber: "",
        lookupCode: "",
        pdfUrl: "",
        xmlUrl: "",
        errorMessage: error.message,
      };
    }
  }

  async cancelInvoice(invoiceNumber: string, reason: string): Promise<boolean> {
    try {
      const token = await this.authenticate();

      const response = await fetch(`${this.apiUrl}/api/invoices/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoiceNumber,
          reason,
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Error cancelling e-invoice:", error);
      return false;
    }
  }

  async viewInvoice(lookupCode: string): Promise<string> {
    // Trả về URL để khách hàng tra cứu hóa đơn
    return `${this.apiUrl}/invoice/view?code=${lookupCode}`;
  }

  private convertToVNPTFormat(data: VNPTInvoiceRequest): any {
    return {
      generalInvoiceInfo: {
        invoiceType: "01GTKT", // Hóa đơn GTGT
        templateCode: "C23TTT", // Mã mẫu (lấy từ VNPT)
        invoiceSeries: "C23TKY", // Ký hiệu (lấy từ VNPT)
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.date,
        currencyCode: "VND",
        exchangeRate: 1,
      },
      buyerInfo: {
        buyerName: data.customer.name,
        buyerLegalName: data.customer.name,
        buyerTaxCode: data.customer.taxCode || "",
        buyerAddressLine: data.customer.address || "",
        buyerPhoneNumber: data.customer.phone || "",
        buyerEmail: data.customer.email || "",
      },
      itemInfo: data.items.map((item, index) => ({
        lineNumber: index + 1,
        itemName: item.name,
        unitName: item.unit,
        quantity: item.quantity,
        unitPrice: item.price,
        itemTotalAmountWithoutVat: item.amount,
        vatPercentage: item.vatRate,
        vatAmount: (item.amount * item.vatRate) / 100,
        itemTotalAmountWithVat:
          item.amount + (item.amount * item.vatRate) / 100,
      })),
      summarizeInfo: {
        totalAmountWithoutVat: data.subtotal,
        totalVatAmount: data.vatAmount,
        totalAmountWithVat: data.total,
      },
      paymentInfo: {
        paymentMethodName: data.paymentMethod,
      },
      additionalInfo: {
        note: data.notes || "",
      },
    };
  }
}

export default VNPTInvoiceService;
```

#### 3.2. Cập nhật Sale Flow

```typescript
// src/lib/repository/salesRepository.ts

export async function createSaleWithEInvoice(saleData: CreateSaleData) {
  // 1. Tạo sale như bình thường
  const sale = await createSale(saleData);

  // 2. Kiểm tra nếu bật hóa đơn điện tử
  const orgSettings = await getOrganizationSettings();

  if (orgSettings.einvoice_enabled) {
    try {
      // 3. Khởi tạo service
      const einvoiceService = new VNPTInvoiceService({
        apiUrl: orgSettings.einvoice_api_url,
        apiKey: orgSettings.einvoice_api_key,
        username: orgSettings.einvoice_username,
        password: decrypt(orgSettings.einvoice_password), // Mã hóa password trong DB
        taxCode: orgSettings.tax_code,
      });

      // 4. Tạo hóa đơn điện tử
      const invoiceData: VNPTInvoiceRequest = {
        invoiceNumber: sale.id,
        date: sale.date,
        customer: {
          name: sale.customer.name,
          taxCode: sale.customer.tax_code,
          address: sale.customer.address,
          phone: sale.customer.phone,
          email: sale.customer.email,
        },
        items: sale.items.map((item) => ({
          name: item.name,
          unit: "Cái", // hoặc lấy từ part
          quantity: item.quantity,
          price: item.sellingPrice,
          amount: item.quantity * item.sellingPrice,
          vatRate: 10, // VAT 10%, có thể cấu hình
        })),
        subtotal: sale.subtotal,
        vatAmount: sale.subtotal * 0.1, // 10% VAT
        total: sale.total,
        paymentMethod:
          sale.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản",
        notes: sale.note,
      };

      const einvoiceResult = await einvoiceService.createInvoice(invoiceData);

      if (einvoiceResult.success) {
        // 5. Cập nhật thông tin hóa đơn điện tử vào sale
        await supabase
          .from("sales")
          .update({
            einvoice_number: einvoiceResult.invoiceNumber,
            einvoice_url: einvoiceResult.pdfUrl,
            einvoice_lookup_code: einvoiceResult.lookupCode,
            einvoice_status: "issued",
            einvoice_issued_at: new Date().toISOString(),
          })
          .eq("id", sale.id);

        // 6. Gửi email hóa đơn cho khách hàng (nếu có email)
        if (sale.customer.email) {
          await sendEInvoiceEmail({
            to: sale.customer.email,
            customerName: sale.customer.name,
            invoiceNumber: einvoiceResult.invoiceNumber,
            invoiceUrl: einvoiceResult.pdfUrl,
            lookupCode: einvoiceResult.lookupCode,
            total: sale.total,
          });
        }

        return {
          ...sale,
          einvoice: einvoiceResult,
        };
      } else {
        // Nếu lỗi, vẫn trả về sale nhưng không có hóa đơn điện tử
        console.error(
          "E-invoice creation failed:",
          einvoiceResult.errorMessage
        );
        return sale;
      }
    } catch (error) {
      console.error("Error in e-invoice flow:", error);
      // Không làm gián đoạn quy trình bán hàng
      return sale;
    }
  }

  return sale;
}
```

#### 3.3. Frontend: UI cấu hình

```tsx
// src/components/settings/EInvoiceSettings.tsx

import React, { useState } from "react";
import { FileCheck, Settings, TestTube } from "lucide-react";

interface EInvoiceSettingsProps {
  settings: OrganizationSettings;
  onSave: (settings: Partial<OrganizationSettings>) => Promise<void>;
}

const EInvoiceSettings: React.FC<EInvoiceSettingsProps> = ({
  settings,
  onSave,
}) => {
  const [enabled, setEnabled] = useState(settings.einvoice_enabled || false);
  const [provider, setProvider] = useState(
    settings.einvoice_provider || "vnpt"
  );
  const [apiUrl, setApiUrl] = useState(settings.einvoice_api_url || "");
  const [apiKey, setApiKey] = useState(settings.einvoice_api_key || "");
  const [username, setUsername] = useState(settings.einvoice_username || "");
  const [password, setPassword] = useState("");
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");

  const handleTestConnection = async () => {
    setTestStatus("testing");
    try {
      const service = new VNPTInvoiceService({
        apiUrl,
        apiKey,
        username,
        password,
        taxCode: settings.tax_code,
      });

      await service.authenticate();
      setTestStatus("success");
      setTimeout(() => setTestStatus("idle"), 3000);
    } catch (error) {
      setTestStatus("error");
      setTimeout(() => setTestStatus("idle"), 3000);
    }
  };

  const handleSave = async () => {
    await onSave({
      einvoice_enabled: enabled,
      einvoice_provider: provider,
      einvoice_api_url: apiUrl,
      einvoice_api_key: apiKey,
      einvoice_username: username,
      ...(password && { einvoice_password: password }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileCheck className="w-6 h-6 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Hóa đơn điện tử
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tích hợp với nhà cung cấp hóa đơn điện tử
          </p>
        </div>
      </div>

      {/* Toggle Enable */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <div>
          <label className="font-medium text-slate-900 dark:text-white">
            Bật hóa đơn điện tử
          </label>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tự động tạo hóa đơn điện tử khi bán hàng
          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Nhà cung cấp
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="vnpt">VNPT Invoice</option>
              <option value="viettel">Viettel Invoice</option>
              <option value="fpt">FPT Invoice</option>
              <option value="misa">MISA meInvoice</option>
            </select>
          </div>

          {/* API Configuration */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                API URL
              </label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api-invoice.vnpt.vn"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Test Connection */}
          <button
            onClick={handleTestConnection}
            disabled={testStatus === "testing"}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              testStatus === "success"
                ? "bg-green-600 text-white"
                : testStatus === "error"
                ? "bg-red-600 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            <TestTube className="w-4 h-4" />
            {testStatus === "testing" && "Đang kiểm tra..."}
            {testStatus === "success" && "Kết nối thành công!"}
            {testStatus === "error" && "Kết nối thất bại!"}
            {testStatus === "idle" && "Test kết nối"}
          </button>
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Lưu cấu hình
        </button>
      </div>
    </div>
  );
};

export default EInvoiceSettings;
```

#### 3.4. Hiển thị hóa đơn điện tử trong chi tiết đơn hàng

```tsx
// Thêm vào SalesManager.tsx - phần chi tiết sale

{
  sale.einvoice_status === "issued" && (
    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-green-700 dark:text-green-400">
            Hóa đơn điện tử
          </span>
        </div>
        <span className="text-xs text-green-600 dark:text-green-400">
          {formatDate(sale.einvoice_issued_at)}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-slate-600 dark:text-slate-400">
            Số hóa đơn:{" "}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {sale.einvoice_number}
          </span>
        </div>

        <div>
          <span className="text-slate-600 dark:text-slate-400">
            Mã tra cứu:{" "}
          </span>
          <span className="font-mono font-medium text-slate-900 dark:text-white">
            {sale.einvoice_lookup_code}
          </span>
        </div>

        <div className="flex gap-2 mt-3">
          <a
            href={sale.einvoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-lg font-medium transition-colors"
          >
            Xem hóa đơn
          </a>

          <button
            onClick={() => window.open(sale.einvoice_url, "_blank")}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            In
          </button>
        </div>
      </div>
    </div>
  );
}
```

### **Phase 4: Testing (1 tuần)**

#### 4.1. Test Cases

- [ ] Tạo hóa đơn thành công
- [ ] Hiển thị hóa đơn trong chi tiết đơn hàng
- [ ] Gửi email hóa đơn cho khách hàng
- [ ] Xem/in hóa đơn điện tử
- [ ] Hủy hóa đơn (nếu cần)
- [ ] Xử lý lỗi khi API không khả dụng
- [ ] Test với dữ liệu thực

#### 4.2. User Acceptance Testing

- Nhân viên bán hàng test quy trình
- Kiểm tra email gửi khách hàng
- Xác nhận hóa đơn hiển thị đúng

### **Phase 5: Production Deployment (2-3 ngày)**

#### 5.1. Pre-deployment

- [ ] Backup database
- [ ] Chạy migration SQL
- [ ] Cấu hình production API keys
- [ ] Setup monitoring/logging

#### 5.2. Deployment

- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Smoke testing
- [ ] Thông báo người dùng

#### 5.3. Post-deployment

- [ ] Monitor error rates
- [ ] Kiểm tra email delivery
- [ ] Thu thập feedback người dùng

## 💰 CHI PHÍ ƯỚC TÍNH

### 1. Chi phí dịch vụ (hàng năm)

| Gói   | Số hóa đơn/tháng | Giá/năm       | Phù hợp với                     |
| ----- | ---------------- | ------------- | ------------------------------- |
| Start | 100              | 300,000 VNĐ   | Cửa hàng nhỏ (3-4 hóa đơn/ngày) |
| Basic | 300              | 500,000 VNĐ   | Cửa hàng vừa (10 hóa đơn/ngày)  |
| Pro   | 1,000            | 1,200,000 VNĐ | Cửa hàng lớn (30+ hóa đơn/ngày) |

**Khuyến nghị:** Bắt đầu với gói **Start** (300k/năm)

### 2. Chi phí phát triển

- Phase 3 (Development): ~2-3 tuần làm việc
- Nếu thuê ngoài: 15-25 triệu VNĐ
- Nếu tự làm: Miễn phí (có code mẫu)

### 3. Tổng chi phí năm đầu

- Dịch vụ: 300,000 - 1,200,000 VNĐ
- Phát triển: 0 - 25,000,000 VNĐ
- **TỔNG: ~300k - 26.2 triệu VNĐ**

## 📞 LIÊN HỆ NHÀ CUNG CẤP

### VNPT Invoice (KHUYẾN NGHỊ)

- **Website:** https://vnpt-invoice.vn
- **Hotline:** 1900 8000
- **Email:** support@vnptinvoice.vn
- **Địa chỉ:** 57 Huỳnh Thúc Kháng, Đống Đa, Hà Nội

### Viettel Invoice

- **Website:** https://sinvoice.viettel.vn
- **Hotline:** 18008000
- **Email:** sinvoice@viettel.vn

### FPT Invoice

- **Website:** https://ehoadon.fpt.vn
- **Hotline:** 1900 6493
- **Email:** ehoadon@fpt.vn

## 🎯 LỢI ÍCH KHI TRIỂN KHAI

### Cho doanh nghiệp:

✅ Tuân thủ pháp luật (bắt buộc từ 1/7/2022)
✅ Giảm rủi ro vi phạm thuế
✅ Tự động hóa báo cáo thuế
✅ Tiết kiệm chi phí in ấn
✅ Tra cứu dễ dàng
✅ Nâng cao uy tín

### Cho khách hàng:

✅ Nhận hóa đơn qua email ngay lập tức
✅ Tra cứu online mọi lúc
✅ Hợp pháp để kê khai thuế (khách doanh nghiệp)
✅ Bảo quản lâu dài (không mất/rách)

## ⚠️ LƯU Ý QUAN TRỌNG

1. **Thời điểm triển khai:**

   - Nên triển khai vào đầu quý/đầu tháng
   - Tránh triển khai cuối tháng (mùa cao điểm)

2. **Đào tạo nhân viên:**

   - Hướng dẫn quy trình mới
   - Xử lý lỗi khi không có internet
   - Cách hủy/điều chỉnh hóa đơn

3. **Backup:**

   - Luôn backup database trước khi triển khai
   - Test kỹ trên môi trường staging

4. **Fallback plan:**
   - Nếu API lỗi, vẫn tạo được đơn hàng
   - Có thể tạo hóa đơn bù sau
   - Thông báo rõ ràng cho khách hàng

## 📚 TÀI LIỆU THAM KHẢO

- [Quy định về hóa đơn điện tử - Tổng cục Thuế](https://www.gdt.gov.vn)
- [Nghị định 123/2020/NĐ-CP](https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Nghi-dinh-123-2020-ND-CP-hoa-don-chung-tu-461102.aspx)
- [Thông tư 78/2021/TT-BTC](https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Thong-tu-78-2021-TT-BTC-huong-dan-Nghi-dinh-123-2020-ND-CP-hoa-don-chung-tu-491284.aspx)
- [API Documentation - VNPT Invoice](https://vnpt-invoice.vn/api-docs)

## 📋 CHECKLIST TRIỂN KHAI

### Chuẩn bị

- [ ] Có giấy phép kinh doanh
- [ ] Có mã số thuế
- [ ] Có tài khoản ngân hàng
- [ ] Có thông tin đại diện pháp lý

### Đăng ký dịch vụ

- [ ] Đăng ký tài khoản VNPT Invoice
- [ ] Chuẩn bị hồ sơ
- [ ] Ký hợp đồng
- [ ] Thanh toán phí dịch vụ
- [ ] Nhận API credentials

### Phát triển

- [ ] Chạy migration SQL
- [ ] Cập nhật code backend
- [ ] Cập nhật code frontend
- [ ] Cấu hình trong Settings
- [ ] Test kết nối API

### Testing

- [ ] Test tạo hóa đơn thành công
- [ ] Test gửi email
- [ ] Test xem/in hóa đơn
- [ ] Test xử lý lỗi
- [ ] UAT với người dùng

### Deployment

- [ ] Backup database
- [ ] Deploy lên production
- [ ] Smoke testing
- [ ] Thông báo người dùng
- [ ] Monitor trong 1 tuần

### Training

- [ ] Đào tạo nhân viên bán hàng
- [ ] Tài liệu hướng dẫn
- [ ] Video tutorial
- [ ] Q&A session

---

**Người soạn:** GitHub Copilot
**Ngày:** 11/12/2025
**Version:** 1.0
