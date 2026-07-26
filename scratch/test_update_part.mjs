import { createClient } from '@supabase/supabase-js';

const url = "https://xduimljokohsqslwbtja.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdWltbGpva29oc3FzbHdidGphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5NDE5NSwiZXhwIjoyMDgyMzcwMTk1fQ.Siq4iY2Q1hum1UdmxMUcdFsJxuEU4DctalGayxeKrYw";

const supabase = createClient(url, key);

async function testUpdatePartRepo() {
  const { data: parts } = await supabase.from('parts').select('id, name').limit(1);
  if (!parts || !parts.length) {
    console.log("No parts found");
    return;
  }
  const part = parts[0];
  console.log("Found part:", part);

  const updates = {
    name: part.name,
    supplierId: "679cabce-3931-4189-8c65-43347090f3d3",
    supplier_id: "679cabce-3931-4189-8c65-43347090f3d3",
  };

  // Simulating updatePartWithSchemaFallback logic:
  const workingUpdates = { ...updates };
  for (let i = 0; i < 5; i++) {
    console.log(`Attempt ${i+1} keys:`, Object.keys(workingUpdates));
    const { data, error } = await supabase
      .from("parts")
      .update(workingUpdates)
      .eq("id", part.id)
      .select()
      .single();

    if (!error && data) {
      console.log("SUCCESS!", data.id);
      return;
    }

    console.log("Error:", error);
    const msg = String(error?.message || "");
    const det = String(error?.details || "");
    const hint = String(error?.hint || "");
    const text = `${msg} ${det} ${hint}`;
    const match = text.match(/Could not find the '([^']+)' column/i) ||
                  text.match(/column "([^"]+)"/i) ||
                  text.match(/column '([^']+)'/i) ||
                  text.match(/'([^']+)'/i);

    const missingCol = match ? match[1] : null;
    console.log("Missing col detected:", missingCol);

    if (!missingCol || !(missingCol in workingUpdates)) {
      console.log("Stopped because missingCol not found or not in payload");
      return;
    }
    delete workingUpdates[missingCol];
  }
}

testUpdatePartRepo();
