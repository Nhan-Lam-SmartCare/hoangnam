#!/usr/bin/env node
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Script kiểm tra nhanh login + profile mapping cho 1 email.
// Usage:
// Set env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, TEST_PASS_NHAN (password của nhanxn)
// Then: node scripts/check-user.mjs

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.CHECK_USER_EMAIL || "nhanxn@gmail.com";
const password = process.env.TEST_PASS_NHAN;

if (!url || !anon) {
  console.error(
    "Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong môi trường"
  );
  process.exit(1);
}

if (!password) {
  console.error(
    "Thiếu TEST_PASS_NHAN (mật khẩu để thử đăng nhập). Set TEST_PASS_NHAN env hoặc sửa file để thêm."
  );
  process.exit(1);
}

const client = createClient(url, anon, { auth: { persistSession: false } });

async function run() {
  console.log(`Kiểm tra user: ${email}`);

  // Thử đăng nhập
  const { data: loginData, error: loginError } =
    await client.auth.signInWithPassword({
      email,
      password,
    });

  if (loginError) {
    console.error("❌ Lỗi đăng nhập:", loginError.message || loginError);
    console.log(
      "Gợi ý: kiểm tra mật khẩu, email đã được xác thực hay user có bị disabled (bằng dashboard Supabase) không."
    );
    process.exit(1);
  }

  const user = loginData.user;
  if (!user) {
    console.error("❌ Không có user sau khi đăng nhập");
    process.exit(1);
  }

  console.log("✅ Đăng nhập thành công. User ID:", user.id);
  try {
    const { data: pById, error: e1 } = await client
      .from("profiles")
      .select("id, email, role, status, allowedapps, branch_id, created_at")
      .eq("id", user.id)
      .maybeSingle();

    const { data: pByEmail, error: e2 } = await client
      .from("profiles")
      .select("id, email, role, status, allowedapps, branch_id, created_at")
      .ilike("email", email)
      .maybeSingle();

    console.log("\n--- Kết quả profile ---");
    if (e1) console.warn("Warning khi lấy profile theo id:", e1.message || e1);
    if (e2)
      console.warn("Warning khi lấy profile theo email:", e2.message || e2);

    console.log("Profile theo id:", pById ?? "(không tìm thấy)");
    console.log("Profile theo email:", pByEmail ?? "(không tìm thấy)");

    // Đưa ra đề xuất
    console.log("\n--- Đề xuất hành động ---");
    if (!pById && pByEmail) {
      console.log(
        "- Phát hiện profile tồn tại nhưng profile.id != auth.users.id (mismatch). Nên INSERT một bản profile mới với id = auth.id hoặc hợp nhất dữ liệu an toàn."
      );
      console.log("  SQL gợi ý (chạy trên Supabase SQL editor):");
      console.log(
        `  INSERT INTO public.profiles (id, email, role, status, created_at) VALUES ('${user.id}', '${email}', 'owner', 'active', now()) ON CONFLICT (id) DO NOTHING;`
      );
    } else if (!pById && !pByEmail) {
      console.log("- Không tìm thấy profile nào. Gợi ý tạo mới:");
      console.log(
        `  INSERT INTO public.profiles (id, email, role, status, created_at) VALUES ('${user.id}', '${email}', 'owner', 'active', now());`
      );
    } else if (pById) {
      if (!pById.role) {
        console.log(
          "- Profile có nhưng 'role' rỗng. Đặt role='owner' nếu đây là chủ cửa hàng:"
        );
        console.log(
          `  UPDATE public.profiles SET role='owner', status='active' WHERE id='${user.id}';`
        );
      } else {
        console.log(
          `- Profile hợp lệ (role='${pById.role}'). Nếu vẫn không vào được UI owner, kiểm tra RLS/migration.`
        );
      }
    }

    console.log(
      "\nNếu bạn muốn, mình có thể tạo file SQL mẫu 'scripts/fix-profile.sql' để bạn copy vào Supabase SQL editor."
    );
  } catch (e) {
    console.error("Lỗi khi kiểm tra profile:", e);
  }
}

run();
