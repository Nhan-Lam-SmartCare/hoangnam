// Sinh màu nền ổn định cho avatar chữ-cái-đầu từ một chuỗi (tên danh mục/sản phẩm).
// Hàm thuần: cùng input luôn cho cùng màu. Tách khỏi InventoryManager để tái dùng.
export function getAvatarColor(name: string): string {
  if (!name) return "#94a3b8"; // slate-400
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return `#${"00000".substring(0, 6 - c.length) + c}`;
}
