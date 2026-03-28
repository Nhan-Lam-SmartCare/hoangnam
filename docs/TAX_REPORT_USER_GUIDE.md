# 📊 HƯỚNG DẪN XUẤT BÁO CÁO THUẾ - MOTOCARE

## 🎯 TỔNG QUAN

Tính năng này cho phép xuất báo cáo thuế theo định dạng XML chuẩn Tổng cục Thuế Việt Nam, giúp bạn dễ dàng kê khai thuế mà **không cần chi phí dịch vụ hóa đơn điện tử**.

### ✅ Các loại báo cáo hỗ trợ:

1. **Tờ khai VAT (01/GTGT)** - Kê khai thuế giá trị gia tăng theo tháng/quý
2. **Báo cáo doanh thu** - Chi tiết doanh thu bán hàng và dịch vụ

---

## 📋 BƯỚC 1: CHUẨN BỊ

### 1.1. Chạy migration SQL

Trước tiên, cần cập nhật cơ sở dữ liệu:

```bash
# Chạy file migration
cd Motocare
psql -U your_user -d your_database -f sql/2025-12-11_tax_info_schema.sql
```

Hoặc trên Supabase Dashboard:

1. Vào **SQL Editor**
2. Mở file `sql/2025-12-11_tax_info_schema.sql`
3. Chạy toàn bộ script

### 1.2. Cập nhật thông tin doanh nghiệp

Vào **Settings > Organization** và điền đầy đủ thông tin:

#### Thông tin bắt buộc:

- ✅ **Mã số thuế** (Tax Code)
- ✅ **Tên doanh nghiệp**
- ✅ **Địa chỉ**
- ✅ **Số điện thoại**
- ✅ **Email**

#### Thông tin thuế:

- ✅ **Cơ quan thuế quản lý** (VD: Cục Thuế TP.HCM)
- ✅ **Chi cục thuế** (VD: Chi cục Thuế Quận 1)
- ✅ **Người đại diện pháp luật**
- ✅ **Kế toán trưởng** (tên và SĐT)

**Lưu ý:** Thông tin này sẽ được in trong file XML báo cáo thuế.

---

## 📊 BƯỚC 2: XUẤT BÁO CÁO THUẾ

### 2.1. Truy cập trang xuất báo cáo

Vào menu: **Tài chính & Báo cáo > Báo cáo thuế**

Hoặc truy cập trực tiếp: `#/tax-report`

### 2.2. Chọn cấu hình báo cáo

#### Loại báo cáo:

- **Tờ khai VAT (01/GTGT)**: Dùng để kê khai thuế GTGT hàng tháng/quý
- **Báo cáo doanh thu**: Dùng để theo dõi doanh thu chi tiết

#### Kỳ báo cáo:

- **Theo tháng**: Chọn tháng cụ thể (VD: Tháng 12/2025)
- **Theo quý**: Chọn quý (Q1, Q2, Q3, Q4)

#### Năm:

- Chọn năm báo cáo (2023-2026)

### 2.3. Kiểm tra tổng quan dữ liệu

Sau khi chọn kỳ, hệ thống sẽ hiển thị:

- **Số giao dịch**: Tổng số hóa đơn bán hàng + dịch vụ
- **Doanh thu chưa VAT**: Tổng tiền hàng (chưa thuế)
- **Thuế VAT**: Tổng thuế GTGT (10%)

**Kiểm tra kỹ các con số này trước khi xuất!**

### 2.4. Xuất file XML

1. Nhấn nút **"Xuất file XML"**
2. File XML sẽ được tải xuống máy tính
3. Tên file có dạng:
   - `ToKhai_VAT_12_2025_0123456789.xml` (tờ khai VAT)
   - `BaoCaoDoanhThu_12_2025_0123456789.xml` (báo cáo doanh thu)

---

## 🖥️ BƯỚC 3: NHẬP VÀO PHẦN MỀM KÊ KHAI THUẾ

### 3.1. Các phần mềm hỗ trợ

File XML của chúng tôi tương thích với:

✅ **HTKK (Phần mềm của Tổng cục Thuế)** - MIỄN PHÍ

- Download: https://www.gdt.gov.vn/
- Hướng dẫn: https://www.gdt.gov.vn/wps/portal/home/hdsd

✅ **MISA eTax** - Trả phí

- Website: https://www.misa.vn/etax

