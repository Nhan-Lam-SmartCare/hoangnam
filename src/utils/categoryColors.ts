/**
 * Category color mapping for consistent UI across the app
 * Used for product categories and brand badges
 * Tông màu nhẹ nhàng, muted - dễ nhìn không chói mắt
 */

export interface CategoryColorStyle {
  bg: string;
  text: string;
}

const categoryColors: Record<string, CategoryColorStyle> = {
  // === DANH MỤC SẢN PHẨM ===
  // Nhớt, dầu - amber muted
  Nhớt: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600/80 dark:text-amber-400/70",
  },
  Dầu: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600/80 dark:text-amber-400/70",
  },
  // Lọc - cyan muted
  Lọc: {
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-600/80 dark:text-cyan-400/70",
  },
  "Lọc gió": {
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-600/80 dark:text-cyan-400/70",
  },
  "Lọc nhớt": {
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-600/80 dark:text-cyan-400/70",
  },
  // Bugi - rose muted
  Bugi: {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-600/80 dark:text-rose-400/70",
  },
  // Phanh - red muted
  Phanh: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-600/80 dark:text-red-400/70",
  },
  "Má phanh": {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-600/80 dark:text-red-400/70",
  },
  // Xích, sên - neutral
  Xích: {
    bg: "bg-neutral-100 dark:bg-neutral-800/40",
    text: "text-neutral-600 dark:text-neutral-400",
  },
  Sên: {
    bg: "bg-neutral-100 dark:bg-neutral-800/40",
    text: "text-neutral-600 dark:text-neutral-400",
  },
  "Nhông sên dĩa": {
    bg: "bg-neutral-100 dark:bg-neutral-800/40",
    text: "text-neutral-600 dark:text-neutral-400",
  },
  // Lốp, vỏ - slate muted
  Lốp: {
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-400",
  },
  "Vỏ xe": {
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-400",
  },
  // Ắc quy - emerald muted
  "Ắc quy": {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600/80 dark:text-emerald-400/70",
  },
  "Ắc quy GS": {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600/80 dark:text-emerald-400/70",
  },
  "Bình điện": {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600/80 dark:text-emerald-400/70",
  },
  // Đèn - yellow very muted
  Đèn: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700/70 dark:text-yellow-400/60",
  },
  "Bóng đèn": {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700/70 dark:text-yellow-400/60",
  },
  // Phụ tùng điện - blue muted
  Điện: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600/80 dark:text-blue-400/70",
  },
  IC: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600/80 dark:text-blue-400/70",
  },
  // Gioăng, ron - orange muted
  Gioăng: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-600/80 dark:text-orange-400/70",
  },
  Ron: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-600/80 dark:text-orange-400/70",
  },
  // Vòng bi - indigo muted
  "Vòng bi": {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    text: "text-indigo-600/80 dark:text-indigo-400/70",
  },
  "Bạc đạn": {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    text: "text-indigo-600/80 dark:text-indigo-400/70",
  },
  // Cao su - stone
  "Cao su": {
    bg: "bg-stone-100 dark:bg-stone-800/40",
    text: "text-stone-600 dark:text-stone-400",
  },
  // Phụ kiện - purple muted
  "Phụ kiện": {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-600/80 dark:text-purple-400/70",
  },

  // === THƯƠNG HIỆU / HÃNG XE ===
  Honda: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-600/80 dark:text-red-400/70",
  },
  Yamaha: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600/80 dark:text-blue-400/70",
  },
  Suzuki: {
    bg: "bg-sky-50 dark:bg-sky-950/30",
    text: "text-sky-600/80 dark:text-sky-400/70",
  },
  SYM: {
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-400",
  },
  Piaggio: {
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-600/80 dark:text-teal-400/70",
  },
  Vespa: {
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-600/80 dark:text-teal-400/70",
  },
  Kymco: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-600/80 dark:text-orange-400/70",
  },
  "Hãng Công Ty": {
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-400",
  },

  // === THƯƠNG HIỆU PHỤ TÙNG ===
  NGK: {
    bg: "bg-green-50 dark:bg-green-950/30",
    text: "text-green-600/80 dark:text-green-400/70",
  },
  Denso: {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-600/80 dark:text-rose-400/70",
  },
  DENSO: {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-600/80 dark:text-rose-400/70",
  },
  Kenda: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600/80 dark:text-amber-400/70",
  },
  IRC: {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-600/80 dark:text-violet-400/70",
  },
  "IRC Tire": {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-600/80 dark:text-violet-400/70",
  },
  Michelin: {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    text: "text-indigo-600/80 dark:text-indigo-400/70",
  },
  Dunlop: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700/70 dark:text-yellow-400/60",
  },
  Castrol: {
    bg: "bg-lime-50 dark:bg-lime-950/30",
    text: "text-lime-600/80 dark:text-lime-400/70",
  },
  Shell: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600/80 dark:text-amber-400/70",
  },
  Motul: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-600/80 dark:text-red-400/70",
  },
  Bosch: {
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-400",
  },
  GS: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600/80 dark:text-emerald-400/70",
  },

  // Default
  Khác: {
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-500 dark:text-slate-400",
  },
};

// Hash colors for categories not in the predefined list - tông màu muted
const hashColors: CategoryColorStyle[] = [
  {
    bg: "bg-pink-50 dark:bg-pink-950/30",
    text: "text-pink-600/80 dark:text-pink-400/70",
  },
  {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-600/80 dark:text-violet-400/70",
  },
  {
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-600/80 dark:text-teal-400/70",
  },
  {
    bg: "bg-lime-50 dark:bg-lime-950/30",
    text: "text-lime-600/80 dark:text-lime-400/70",
  },
  {
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
    text: "text-fuchsia-600/80 dark:text-fuchsia-400/70",
  },
  {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600/80 dark:text-emerald-400/70",
  },
  {
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-600/80 dark:text-cyan-400/70",
  },
  {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-600/80 dark:text-rose-400/70",
  },
];

/**
 * Get color style for a category/brand
 * @param category - Category or brand name
 * @returns Object with bg and text Tailwind classes
 */
export function getCategoryColor(
  category: string | undefined
): CategoryColorStyle {
  if (!category) {
    return {
      bg: "bg-slate-100 dark:bg-slate-700",
      text: "text-slate-500 dark:text-slate-400",
    };
  }

  // Try exact match first
  if (categoryColors[category]) {
    return categoryColors[category];
  }

  // Try partial match
  const lowerCat = category.toLowerCase();
  for (const [key, value] of Object.entries(categoryColors)) {
    if (
      lowerCat.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(lowerCat)
    ) {
      return value;
    }
  }

  // Generate consistent color based on category string hash
  const hash = category
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hashColors[hash % hashColors.length];
}

/**
 * Category badge component helper - returns class string
 * @param category - Category or brand name
 * @returns Combined className string for the badge
 */
export function getCategoryBadgeClass(category: string | undefined): string {
  const colors = getCategoryColor(category);
  return `${colors.bg} ${colors.text}`;
}
