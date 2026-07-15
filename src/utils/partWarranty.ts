// Lấy chuỗi bảo hành của phụ tùng, chịu được nhiều biến thể tên cột giữa các
// deployment (warrantyPeriod / warrantyperiod / warranty_period / warranty).
// Hàm thuần — tách khỏi InventoryManager để row & card mobile dùng chung.
export function getPartWarrantyText(part: any): string {
  return String(
    part?.warrantyPeriod ??
      part?.warrantyperiod ??
      part?.warranty_period ??
      part?.warranty ??
      ""
  ).trim();
}