✅ **Fast Accounting** - Trả phí

- Website: https://www.fast.com.vn

### 3.2. Hướng dẫn nhập vào HTKK (Khuyến nghị)

#### Bước 1: Tải và cài đặt HTKK

1. Truy cập: https://www.gdt.gov.vn/
2. Tìm "Phần mềm HTKK"
3. Tải phiên bản mới nhất
4. Cài đặt theo hướng dẫn

#### Bước 2: Tạo hồ sơ doanh nghiệp

1. Mở HTKK
2. **Danh mục > Thông tin doanh nghiệp**
3. Nhập mã số thuế, tên DN, địa chỉ
4. Lưu

#### Bước 3: Import file XML

1. **Khai thuế > Thuế GTGT > Tờ khai 01/GTGT**
2. Nhấn **"Nhập từ file XML"**
3. Chọn file XML vừa xuất từ Motocare
4. Hệ thống sẽ tự động điền dữ liệu

#### Bước 4: Kiểm tra và nộp

1. Kiểm tra lại các số liệu
2. Nhấn **"Ký và gửi"** (cần có chữ ký số)
3. Hoặc **"In"** để nộp giấy

---

## 📝 BƯỚC 4: KÊ KHAI THUẾ

### 4.1. Thuế GTGT (VAT)

#### Khi nào phải kê khai?

- **Theo tháng**: Doanh nghiệp lớn (>50 tỷ/năm)
- **Theo quý**: Doanh nghiệp nhỏ (<50 tỷ/năm)

#### Hạn nộp:

- **Theo tháng**: Ngày 20 tháng sau
- **Theo quý**: Ngày 30 tháng đầu quý sau

#### Ví dụ:

- Khai tháng 12/2025 → Nộp trước 20/01/2026
- Khai Q4/2025 (T10-12) → Nộp trước 30/01/2026

### 4.2. Cách tính thuế phải nộp

```
Thuế GTGT phải nộp = Thuế đầu ra - Thuế đầu vào

Trong đó:
- Thuế đầu ra: Thuế từ hàng hóa/dịch vụ bán ra (10% doanh thu)
- Thuế đầu vào: Thuế từ hàng hóa/dịch vụ mua vào (10% chi phí)
```

**Ví dụ:**

