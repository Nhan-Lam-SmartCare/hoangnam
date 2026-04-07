import fs from "fs";
import path from "path";

const filePath = path.join(
  process.cwd(),
  "src/components/service/components/WorkOrderModal.tsx"
);

console.log("Reading file:", filePath);
let content = fs.readFileSync(filePath, "utf8");

// Count occurrences before
const countBefore = (
  content.match(/const duplicatePhone = customers\.find/g) || []
).length;
console.log(`Found ${countBefore} occurrences of duplicatePhone pattern`);

// Replace ALL duplicatePhone check patterns with simpler version
// Pattern covers the duplicatePhone check and warning toast - handles both with and without emoji comment
const replacePattern =
  /if \(!existingCustomer\) \{\s*(?:\/\/[^\n]*\n\s*)?const duplicatePhone = customers\.find\(\s*\(c\) =>\s*c\.phone === formData\.customerPhone &&\s*formData\.customerName &&\s*c\.name\.toLowerCase\(\) !== formData\.customerName\.toLowerCase\(\)\s*\);\s*if \(duplicatePhone\) \{\s*showToast\.warning\(\s*`[^`]*`\s*\);\s*\}/g;

const replacement = `if (!existingCustomer) {
        // Chỉ tạo khách hàng mới nếu SĐT chưa tồn tại
        console.log(\`[WorkOrderModal] Creating new customer: \${formData.customerName} (\${formData.customerPhone})\`);`;

content = content.replace(replacePattern, replacement);

// Count occurrences after
const countAfter = (
  content.match(/const duplicatePhone = customers\.find/g) || []
).length;
console.log(
  `After replacement: ${countAfter} occurrences of duplicatePhone pattern`
);

// Now add the else branch after upsertCustomer calls that don't have one yet
// Pattern: upsertCustomer({...}); } } followed by // Determine payment status
const upsertPattern1 =
  /(upsertCustomer\(\{\s*id: `CUST-\$\{Date\.now\(\)\}`,\s*name: formData\.customerName,\s*phone: formData\.customerPhone,\s*vehicles: vehicles\.length > 0 \? vehicles : undefined,\s*vehicleModel: formData\.vehicleModel,\s*licensePlate: formData\.licensePlate,\s*status: "active",\s*segment: "New",\s*loyaltyPoints: 0,\s*totalSpent: 0,\s*visitCount: 1,\s*lastVisit: new Date\(\)\.toISOString\(\),\s*created_at: new Date\(\)\.toISOString\(\),\s*\}\);)\s*\}\s*\}\s*\n(\s*)(\/\/ Determine payment status)/g;

const upsertReplacement1 = `$1
      } else {
        // Khách hàng đã tồn tại - chỉ cập nhật thông tin xe nếu cần
        console.log(\`[WorkOrderModal] Customer exists: \${existingCustomer.name} (\${existingCustomer.phone})\`);
        if (
          formData.vehicleModel &&
          existingCustomer.vehicleModel !== formData.vehicleModel
        ) {
          upsertCustomer({
            ...existingCustomer,
            vehicleModel: formData.vehicleModel,
            licensePlate: formData.licensePlate,
          });
          console.log(\`[WorkOrderModal] Updated vehicle info for existing customer\`);
        }
      }
    }

$2$3`;

content = content.replace(upsertPattern1, upsertReplacement1);

// Write back
fs.writeFileSync(filePath, content, "utf8");
console.log("File updated successfully!");

// Verify
const verifyContent = fs.readFileSync(filePath, "utf8");
const elseCount = (
  verifyContent.match(
    /\/\/ Khách hàng đã tồn tại - chỉ cập nhật thông tin xe nếu cần/g
  ) || []
).length;
const dupCount = (
  verifyContent.match(/const duplicatePhone = customers\.find/g) || []
).length;
console.log(
  `Verification: Found ${elseCount} else branches, ${dupCount} duplicatePhone patterns remaining`
);
