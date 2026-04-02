/**
 * Generate compact SKU
 * Format: PT-XXXXXX (uppercase alphanumeric)
 * Example: PT-A3K9M2
 */
export function generateSKU(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars: 0,O,1,I
  let suffix = "";

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    suffix += chars[randomIndex];
  }

  return `PT-${suffix}`;
}

/**
 * Generate SKU with timestamp for better uniqueness
 * Format: TTTTXXXX (4 chars from timestamp + 4 random)
 */
export function generateSKUWithTimestamp(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const timestamp = Date.now()
    .toString(36)
    .toUpperCase()
    .slice(-4)
    .padStart(4, "0");

  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }

  return timestamp + random;
}

/**
 * Validate SKU format.
 * Supports both legacy 8-char SKUs and new compact PT-XXXXXX format.
 */
export function isValidSKU(sku: string): boolean {
  return /^[A-Z0-9]{8}$/.test(sku) || /^PT-[A-Z0-9]{6}$/.test(sku);
}