```
Doanh thu tháng 12:     100,000,000 VNĐ
→ Thuế đầu ra:           10,000,000 VNĐ

Chi phí nhập hàng:       60,000,000 VNĐ
→ Thuế đầu vào:           6,000,000 VNĐ

Thuế phải nộp:            4,000,000 VNĐ
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

### ⚡ Về dữ liệu

1. **Kiểm tra kỹ dữ liệu trước khi xuất**

   - Đảm bảo tất cả giao dịch đã được nhập
   - Kiểm tra số liệu có khớp với sổ sách thực tế

2. **Thuế suất VAT**

   - Hiện tại app tính VAT = 10% (mặc định)
   - Nếu có sản phẩm/dịch vụ thuế suất khác (0%, 5%), cần tách riêng

3. **Thuế đầu vào**
   - Chỉ tính thuế đầu vào nếu có hóa đơn VAT hợp lệ
   - Hiện tại app tính sơ bộ từ chi phí, cần review kỹ

### 📋 Checklist trước khi nộp thuế

- [ ] Đã nhập đủ tất cả hóa đơn bán hàng
- [ ] Đã nhập đủ tất cả phiếu sửa chữa
- [ ] Đã kiểm tra số liệu với sổ sách
- [ ] Đã có hóa đơn đầu vào (nếu khai khấu trừ thuế)
- [ ] Đã kiểm tra thông tin doanh nghiệp
- [ ] File XML đã được kiểm tra trên HTKK
- [ ] Đã có chữ ký số (nếu nộp online)

### 🔒 Về bảo mật

- File XML chứa thông tin nhạy cảm (doanh thu, thuế)
- Không gửi file này qua email không mã hóa
- Chỉ import vào phần mềm chính thức
- Backup file XML định kỳ

---

## 🆘 XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi: "Không có dữ liệu trong kỳ này"

**Nguyên nhân:**

- Chưa có giao dịch nào trong tháng/quý đã chọn
- Hoặc dữ liệu bị lọc bởi chi nhánh

**Giải pháp:**

- Kiểm tra lại kỳ báo cáo
- Đảm bảo đã chọn đúng chi nhánh
- Kiểm tra dữ liệu trong Sales/Service

### Lỗi: HTKK không nhận file XML

**Nguyên nhân:**

- Format XML không đúng chuẩn
- Thiếu thông tin bắt buộc

**Giải pháp:**

1. Kiểm tra thông tin doanh nghiệp đã đầy đủ chưa
2. Đảm bảo đã chạy migration SQL
3. Mở file XML bằng notepad để kiểm tra
4. Liên hệ support nếu vẫn lỗi

### Số liệu không khớp

**Nguyên nhân:**

- Có giao dịch bị sót
- Thuế suất tính không chính xác

**Giải pháp:**

1. So sánh với báo cáo doanh thu trong app
2. Kiểm tra từng giao dịch trong kỳ
3. Đối chiếu với sổ sách kế toán
4. Tham khảo kế toán viên

---

## 📞 HỖ TRỢ

### Hỗ trợ kỹ thuật

- **Email:** support@motocare.vn
- **Hotline:** 1900 xxxx (trong giờ hành chính)

### Tài liệu tham khảo

- [Nghị định 123/2020/NĐ-CP](https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Nghi-dinh-123-2020-ND-CP-hoa-don-chung-tu-461102.aspx)
- [Thông tư 78/2021/TT-BTC](https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Thong-tu-78-2021-TT-BTC-huong-dan-Nghi-dinh-123-2020-ND-CP-hoa-don-chung-tu-491284.aspx)
- [Hướng dẫn HTKK - Tổng cục Thuế](https://www.gdt.gov.vn/)

### Tư vấn thuế

- **Tổng đài Tổng cục Thuế:** 1900 56 56 56 (24/7)
- **Hotline Chi cục Thuế:** Xem trên website cơ quan thuế địa phương

---

## 🔄 NÂNG CẤP LÊN HÓA ĐƠN ĐIỆN TỬ (TÙY CHỌN)

Khi doanh nghiệp phát triển lớn hơn, bạn có thể nâng cấp lên hệ thống hóa đơn điện tử tự động:

### Lợi ích:

- ✅ Tự động tạo hóa đơn khi bán hàng
- ✅ Gửi email hóa đơn cho khách hàng
- ✅ Báo cáo thuế tự động 100%
- ✅ Không cần nhập thủ công vào HTKK

### Chi phí:

- Từ 300,000 VNĐ/năm (100 hóa đơn/tháng)

### Xem thêm:

- Đọc file `E_INVOICE_INTEGRATION_PLAN.md` để biết chi tiết

---

## 📊 ROADMAP

### Hiện tại (Phase 1) - ✅ HOÀN THÀNH

- [x] Xuất XML tờ khai VAT
- [x] Xuất XML báo cáo doanh thu
- [x] Tính toán thuế tự động
- [x] UI thân thiện

### Phase 2 (Tương lai gần) - 🔄 ĐANG PHÁT TRIỂN

- [ ] Thêm trường MST khách hàng
- [ ] Phân loại chi phí có/không có VAT đầu vào
- [ ] Xuất báo cáo chi phí
- [ ] Export nhiều định dạng (Excel, PDF)

### Phase 3 (Dài hạn) - 📋 KẾ HOẠCH

- [ ] Tích hợp API VNPT/Viettel Invoice
- [ ] Hóa đơn điện tử tự động
- [ ] Chữ ký số
- [ ] Gửi email hóa đơn

---

## ✅ CHECKLIST SỬ DỤNG HÀNG THÁNG

### Đầu tháng (Ngày 1-5):

- [ ] Kiểm tra tất cả giao dịch tháng trước đã nhập đầy đủ
- [ ] Đối chiếu sổ quỹ với thực tế
- [ ] Review các phiếu chi có hóa đơn VAT

### Giữa tháng (Ngày 15):

- [ ] Xuất báo cáo thuế tháng trước
- [ ] Import vào HTKK
- [ ] Kiểm tra số liệu

### Trước hạn nộp (Trước ngày 20):

- [ ] Ký và nộp tờ khai thuế
- [ ] Thanh toán thuế (nếu có)
- [ ] Lưu file XML và chứng từ nộp thuế

---

**Cập nhật lần cuối:** 11/12/2025
**Phiên bản:** 1.0
**Tác giả:** Motocare Development Team
