/**
 * Format Utilities
 *
 * Provides consistent formatting functions for currency, dates, and IDs
 * throughout the application. All functions are locale-aware for Vietnamese.
 */

/**
 * Formats a number as Vietnamese Dong (VND) currency
 *
 * @param v - The number to format
 * @returns Formatted currency string (e.g., "1.500.000 ₫")
 *
 * @example
 * ```typescript
 * formatCurrency(1500000) // "1.500.000 ₫"
 * formatCurrency(0)       // "0 ₫"
 * ```
 */
export const formatCurrency = (v: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    v
  );

/**
 * Formats a number with thousand separators (Vietnamese style: dots)
 * Used for displaying numbers in input fields
 *
 * @param value - Number or string to format
 * @returns Formatted string with dots as thousand separators (e.g., "1.500.000")
 *
 * @example
 * ```typescript
 * formatNumberWithDots(1500000)   // "1.500.000"
 * formatNumberWithDots("1500000") // "1.500.000"
 * formatNumberWithDots(0)         // "0"
 * formatNumberWithDots("")        // ""
 * ```
 */
export const formatNumberWithDots = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value.replace(/\./g, "").replace(/,/g, "")) : value;
  if (isNaN(num)) return "";
  if (num === 0) return "0";
  return new Intl.NumberFormat("vi-VN").format(num);
};

/**
 * Parses a formatted number string (with dots) back to a number
 *
 * @param value - Formatted string with dots (e.g., "1.500.000")
 * @returns The numeric value
 *
 * @example
 * ```typescript
 * parseFormattedNumber("1.500.000") // 1500000
 * parseFormattedNumber("0")         // 0
 * parseFormattedNumber("")          // 0
 * ```
 */
export const parseFormattedNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  // Remove all dots (thousand separators) and parse
  const cleaned = value.replace(/\./g, "").replace(/,/g, ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

/**
 * Formats a date/ISO string to Vietnamese date format
 *
 * @param iso - ISO date string, Date object, or null/undefined
 * @param short - If true (default), returns "DD/MM/YYYY". If false, returns "DD/MM/YYYY HH:mm"
 * @returns Formatted date string or "--" for invalid/null dates
 *
 * @example
 * ```typescript
 * formatDate('2024-01-15T10:30:00Z')        // "15/01/2024"
 * formatDate('2024-01-15T10:30:00Z', false) // "15/01/2024 10:30"
 * formatDate(null)                          // "--"
 * ```
 */
export const formatDate = (
  iso: string | Date | undefined | null,
  short = true
) => {
  if (!iso) return "--";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "--";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  if (short) return `${dd}/${mm}/${yyyy}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

/**
 * Formats a work order ID for display
 *
 * Converts timestamp-based IDs (e.g., "WO-1705312245678") into
 * human-readable format (e.g., "SC-20240115-245678")
 *
 * @param id - The work order ID to format
 * @param storePrefix - Store prefix to use (default: "SC")
 * @returns Formatted work order ID or empty string if null
 *
 * @example
 * ```typescript
 * formatWorkOrderId('WO-1705312245678', 'MTR') // "MTR-20240115-245678"
 * formatWorkOrderId('CUSTOM-123')               // "CUSTOM-123" (unchanged)
 * ```
 */
export const formatWorkOrderId = (id?: string | null, storePrefix?: string) => {
  if (!id) return "";
  const prefix = storePrefix || "SC";
  // If ID starts with prefix and has a numeric timestamp following it (e.g., SC-<timestamp>), capture it.
  let match = id.match(new RegExp(`^${prefix}-(\\d{10,})`, "i"));

  // Otherwise, detect legacy WO-<timestamp> or any long numeric timestamp.
  if (!match) match = id.match(/WO-(\d+)/i) || id.match(/(\d{10,})/);
  if (match && match[1]) {
    const ts = match[1];
    const num = Number(ts);
    if (!Number.isNaN(num)) {
      const d = new Date(num);
      if (!Number.isNaN(d.getTime())) {
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}${String(d.getDate()).padStart(2, "0")}`;
        const suffix = String(ts).slice(-6).padStart(6, "0");
        return `${prefix}-${dateStr}-${suffix}`;
      }
    }
  }
  // Default: return original id
  return id;
};

/**
 * Generic ID formatter that preserves original prefixes
 *
 * Converts any timestamp-based ID into a readable format while
 * preserving the original prefix (SALE, INV, TX, etc.)
 *
 * @param id - The ID to format
 * @param storePrefix - Fallback store prefix for bare timestamps (default: "SC")
 * @returns Formatted ID or empty string if null
 *
 * @example
 * ```typescript
 * formatAnyId('SALE-1705312245678')  // "SALE-20240115-245678"
 * formatAnyId('INV-1705312245678')   // "INV-20240115-245678"
 * formatAnyId('1705312245678', 'SC') // "SC-20240115-245678"
 * ```
 */
export const formatAnyId = (id?: string | null, storePrefix?: string) => {
  if (!id) return "";
  // Capture format PREFIX-<timestamp> where timestamp is 10+ digits
  const withPrefix = id.match(/^([A-Z0-9_-]+)-(\d{10,})$/i);
  if (withPrefix) {
    const originalPrefix = withPrefix[1];
    const ts = withPrefix[2];
    const num = Number(ts);
    if (!Number.isNaN(num)) {
      const d = new Date(num);
      if (!Number.isNaN(d.getTime())) {
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}${String(d.getDate()).padStart(2, "0")}`;
        const suffix = String(ts).slice(-6).padStart(6, "0");
        return `${originalPrefix}-${dateStr}-${suffix}`;
      }
    }
  }

  // If we reach here, fallback to: detect any bare long numeric timestamp and apply store prefix
  const numMatch = id.match(/(\d{10,})/);
  if (numMatch) {
    const ts = numMatch[1];
    const num = Number(ts);
    if (!Number.isNaN(num)) {
      const d = new Date(num);
      if (!Number.isNaN(d.getTime())) {
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}${String(d.getDate()).padStart(2, "0")}`;
        const suffix = String(ts).slice(-6).padStart(6, "0");
        const prefix = storePrefix || "SC";
        return `${prefix}-${dateStr}-${suffix}`;
      }
    }
  }

  return id;
};

/**
 * Normalizes text for search purposes (removes accents, lowercase, trim)
 * Useful for Vietnamese search
 * 
 * @param str - The string to normalize
 * @returns Normalized string
 * 
 * @example
 * ```typescript
 * normalizeSearchText("Hồng Lợi") // "hong loi"
 * normalizeSearchText("hồng lợi") // "hong loi"
 * ```
 */
export const normalizeSearchText = (str: string | null | undefined): string => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
};
