# 📱 HƯỚNG DẪN PHÁT TRIỂN & XUẤT APP ANDROID (CAPACITOR)

Tài liệu này hướng dẫn bạn cách đồng bộ mã nguồn, chạy thử nghiệm trên thiết bị di động và xuất file cài đặt APK (`.apk`) cho ứng dụng **Motocare Pro** từ dự án Capacitor vừa được thiết lập.

---

## 🛠️ 1. Yêu cầu chuẩn bị (Chỉ cần làm 1 lần duy nhất)

Để chạy và biên dịch ứng dụng Android, máy tính của bạn cần cài đặt:
1. **Android Studio**: 
   - Tải về miễn phí tại: [Android Studio Website](https://developer.android.com/studio)
   - Trong quá trình cài đặt, hãy giữ các tùy chọn mặc định để tự động cài đặt **Android SDK** và **Android Virtual Device (Giả lập)**.
2. **Java JDK**: 
   - Android Studio đã đi kèm sẵn một bản JDK nội bộ ổn định nhất, nên bạn không cần cài thêm Java ngoài hệ thống.

---

## 🔄 2. Quy trình đồng bộ phát triển (Đồng bộ code từ React sang App Mobile)

Mỗi khi bạn thực hiện thay đổi mã nguồn React (giao diện, logic bán hàng, kết nối cơ sở dữ liệu...) trong thư mục `src/`, hãy thực hiện đồng bộ sang app Android theo quy trình sau:

### Bước 1: Build & Đồng bộ mã nguồn
Mở Terminal/PowerShell tại thư mục dự án (`d:\hoangnam-1`) và chạy lệnh tiện ích đã được thêm sẵn:
```powershell
npm run cap:sync
```
*Lệnh này sẽ tự động chạy biên dịch React (`npm run build`) và sao chép toàn bộ mã nguồn web mới nhất vào thư mục ứng dụng Android.*

### Bước 2: Mở dự án trong Android Studio
Để mở dự án Android native trong Android Studio và chuẩn bị chạy hoặc build APK, hãy chạy:
```powershell
npm run cap:open
```
*Android Studio sẽ tự động khởi động và mở thư mục `android` trong dự án.*

---

## 📲 3. Chạy thử nghiệm ứng dụng (Testing)

Sau khi Android Studio mở lên và hoàn thành quá trình đồng bộ Gradle (thường mất 1-2 phút trong lần đầu tiên):

### Cách A: Chạy trên thiết bị Android thật (Khuyên dùng vì có Camera để quét mã vạch)
1. Trên điện thoại Android của bạn:
   - Vào **Cài đặt** -> **Thông tin điện thoại**.
   - Nhấn 7 lần liên tục vào mục **Số phiên bản** (Build Number) để kích hoạt **Chế độ nhà phát triển**.
   - Quay lại cài đặt chính, tìm **Tùy chọn nhà phát triển** (Developer Options) và bật **Gỡ lỗi USB** (USB Debugging).
2. Kết nối điện thoại với máy tính bằng cáp USB.
3. Trong Android Studio, ở thanh công cụ phía trên, bạn sẽ nhìn thấy tên điện thoại của mình xuất hiện tại ô lựa chọn thiết bị.
4. Nhấn nút **Run** (biểu tượng nút Play màu xanh lá `▶`) hoặc nhấn `Shift + F10` để tự động biên dịch ứng dụng và cài đặt trực tiếp lên điện thoại của bạn.

### Cách B: Chạy trên máy ảo giả lập (Emulator)
1. Trong Android Studio, nhấp vào biểu tượng **Device Manager** ở thanh công cụ bên phải.
2. Chọn **Create Device**, chọn dòng điện thoại bất kỳ (ví dụ: Pixel 6) và tải về phiên bản hệ điều hành Android mong muốn.
3. Nhấp nút Play của máy ảo để khởi động máy ảo.
4. Nhấn nút **Run** `▶` để cài app lên máy ảo.

---

## 📦 4. Xuất file cài đặt APK (`.apk`)

Khi bạn muốn gửi file cài đặt cho nhân viên hoặc cài đặt thủ công lên máy tính bảng/điện thoại Android khác:

### Cách xuất APK chạy thử nghiệm (Debug APK)
*File này không cần ký số bảo mật, dùng để cài đặt thử nghiệm nhanh giữa các máy.*
1. Tại thanh menu của Android Studio, chọn: **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
2. Chờ Android Studio biên dịch trong khoảng 1-2 phút.
3. Khi hoàn thành, một thông báo nhỏ xuất hiện ở góc dưới bên phải. Nhấn vào **locate** để mở thư mục chứa file `app-debug.apk` vừa tạo.
4. Gửi file `app-debug.apk` này sang điện thoại Android của bạn để cài đặt trực tiếp.

### Cách xuất APK phát hành chính thức (Release APK)
*Thích hợp khi đưa lên Google Play Store hoặc cài đặt phiên bản chính thức, tối ưu hóa dung lượng nhẹ hơn.*
1. Chọn **Build** -> **Generate Signed Bundle / APK...**.
2. Chọn **APK** và nhấn **Next**.
3. Tại mục **Key store path**:
   - Nếu đã có Key store, chọn đường dẫn.
   - Nếu chưa có, nhấn **Create new...** để tạo mới một chứng chỉ ký số (nhập các thông tin mật khẩu, tên của bạn, ghi nhớ mật khẩu này cho các lần cập nhật tiếp theo).
4. Chọn **Build Variant** là `release`.
5. Chọn **V4 (Signature)** nếu có hoặc các tùy chọn ký mặc định, nhấn **Finish**.
6. Khi hoàn thành, nhấn **locate** trong thông báo để nhận file `app-release.apk` chính thức.

---

## ⚙️ 5. Thông tin cấu hình kỹ thuật

- **Tên hiển thị ứng dụng**: Motocare Pro (cấu hình trong `capacitor.config.ts`).
- **Application ID (Package Name)**: `com.motocarepro.standalone` (định danh duy nhất trên Android).
- **Quyền hạn (Permissions)**: 
  - Quyền truy cập **Internet** (`android.permission.INTERNET`) đã được bật mặc định.
  - Quyền sử dụng **Camera** (`android.permission.CAMERA`) đã được thiết lập sẵn trong `AndroidManifest.xml` nhằm phục vụ tính năng quét mã QR / mã vạch phụ tùng.
- **Trạng thái kết nối dữ liệu**: App mobile sử dụng API HTTPS để kết nối trực tiếp với Supabase Database của bạn, bảo mật hoàn toàn thông qua Row Level Security (RLS) đã cấu hình trên cơ sở dữ liệu.
