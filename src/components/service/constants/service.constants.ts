/**
 * Service-related constants
 * Extracted from ServiceManager.tsx for better organization
 */

/**
 * Popular motorcycle models in Vietnam
 * Used for vehicle model autocomplete/suggestions
 */
export const POPULAR_MOTORCYCLES = [
    // Honda
    "Honda Wave RSX",
    "Honda Wave Alpha",
    "Honda Blade",
    "Honda Future",
    "Honda Winner X",
    "Honda Vision",
    "Honda Air Blade",
    "Honda SH Mode",
    "Honda SH 125i",
    "Honda SH 150i",
    "Honda SH 160i",
    "Honda SH 350i",
    "Honda Vario",
    "Honda Lead",
    "Honda PCX",
    "Honda ADV",
    // Yamaha
    "Yamaha Exciter",
    "Yamaha Sirius",
    "Yamaha Jupiter",
    "Yamaha Grande",
    "Yamaha Janus",
    "Yamaha FreeGo",
    "Yamaha Latte",
    "Yamaha NVX",
    "Yamaha XSR",
    // Suzuki
    "Suzuki Raider",
    "Suzuki Axelo",
    "Suzuki Satria",
    "Suzuki GD110",
    "Suzuki Impulse",
    "Suzuki Address",
    "Suzuki Revo",
    // SYM
    "SYM Elite",
    "SYM Galaxy",
    "SYM Star",
    "SYM Attila",
    "SYM Angela",
    "SYM Passing",
    // Piaggio & Vespa
    "Piaggio Liberty",
    "Piaggio Medley",
    "Vespa Sprint",
    "Vespa Primavera",
    "Vespa GTS",
    // VinFast
    "VinFast Klara",
    "VinFast Evo200",
    "VinFast Ludo",
    "VinFast Impes",
    "VinFast Theon",
    // Khác
    "Khác",
] as const;

export type MotorcycleModel = (typeof POPULAR_MOTORCYCLES)[number];

/**
 * Filter input CSS class
 */
export const FILTER_INPUT_CLASS =
    "px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200";

/**
 * Page size for pagination
 */
export const PAGE_SIZE = 20;

/**
 * Default fetch limit for work orders
 */
export const DEFAULT_FETCH_LIMIT = 100;

/**
 * Default date range in days
 */
export const DEFAULT_DATE_RANGE_DAYS = 7;
