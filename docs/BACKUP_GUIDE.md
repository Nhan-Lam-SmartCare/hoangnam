# Hướng dẫn Backup và Khôi phục Dữ liệu

> **Motocare Version**: 1.3.0  
> **Database**: Supabase PostgreSQL  
> **Cập nhật**: 23/11/2025

---

## 📋 Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Chiến lược Backup](#2-chiến-lược-backup)
3. [Auto Backup với Supabase](#3-auto-backup-với-supabase)
4. [Manual Backup](#4-manual-backup)
5. [Khôi phục Dữ liệu](#5-khôi-phục-dữ-liệu)
6. [Export/Import Scripts](#6-exportimport-scripts)
7. [Best Practices](#7-best-practices)
8. [Disaster Recovery](#8-disaster-recovery)
9. [FAQs](#9-faqs)

---

## 1. Giới thiệu

### 1.1 Tại sao cần Backup?

Backup dữ liệu bảo vệ bạn khỏi:

- ❌ **Lỗi người dùng**: Xóa nhầm, cập nhật sai
- ❌ **Lỗi hệ thống**: Crash, corruption
- ❌ **Tấn công**: Ransomware, hacking
- ❌ **Thiên tai**: Mất điện, hỏng server

### 1.2 Quy tắc 3-2-1

✅ **3** bản copy  
✅ **2** loại media khác nhau (Cloud + Local)  
✅ **1** bản offsite (ngoài văn phòng)

---

## 2. Chiến lược Backup

### 2.1 Full Backup (Toàn bộ)

**Khi nào**: Hàng tuần (Chủ nhật 2:00 AM)

**Bao gồm**:

- Tất cả bảng dữ liệu
- Schema (cấu trúc)
- Functions, triggers
- Roles và permissions

**Dung lượng**: ~50-500 MB (tùy quy mô)

### 2.2 Incremental Backup (Tăng dần)

**Khi nào**: Hàng ngày (2:00 AM)

**Bao gồm**: Chỉ dữ liệu thay đổi từ lần backup trước

**Ưu điểm**: Nhanh, ít dung lượng

### 2.3 Differential Backup

**Khi nào**: Mỗi 6 tiếng

**Bao gồm**: Dữ liệu thay đổi kể từ Full Backup cuối

---

## 3. Auto Backup với Supabase

### 3.1 Supabase Automatic Backups

**Free Tier**:

- ✅ Daily backups (7 ngày gần nhất)
- ✅ Point-in-time recovery (PITR): Không có

**Pro Plan** ($25/month):

- ✅ Daily backups (30 ngày)
- ✅ PITR: 7 ngày
- ✅ Custom schedules

### 3.2 Kiểm tra Backup Schedule

**Bước 1**: Đăng nhập [Supabase Dashboard](https://app.supabase.com)

**Bước 2**: Chọn project **Motocare**

**Bước 3**: Menu **Database** → **Backups**

**Bước 4**: Xem danh sách backups:

```
✅ 2025-11-23 02:00:00   Full Backup   120 MB
✅ 2025-11-22 02:00:00   Full Backup   118 MB
✅ 2025-11-21 02:00:00   Full Backup   115 MB
```

### 3.3 Tạo Manual Backup trên Supabase

**Bước 1**: Dashboard → **Database** → **Backups**

**Bước 2**: Click **"Create a backup"**

**Bước 3**: Nhập tên backup (ví dụ: `before-major-update`)

**Bước 4**: Click **"Create"**

**Bước 5**: Đợi 1-5 phút (tùy kích thước DB)

> ✅ **Thành công**: Backup xuất hiện trong danh sách

---

## 4. Manual Backup

### 4.1 Backup qua pg_dump

**Yêu cầu**:

- PostgreSQL client (`pg_dump`) đã cài
- Connection string từ Supabase

**Lấy Connection String**:

1. Supabase Dashboard → **Settings** → **Database**
2. Copy **Connection string** (URI)
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```

**Command Backup**:

```powershell
# Full backup
pg_dump "postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres" > backup_20251123.sql

# Backup với compress
pg_dump -Fc "postgresql://..." > backup_20251123.dump

# Backup chỉ schema (không có data)
pg_dump --schema-only "postgresql://..." > schema_20251123.sql

# Backup chỉ data (không có schema)
pg_dump --data-only "postgresql://..." > data_20251123.sql
```

**Trên Windows PowerShell**:

```powershell
# Đặt biến môi trường
$env:PGPASSWORD = "your-password"

# Backup
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
  -h db.xxx.supabase.co `
  -U postgres `
  -d postgres `
  -f "C:\Backups\motocare_20251123.sql"
```

### 4.2 Backup qua Supabase API

**Script Node.js**:

```javascript
// scripts/maintenance/backup-database.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service key!
);

async function backupTable(tableName) {
  const { data, error } = await supabase.from(tableName).select("*");

  if (error) {
    console.error(`❌ Error backing up ${tableName}:`, error);
    return;
  }

  const filename = `backup_${tableName}_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`✅ Backed up ${tableName}: ${data.length} rows → ${filename}`);
}

async function backupAll() {
  const tables = [
    "parts",
    "sales",
    "sale_items",
    "work_orders",
    "customers",
    "inventory_transactions",
    "payment_sources",
    "financial_transactions",
    "profiles",
    "branches",
  ];

  for (const table of tables) {
    await backupTable(table);
  }

  console.log("🎉 Full backup completed!");
}

backupAll();
```

**Chạy script**:

```powershell
node scripts/maintenance/backup-database.mjs
```

### 4.3 Backup qua Excel Export

**Trong ứng dụng**:

1. Menu **"Cài đặt"** → **"Xuất dữ liệu"**
2. Chọn bảng: `parts`, `sales`, `customers`, v.v.
3. Click **"Xuất Excel"**
4. Lưu vào thư mục an toàn

**Ưu điểm**: Dễ dùng, không cần technical knowledge

**Nhược điểm**: Không backup relationships, functions

---

## 5. Khôi phục Dữ liệu

### 5.1 Khôi phục từ Supabase Backup

**Bước 1**: Dashboard → **Database** → **Backups**

**Bước 2**: Tìm backup cần restore

**Bước 3**: Click **"..."** → **"Restore"**

**Bước 4**: Xác nhận:

```
⚠️ Warning: This will overwrite your current database.
Are you sure?
```

**Bước 5**: Click **"Yes, Restore"**

**Bước 6**: Đợi 5-15 phút

> ⚠️ **Lưu ý**: Database sẽ bị offline trong quá trình restore

### 5.2 Khôi phục từ pg_dump file

**Command**:

```powershell
# Restore từ .sql file
psql "postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres" < backup_20251123.sql

# Restore từ .dump file (compressed)
pg_restore -d "postgresql://..." backup_20251123.dump

# Restore chỉ một bảng cụ thể
pg_restore -d "postgresql://..." -t sales backup_20251123.dump
```

**Trên Windows**:

```powershell
$env:PGPASSWORD = "your-password"

& "C:\Program Files\PostgreSQL\16\bin\psql.exe" `
  -h db.xxx.supabase.co `
  -U postgres `
  -d postgres `
  -f "C:\Backups\motocare_20251123.sql"
```

### 5.3 Khôi phục từ JSON backups

**Script Node.js**:

```javascript
// scripts/maintenance/restore-from-json.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restoreTable(tableName, filename) {
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));

  // Xóa dữ liệu cũ (cẩn thận!)
  await supabase
    .from(tableName)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  // Insert dữ liệu mới
  const { error } = await supabase.from(tableName).insert(data);

  if (error) {
    console.error(`❌ Error restoring ${tableName}:`, error);
  } else {
    console.log(`✅ Restored ${tableName}: ${data.length} rows`);
  }
}

// Restore một bảng
restoreTable("parts", "backup_parts_1732348800000.json");
```

### 5.4 Point-in-Time Recovery (PITR)

**Chỉ dành cho Pro plan**

**Bước 1**: Dashboard → **Database** → **Backups** → **PITR**

**Bước 2**: Chọn thời điểm:

```
Date: 2025-11-23
Time: 14:30:00
```

**Bước 3**: Click **"Restore to this point"**

**Use case**: Khôi phục trước khi có lỗi xảy ra (ví dụ: xóa nhầm 100 đơn hàng lúc 15:00, restore về 14:30)

---

## 6. Export/Import Scripts

### 6.1 Export tất cả bảng

**Script**:

```javascript
// scripts/maintenance/export-all-tables.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLES = [
  "parts",
  "sales",
  "sale_items",
  "work_orders",
  "work_order_items",
  "customers",
  "inventory_transactions",
  "payment_sources",
  "financial_transactions",
  "profiles",
  "branches",
  "debts",
];

async function exportAllTables() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = `backups/backup_${timestamp}`;

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select("*");

      if (error) throw error;

      const filename = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));

      console.log(`✅ ${table}: ${data.length} rows`);
    } catch (err) {
      console.error(`❌ ${table}:`, err.message);
    }
  }

  // Tạo metadata file
  const metadata = {
    timestamp: new Date().toISOString(),
    tables: TABLES,
    version: "1.3.0",
  };
  fs.writeFileSync(
    path.join(backupDir, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  console.log(`\n🎉 Backup completed: ${backupDir}`);
}

exportAllTables();
```

**Chạy**:

```powershell
node scripts/maintenance/export-all-tables.mjs
```

**Output**:

```
backups/
  backup_2025-11-23T10-30-00-000Z/
    parts.json
    sales.json
    customers.json
    ...
    metadata.json
```

### 6.2 Import từ backup folder

**Script**:

```javascript
// scripts/maintenance/import-from-backup.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importTable(tableName, backupDir) {
  const filename = path.join(backupDir, `${tableName}.json`);

  if (!fs.existsSync(filename)) {
    console.log(`⏭️  Skipping ${tableName} (file not found)`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filename, "utf8"));

  console.log(`📥 Importing ${tableName}: ${data.length} rows...`);

  // Xóa dữ liệu cũ (CẨNN THẬN!)
  const { error: deleteError } = await supabase
    .from(tableName)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    console.error(`❌ Error deleting old data:`, deleteError);
    return;
  }

  // Insert dữ liệu mới (batch 100 rows)
  for (let i = 0; i < data.length; i += 100) {
    const batch = data.slice(i, i + 100);
    const { error } = await supabase.from(tableName).insert(batch);

    if (error) {
      console.error(`❌ Error inserting batch ${i}-${i + 100}:`, error);
      break;
    }

    console.log(`   ✅ ${i}-${Math.min(i + 100, data.length)}/${data.length}`);
  }

  console.log(`✅ ${tableName} imported successfully`);
}

