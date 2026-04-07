# 🔐 HƯỚNG DẪN SETUP AUTHENTICATION - MOTOCARE

## 📋 Tổng quan

Đã implement xong **Authentication System** với các tính năng:

### ✅ Đã hoàn thành:

1. **LoginPage** - Giao diện đăng nhập đẹp với dark mode
2. **AuthContext** - Quản lý state authentication với Supabase
3. **ProtectedRoute** - Bảo vệ routes, redirect nếu chưa login
4. **RBAC System** - 3 roles: owner, manager, staff
5. **Database Schema** - Tables: user_profiles, store_settings, audit_logs
6. **SettingsManager** - UI quản lý thông tin cửa hàng

---

## 🚀 BƯỚC 1: Setup Supabase

### 1.1. Chạy SQL Schema

1. Mở Supabase Dashboard: https://app.supabase.com
2. Chọn project của bạn
3. Vào **SQL Editor**
4. Copy toàn bộ nội dung file `auth_setup.sql`
5. Paste vào editor và click **Run**

### 1.2. Tạo Demo Users

1. Vào **Authentication > Users** trong Supabase Dashboard
2. Click **Add user** và tạo 3 users:

```
👑 Owner:
- Email: owner@motocare.vn
- Password: 123456
- Auto Confirm Email: ✅

👨‍💼 Manager:
- Email: manager@motocare.vn
- Password: 123456
- Auto Confirm Email: ✅

👤 Staff:
- Email: staff@motocare.vn
- Password: 123456
- Auto Confirm Email: ✅
```

### 1.3. Cập nhật Roles

Sau khi tạo xong users, vào **SQL Editor** và chạy:

```sql
-- Cập nhật roles cho demo users
UPDATE user_profiles
SET role = 'owner', full_name = 'Nguyễn Văn A'
WHERE email = 'owner@motocare.vn';

UPDATE user_profiles
SET role = 'manager', full_name = 'Trần Thị B'
WHERE email = 'manager@motocare.vn';

UPDATE user_profiles
SET role = 'staff', full_name = 'Lê Văn C'
WHERE email = 'staff@motocare.vn';
```

---

## 🚀 BƯỚC 2: Tích hợp vào App.tsx

### 2.1. Cập nhật App.tsx

Thay đổi `src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AppProvider } from "./contexts/AppContext";
import { LoginPage } from "./components/auth/LoginPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppMotocare } from "./standalone/AppMotocare";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppMotocare />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
```

### 2.2. Thêm Settings vào Navigation

Trong `AppMotocare.tsx`, thêm Settings vào menu:

```typescript
// Import SettingsManager
import { SettingsManager } from "../components/settings/SettingsManager";

// Thêm vào navItems
const navItems = [
  // ... existing items
  { id: "settings", label: "Cài đặt", icon: "⚙️" },
];

// Thêm vào renderContent()
case "settings":
  return <SettingsManager />;
```

---

## 🚀 BƯỚC 3: Thêm Logout Button

### 3.1. Tạo UserMenu Component

Tạo file `src/components/common/UserMenu.tsx`:

```typescript
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";

export const UserMenu = () => {
  const { profile, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      showToast.success("Đã đăng xuất");
    } catch (error) {
      showToast.error("Không thể đăng xuất");
    }
  };

  if (!profile) return null;

  const roleLabels = {
    owner: "👑 Chủ cửa hàng",
    manager: "👨‍💼 Quản lý",
    staff: "👤 Nhân viên",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
          {profile.full_name?.[0] || profile.email[0].toUpperCase()}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-sm font-medium text-slate-900 dark:text-white">
            {profile.full_name || profile.email}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {roleLabels[profile.role]}
          </div>
        </div>
        <svg
          className="w-4 h-4 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-20">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              🚪 Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  );
};
```

### 3.2. Thêm UserMenu vào AppMotocare

Trong `AppMotocare.tsx`, thêm UserMenu vào header:

```typescript
import { UserMenu } from "../components/common/UserMenu";

// Trong JSX, thêm vào header:
<div className="flex items-center gap-4">
  <ThemeToggle /> {/* Nút chế độ sáng/tối */}
  <UserMenu /> {/* User menu mới */}
</div>;
```

---

## 🧪 BƯỚC 4: Test Authentication

### 4.1. Test Login Flow

1. Chạy app: `npm run dev`
2. Truy cập `http://localhost:4311`
3. Sẽ redirect tự động về `/login`
4. Đăng nhập với:
   - Email: `owner@motocare.vn`
   - Password: `123456`
5. Sau khi login thành công → Redirect về dashboard

### 4.2. Test Role-Based Access

**Owner** có quyền:

- ✅ Xem tất cả modules
- ✅ Chỉnh sửa Settings
- ✅ Xem audit logs
- ✅ Quản lý users

**Manager** có quyền:

- ✅ Xem tất cả modules
- ✅ Xem Settings (không chỉnh sửa)
- ❌ Không xem audit logs
- ❌ Không quản lý users

**Staff** có quyền:

- ✅ Xem các module cơ bản
- ❌ Không xem Settings
- ❌ Không xem báo cáo tài chính
- ❌ Không xem audit logs

