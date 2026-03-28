/**
 * Generate unique 8-character SKU
 * Format: XXXXXXXX (uppercase alphanumeric)
 * Example: A3B7K9M2
 */
export function generateSKU(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars: 0,O,1,I
  let sku = "";

  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    sku += chars[randomIndex];
  }

  return sku;
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
 * Validate SKU format (8 alphanumeric characters)
 */
export function isValidSKU(sku: string): boolean {
  return /^[A-Z0-9]{8}$/.test(sku);
}