async function importFromBackup(backupDir) {
  const metadataFile = path.join(backupDir, "metadata.json");

  if (!fs.existsSync(metadataFile)) {
    console.error("❌ metadata.json not found in backup folder");
    return;
  }

  const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
  console.log(`📦 Restoring backup from ${metadata.timestamp}`);

  for (const table of metadata.tables) {
    await importTable(table, backupDir);
  }

  console.log("\n🎉 Import completed!");
}

// Usage: node import-from-backup.mjs backups/backup_2025-11-23T10-30-00-000Z
const backupDir = process.argv[2];
if (!backupDir) {
  console.error("Usage: node import-from-backup.mjs <backup-folder>");
  process.exit(1);
}

importFromBackup(backupDir);
```

**Chạy**:

```powershell
node scripts/maintenance/import-from-backup.mjs backups/backup_2025-11-23T10-30-00-000Z
```

---

## 7. Best Practices

### 7.1 Lịch Backup

| Loại              | Tần suất          | Retention |
| ----------------- | ----------------- | --------- |
| **Auto Daily**    | 2:00 AM           | 7 ngày    |
| **Weekly Full**   | Chủ nhật 2:00 AM  | 4 tuần    |
| **Monthly**       | Ngày 1 hàng tháng | 12 tháng  |
| **Before Update** | Manual            | Permanent |

### 7.2 Kiểm tra Backup

**Hàng tuần**:

1. Restore backup vào test database
2. Verify data integrity
3. Test critical functions

**Script test**:

```powershell
# Test restore
pg_restore -d test_db backup.dump

