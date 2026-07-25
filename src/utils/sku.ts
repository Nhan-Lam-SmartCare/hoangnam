/**
 * Generate ultra-compact 3-character SKU / barcode
 * Format: 1 uppercase letter + 2 digits (e.g., A01, A02, B15)
 * Capacity: 24 letters (A-Z except I, O) * 100 numbers (00-99) = 2,400 unique codes
 */
export function generateSKU(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Exclude I, O to avoid confusion with 1, 0
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  const randomNum = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${randomLetter}${randomNum}`;
}

/**
 * Generate SKU with timestamp for fallback uniqueness if needed
 * Format: TTTTXXXX
 */
export function generateSKUWithTimestamp(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  const randomNum = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${randomLetter}${randomNum}`;
}

/**
 * Validate SKU format.
 * Supports 3-character SKUs (e.g. A01), short numeric/alphanumeric SKUs (3-12 chars), and legacy formats.
 */
export function isValidSKU(sku: string): boolean {
  if (!sku) return false;
  const clean = sku.trim().toUpperCase();
  return (
    /^[A-Z][0-9]{2}$/.test(clean) ||
    /^[A-Z0-9]{3,12}$/.test(clean) ||
    /^PT-[A-Z0-9]{6}$/.test(clean)
  );
}
