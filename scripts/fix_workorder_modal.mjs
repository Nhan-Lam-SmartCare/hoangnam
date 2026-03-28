import fs from "fs";
import path from "path";

const filePath = path.join(
  process.cwd(),
  "src/components/service/components/WorkOrderModal.tsx"
);

console.log("Reading file:", filePath);
let content = fs.readFileSync(filePath, "utf8");

// Pattern for first and second occurrence (they are similar)
// Look for the pattern that creates customer without checking if exists
const oldPattern = `      if (!existingCustomer) {
        const duplicatePhone = customers.find(
          (c) =>
            c.phone === formData.customerPhone &&
            formData.customerName &&
            c.name.toLowerCase() !== formData.customerName.toLowerCase()
        );

        if (duplicatePhone) {
          showToast.warning(`;

const newPattern = `      if (!existingCustomer) {
        // Chỉ tạo khách hàng mới nếu SĐT chưa tồn tại
        console.log(\`[WorkOrderModal] Creating new customer: \${formData.customerName} (\${formData.customerPhone})\`);`;

// Count occurrences before
const countBefore = (
  content.match(/const duplicatePhone = customers\.find/g) || []
).length;
console.log(`Found ${countBefore} occurrences of duplicatePhone pattern`);

// Replace the duplicatePhone check pattern with simpler version
// This removes the duplicatePhone warning check since we're not creating duplicates anymore
const replacePattern1 =
  /if \(!existingCustomer\) \{\s*const duplicatePhone = customers\.find\(\s*\(c\) =>\s*c\.phone === formData\.customerPhone &&\s*formData\.customerName &&\s*c\.name\.toLowerCase\(\) !== formData\.customerName\.toLowerCase\(\)\s*\);\s*if \(duplicatePhone\) \{\s*showToast\.warning\(\s*`[^`]*`\s*\);\s*\}/g;

const replacement1 = `if (!existingCustomer) {
        // Chỉ tạo khách hàng mới nếu SĐT chưa tồn tại
        console.log(\`[WorkOrderModal] Creating new customer: \${formData.customerName} (\${formData.customerPhone})\`);`;

content = content.replace(replacePattern1, replacement1);

// Now add the else branch after the upsertCustomer call
// Find the pattern: upsertCustomer({...}); } } followed by comment about payment status
const upsertPattern =
  /upsertCustomer\(\{\s*id: `CUST-\$\{Date\.now\(\)\}`,\s*name: formData\.customerName,\s*phone: formData\.customerPhone,\s*vehicles: vehicles\.length > 0 \? vehicles : undefined,\s*vehicleModel: formData\.vehicleModel,\s*licensePlate: formData\.licensePlate,\s*status: "active",\s*segment: "New",\s*loyaltyPoints: 0,\s*totalSpent: 0,\s*visitCount: 1,\s*lastVisit: new Date\(\)\.toISOString\(\),\s*created_at: new Date\(\)\.toISOString\(\),\s*\}\);\s*\}\s*\}\s*\n\s*\/\/ Determine payment status/g;

const upsertReplacement = `upsertCustomer({
          id: \`CUST-\${Date.now()}\`,
          name: formData.customerName,
          phone: formData.customerPhone,
          vehicles: vehicles.length > 0 ? vehicles : undefined,
          vehicleModel: formData.vehicleModel,
          licensePlate: formData.licensePlate,
          status: "active",
          segment: "New",
          loyaltyPoints: 0,
          totalSpent: 0,
          visitCount: 1,
          lastVisit: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
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

    // Determine payment status`;

content = content.replace(upsertPattern, upsertReplacement);

// Count occurrences after
const countAfter = (
  content.match(/const duplicatePhone = customers\.find/g) || []
).length;
console.log(
  `After replacement: ${countAfter} occurrences of duplicatePhone pattern`
);

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
console.log(
  `Verification: Found ${elseCount} else branches with Vietnamese comment`
);
