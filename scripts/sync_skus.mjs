import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config();

// Khoá đọc từ .env (đã nằm trong .gitignore), KHÔNG hardcode: file này được
// commit lên GitHub, mà service_role bỏ qua toàn bộ RLS — lộ ra là mất sạch dữ
// liệu mọi chi nhánh. Cùng cách đọc với scripts/setup/apply-sql.mjs.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Khai báo trong file .env trước khi chạy."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function get3CharSKUByIndex(index) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 24 letters
  const letterIndex = Math.floor(index / 99) % letters.length;
  const numIndex = (index % 99) + 1; // 1 to 99
  const letter = letters[letterIndex];
  const numStr = String(numIndex).padStart(2, "0");
  return `${letter}${numStr}`;
}

async function run() {
  console.log("Fetching all parts from Supabase...");
  const { data: parts, error } = await supabase
    .from("parts")
    .select("id, name, sku, barcode, category")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching parts:", error);
    process.exit(1);
  }

  console.log(`Found ${parts.length} total parts in database.`);

  let updatedCount = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const newSKU = get3CharSKUByIndex(i);

    console.log(`[${i + 1}/${parts.length}] Updating "${part.name}" (Old: ${part.sku}) -> New: ${newSKU}`);

    const { error: updateErr } = await supabase
      .from("parts")
      .update({
        sku: newSKU,
        barcode: newSKU,
      })
      .eq("id", part.id);

    if (updateErr) {
      console.error(`Failed to update ${part.name}:`, updateErr.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`\n✅ SUCCESSFULLY SYNCED ALL ${updatedCount}/${parts.length} PARTS TO 3-CHARACTER SKUS (A01, A02, A03...)!`);
}

run();
