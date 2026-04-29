/**
 * Danh sách thiết bị điện tử & xe điện phổ biến
 * Dùng chung cho toàn bộ hệ thống (CustomerModal, WorkOrderModal, WorkOrderMobileModal...)
 */
export const POPULAR_DEVICES: string[] = [
  // === ĐIỆN THOẠI - APPLE ===
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16 Plus",
  "iPhone 16",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15 Plus",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14 Plus",
  "iPhone 14",
  "iPhone 13 Pro Max",
  "iPhone 13 Pro",
  "iPhone 13",
  "iPhone 13 Mini",
  "iPhone 12 Pro Max",
  "iPhone 12 Pro",
  "iPhone 12",
  "iPhone 12 Mini",
  "iPhone 11 Pro Max",
  "iPhone 11 Pro",
  "iPhone 11",
  "iPhone SE (2022)",
  "iPhone XS Max",
  "iPhone XS",
  "iPhone XR",
  "iPhone X",
  "iPhone 8 Plus",
  "iPhone 8",
  "iPhone 7 Plus",
  "iPhone 7",
  // === ĐIỆN THOẠI - SAMSUNG ===
  "Samsung Galaxy S25 Ultra",
  "Samsung Galaxy S25+",
  "Samsung Galaxy S25",
  "Samsung Galaxy S24 Ultra",
  "Samsung Galaxy S24+",
  "Samsung Galaxy S24",
  "Samsung Galaxy S23 Ultra",
  "Samsung Galaxy S23+",
  "Samsung Galaxy S23",
  "Samsung Galaxy Z Fold6",
  "Samsung Galaxy Z Fold5",
  "Samsung Galaxy Z Flip6",
  "Samsung Galaxy Z Flip5",
  "Samsung Galaxy A55",
  "Samsung Galaxy A54",
  "Samsung Galaxy A35",
  "Samsung Galaxy A34",
  "Samsung Galaxy A25",
  "Samsung Galaxy A15",
  "Samsung Galaxy A05s",
  "Samsung Galaxy M34",
  "Samsung Galaxy Note 20 Ultra",
  "Samsung Galaxy Note 10+",
  // === ĐIỆN THOẠI - XIAOMI ===
  "Xiaomi 14 Ultra",
  "Xiaomi 14 Pro",
  "Xiaomi 14",
  "Xiaomi 13T Pro",
  "Xiaomi 13T",
  "Xiaomi Redmi Note 13 Pro+",
  "Xiaomi Redmi Note 13 Pro",
  "Xiaomi Redmi Note 13",
  "Xiaomi Redmi Note 12",
  "Xiaomi Redmi 13C",
  "Xiaomi POCO X6 Pro",
  "Xiaomi POCO F5",
  // === ĐIỆN THOẠI - OPPO ===
  "OPPO Find X7 Ultra",
  "OPPO Find N3 Flip",
  "OPPO Reno 11 Pro",
  "OPPO Reno 11",
  "OPPO Reno 10",
  "OPPO A98",
  "OPPO A78",
  "OPPO A58",
  "OPPO A18",
  // === ĐIỆN THOẠI - VIVO ===
  "Vivo X100 Pro",
  "Vivo V30 Pro",
  "Vivo V30",
  "Vivo Y36",
  "Vivo Y27",
  // === ĐIỆN THOẠI - REALME ===
  "Realme GT5 Pro",
  "Realme 12 Pro+",
  "Realme C67",
  "Realme C55",
  // === ĐIỆN THOẠI - KHÁC ===
  "Google Pixel 8 Pro",
  "Google Pixel 8",
  "Huawei P60 Pro",
  "Nokia G42",
  // === TABLET ===
  "iPad Pro M4 13 inch",
  "iPad Pro M4 11 inch",
  "iPad Air M2",
  "iPad 10th Gen",
  "iPad Mini 6",
  "Samsung Galaxy Tab S9 Ultra",
  "Samsung Galaxy Tab S9+",
  "Samsung Galaxy Tab S9",
  "Samsung Galaxy Tab A9+",
  "Samsung Galaxy Tab A9",
  "Xiaomi Pad 6",
  // === LAPTOP ===
  "MacBook Pro 16 M3 Pro",
  "MacBook Pro 14 M3 Pro",
  "MacBook Air 15 M3",
  "MacBook Air 13 M3",
  "Dell XPS 15",
  "Dell XPS 13",
  "Dell Inspiron 15",
  "Dell Latitude 14",
  "HP Pavilion 15",
  "HP Envy x360",
  "HP EliteBook 840",
  "Lenovo ThinkPad X1 Carbon",
  "Lenovo IdeaPad Slim 5",
  "Lenovo Legion 5",
  "ASUS ROG Zephyrus",
  "ASUS VivoBook 15",
  "ASUS ZenBook 14",
  "Acer Nitro 5",
  "Acer Swift 3",
  "MSI GF63 Thin",
  // === SMARTWATCH ===
  "Apple Watch Ultra 2",
  "Apple Watch Series 9",
  "Apple Watch SE (2023)",
  "Samsung Galaxy Watch 6",
  "Samsung Galaxy Watch 6 Classic",
  "Garmin Venu 3",
  "Xiaomi Watch S3",
  // === TAI NGHE ===
  "AirPods Pro 2",
  "AirPods 3",
  "AirPods Max",
  "Samsung Galaxy Buds 3 Pro",
  "Sony WH-1000XM5",
  "Sony WF-1000XM5",
  "JBL Tune 770NC",
  // === XE ĐIỆN ===
  "VinFast Klara S",
  "VinFast Feliz S",
  "VinFast Theon S",
  "VinFast Evo 200",
  "VinFast Ludo",
  "VinFast Vento",
  "Yadea G5",
  "Yadea Xmen Neo",
  "Yadea S3",
  "DatBike Weaver++",
  "DatBike Weaver 200",
  "Pega eSH",
  "Pega NewTech",
  "MBIGO MBI S",
  "Xe điện Dibao",
  "Xe điện Ninja",
  // === KHÁC ===
  "Máy tính để bàn (PC)",
  "Máy in",
  "Loa Bluetooth",
  "Máy chơi game",
  "Khác",
];

/**
 * Validate Serial Number / IMEI
 * - IMEI: Đúng 15 chữ số
 * - Serial: 4-30 ký tự chữ và số (linh hoạt cho nhiều loại thiết bị)
 * - Trả về { ok: true } nếu hợp lệ, { ok: false, error: "..." } nếu không
 */
export function validateSerialOrIMEI(value: string): { ok: boolean; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true }; // cho phép bỏ trống

  // Nếu toàn số → kiểm tra IMEI (15 số)
  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length === 15) {
      return { ok: true };
    }
    if (trimmed.length < 15) {
      return { ok: false, error: `IMEI cần 15 chữ số (hiện ${trimmed.length} số)` };
    }
    return { ok: false, error: `IMEI chỉ có 15 chữ số (hiện ${trimmed.length} số)` };
  }

  // Nếu có chữ + số → kiểm tra Serial Number
  if (/^[a-zA-Z0-9\-_./]+$/.test(trimmed)) {
    if (trimmed.length < 4) {
      return { ok: false, error: "Serial Number cần ít nhất 4 ký tự" };
    }
    if (trimmed.length > 30) {
      return { ok: false, error: "Serial Number không quá 30 ký tự" };
    }
    return { ok: true };
  }

  return { ok: false, error: "Serial/IMEI chỉ gồm chữ, số và ký tự - _ . /" };
}