### 4.3. Test Protected Routes

1. Logout
2. Thử truy cập trực tiếp `http://localhost:4311/`
3. Sẽ redirect về `/login`
4. Login lại → Quay về trang trước đó

### 4.4. Test Settings Manager

1. Login với account **owner**
2. Click "⚙️ Cài đặt"
3. Điền thông tin cửa hàng:
   - Tên: Nhân Lâm SmartCare
   - Địa chỉ: 123 ABC, Q.1, HCM
   - Phone: 0901234567
   - Etc.
4. Click "💾 Lưu thay đổi"
5. Refresh page → Thông tin vẫn lưu

---

## 📊 KIẾN TRÚC HỆ THỐNG

```
┌─────────────────────────────────────────────┐
│              AUTHENTICATION FLOW            │
└─────────────────────────────────────────────┘

   Browser                 App                Supabase
      │                     │                     │
      │────── Access / ─────>│                     │
      │                     │                     │
      │                     │─── getSession() ──>│
      │                     │<─── user/null ─────│
      │                     │                     │
      │<─ Show Login Page ──│                     │
      │                     │                     │
      │─ Submit Credentials>│                     │
      │                     │─ signInWithPassword>│
      │                     │<─── session + user ─│
      │                     │                     │
      │                     │─ loadUserProfile ──>│
      │                     │<─ user_profiles ────│
      │                     │                     │
      │<─ Navigate to / ────│                     │
      │                     │                     │
      │                     │◄─ onAuthStateChange │
      │                     │   (realtime updates)│
      │                     │                     │
```

---

## 🔐 SECURITY BEST PRACTICES

### ✅ Đã implement:

1. **Row Level Security (RLS)** - Supabase tables có RLS policies
2. **JWT Authentication** - Supabase auth tokens
3. **Role-based permissions** - 3 roles với quyền khác nhau
4. **Protected routes** - Redirect nếu chưa login
5. **Auto profile creation** - Trigger tạo profile khi signup
6. **Audit logging** - Track sensitive actions

### ⚠️ Cần làm thêm (Production):

1. **Email verification** - Bắt verify email khi signup
2. **2FA (Two-Factor Auth)** - Thêm layer bảo mật
3. **Strong passwords** - Enforce password policy
4. **Rate limiting** - Chống brute-force
5. **Session timeout** - Auto logout sau 24h
6. **HTTPS only** - Deploy với SSL certificate

---

## 🎯 PERMISSION MATRIX

| Feature         | Owner     | Manager   | Staff |
| --------------- | --------- | --------- | ----- |
| Dashboard       | ✅        | ✅        | ✅    |
| Sales           | ✅        | ✅        | ✅    |
| Service         | ✅        | ✅        | ✅    |
| Inventory       | ✅        | ✅        | ❌    |
| Finance         | ✅        | ✅        | ❌    |
| Reports         | ✅        | ✅        | ❌    |
| Settings        | ✅ (edit) | ✅ (view) | ❌    |
| User Management | ✅        | ❌        | ❌    |
| Audit Logs      | ✅        | ❌        | ❌    |

---

## 🐛 TROUBLESHOOTING

### Lỗi: "Cannot find module 'AuthContext'"

**Fix:** Kiểm tra import path, phải là `../../contexts/AuthContext`

### Lỗi: "User profiles table doesn't exist"

**Fix:** Chạy lại `auth_setup.sql` trong Supabase SQL Editor

### Lỗi: "Permission denied for relation user_profiles"

**Fix:** Kiểm tra RLS policies trong Supabase Dashboard

### Login không chuyển trang

**Fix:** Kiểm tra `BrowserRouter` wrap đúng và routes setup đúng

### Token expired

**Fix:** Supabase auto refresh tokens, nhưng nếu lỗi thì logout và login lại

---

## 📝 NEXT STEPS

### Phase B: Advanced Features

1. **User Management UI** - Owners có thể thêm/xóa/sửa users
2. **Activity Log** - Hiển thị audit logs
3. **Permission Customization** - Tùy chỉnh quyền chi tiết hơn
4. **Multi-branch Access** - Users thuộc branch nào thì chỉ xem data branch đó
5. **Profile Settings** - Users tự đổi tên, avatar, password

### Phase C: Store Settings Integration

1. **Inject store info vào invoices** - Logo, địa chỉ, bank info
2. **Dynamic invoice prefixes** - Dùng setting thay vì hardcode
3. **Custom branding** - Apply primary_color vào UI

---

## ✅ CHECKLIST TRƯỚC KHI DEPLOY

- [ ] Chạy `auth_setup.sql` trong Supabase
- [ ] Tạo 3 demo users
- [ ] Update roles cho users
- [ ] Test login/logout flow
- [ ] Test role permissions
- [ ] Test settings manager
- [ ] Thêm UserMenu vào header
- [ ] Test protected routes
- [ ] Verify RLS policies
- [ ] Enable email verification (production)
- [ ] Setup 2FA (production)
- [ ] Configure password policy (production)

---

**Hệ thống Authentication đã sẵn sàng! 🎉**

Bắt đầu test ngay nhé! Nếu có vấn đề gì, báo để mình fix.
