import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xduimljokohsqslwbtja.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdWltbGpva29oc3FzbHdidGphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5NDE5NSwiZXhwIjoyMDgyMzcwMTk1fQ.Siq4iY2Q1hum1UdmxMUcdFsJxuEU4DctalGayxeKrYw";

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