# Query test
psql test_db -c "SELECT COUNT(*) FROM sales;"
```

### 7.3 Lưu trữ Backup

**Local**:

- `C:\Backups\Motocare\` (Windows)
- External HDD (backup hàng tuần)

**Cloud**:

- Google Drive / OneDrive
- AWS S3 (long-term storage)

**Offsite**:

- USB drive ở nhà chủ shop
- Cloud storage với encryption

### 7.4 Bảo mật Backup

✅ **Encrypt backups**: Use `gpg` hoặc `7zip` với password

```powershell
# Encrypt với 7zip
7z a -p -mhe=on backup_encrypted.7z backup.sql
```

✅ **Giới hạn quyền truy cập**: Chỉ Owner có quyền restore

✅ **Test backups định kỳ**: Ensure recoverability

---

## 8. Disaster Recovery

### 8.1 Kịch bản 1: Xóa nhầm dữ liệu

**Tình huống**: Xóa nhầm 50 đơn hàng

**Giải pháp**:

1. Stop ngay, không làm gì thêm
2. Restore từ backup gần nhất (PITR nếu có)
3. Verify dữ liệu đã về
4. Resume operations

**Thời gian**: 5-15 phút

### 8.2 Kịch bản 2: Database corruption

**Tình huống**: Database bị lỗi, không truy cập được

**Giải pháp**:

1. Liên hệ Supabase Support ngay
2. Restore từ latest backup
3. Nhập lại dữ liệu mới (sau lần backup)

**Thời gian**: 30-60 phút

### 8.3 Kịch bản 3: Mất Supabase account

**Tình huống**: Account bị hack/xóa

**Giải pháp**:

1. Restore từ local backups
2. Tạo Supabase project mới
3. Import dữ liệu từ backups
4. Update `.env.local` với credentials mới

**Thời gian**: 1-2 giờ

### 8.4 Kịch bản 4: Complete data loss

**Tình huống**: Mất tất cả backups (cực kỳ hiếm)

**Giải pháp**:

1. Khôi phục từ Excel exports (nếu có)
2. Nhập lại dữ liệu manually
3. Liên hệ Supabase recovery team

**Thời gian**: Nhiều ngày

---

## 9. FAQs

### Q1: Backup có làm chậm hệ thống không?

**A**: Không. Auto backups chạy lúc 2:00 AM (ít người dùng). Manual backups có thể hơi chậm nhưng không ảnh hưởng nhiều.

### Q2: Backup free tier có đủ không?

**A**: Đủ cho shop nhỏ. Nếu dữ liệu quan trọng, nên upgrade Pro ($25/tháng) để có PITR.

### Q3: Làm sao biết backup thành công?

**A**: Kiểm tra Supabase Dashboard → Backups. Nếu có danh sách backups với timestamps gần đây = thành công.

### Q4: Backup có bao gồm uploaded files không?

**A**: Database backups KHÔNG bao gồm files trong Supabase Storage. Cần backup Storage riêng.

### Q5: Restore có mất dữ liệu mới không?

**A**: CÓ. Restore sẽ overwrite database về trạng thái cũ. Dữ liệu tạo sau backup sẽ mất.

### Q6: Có thể restore một bảng cụ thể không?

**A**: Có, dùng `pg_restore -t table_name` hoặc script JSON restore.

### Q7: Backup có tốn dung lượng server không?

**A**: Không. Backups lưu trên Supabase servers, không tính vào dung lượng project.

### Q8: Nên backup bao lâu một lần?

**A**:

- Hàng ngày (auto): Essential
- Hàng tuần (manual): Recommended
- Trước update lớn: Critical

### Q9: Backup có hết hạn không?

**A**: Free tier: 7 ngày. Pro: 30 ngày. Local backups: Permanent (tự quản lý).

### Q10: Làm sao backup khi Supabase down?

**A**: Không thể. Đó là lý do cần local backups định kỳ.

---

## 📞 Emergency Contact

**Supabase Support**: https://supabase.com/support  
**Motocare Issues**: https://github.com/Nhan-Lam-SmartCare/Motocare/issues  
**Emergency Hotline**: 0909 xxx xxx

---

## 🔗 Related Documents

- [README.md](README.md) - Setup guide
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [USER_MANUAL.md](USER_MANUAL.md) - User guide

---

**Remember: Backup is insurance. You don't need it until you REALLY need it! 💾**
