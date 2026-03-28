/**
 * Security utilities for the Motocare application
 * This module provides client-side security helpers
 */

/**
 * Rate limiting tracker for client-side operations
 * Prevents abuse of sensitive operations like login attempts
 */
interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  maxAttempts: number; // Maximum attempts within window
  windowMs: number; // Time window in milliseconds
  lockoutMs: number; // Lockout duration in milliseconds
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutMs: 30 * 60 * 1000, // 30 minutes lockout
};

/**
 * Check if an operation should be rate limited
 * @param key - Unique identifier for the rate limit (e.g., 'login:user@email.com')
 * @param config - Optional rate limit configuration
 * @returns Object with allowed status and remaining attempts
 */
export function checkRateLimit(
  key: string,
  config: Partial<RateLimitConfig> = {}
): { allowed: boolean; remainingAttempts: number; lockedUntil?: Date } {
  const cfg = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // Clean up expired entries
  if (entry) {
    // Check if lockout has expired
    if (entry.lockedUntil && entry.lockedUntil <= now) {
      rateLimitStore.delete(key);
      entry = undefined;
    }
    // Check if window has expired (reset counter)
    else if (!entry.lockedUntil && now - entry.firstAttempt > cfg.windowMs) {
      rateLimitStore.delete(key);
      entry = undefined;
    }
  }

  // If still locked out
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: new Date(entry.lockedUntil),
    };
  }

  // First attempt or expired window
  if (!entry) {
    rateLimitStore.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: cfg.maxAttempts - 1 };
  }

  // Increment counter
  entry.count++;

  // Check if limit exceeded
  if (entry.count > cfg.maxAttempts) {
    entry.lockedUntil = now + cfg.lockoutMs;
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: new Date(entry.lockedUntil),
    };
  }

  return {
    allowed: true,
    remainingAttempts: cfg.maxAttempts - entry.count,
  };
}

/**
 * Reset rate limit for a key (e.g., after successful login)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Secure storage wrapper that adds expiration and encryption hints
 * Note: This is client-side, so truly sensitive data should use server-side storage
 */
export const secureStorage = {
  /**
   * Store an item with optional expiration
   */
  set(key: string, value: unknown, expiresInMs?: number): void {
    const item = {
      value,
      timestamp: Date.now(),
      expiresAt: expiresInMs ? Date.now() + expiresInMs : null,
    };
    try {
      localStorage.setItem(key, JSON.stringify(item));
    } catch {
      // Storage full or disabled - fail silently
      console.warn("Failed to write to localStorage:", key);
    }
  },

  /**
   * Get an item, returning null if expired or not found
   */
  get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;

      const item = JSON.parse(itemStr);

      // Check expiration
      if (item.expiresAt && Date.now() > item.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }

      return item.value as T;
    } catch {
      return null;
    }
  },

  /**
   * Remove an item
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Fail silently
    }
  },

  /**
   * Clear all expired items
   */
  clearExpired(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const itemStr = localStorage.getItem(key);
          if (itemStr) {
            try {
              const item = JSON.parse(itemStr);
              if (item.expiresAt && Date.now() > item.expiresAt) {
                localStorage.removeItem(key);
              }
            } catch {
              // Not our format, skip
            }
          }
        }
      }
    } catch {
      // Fail silently
    }
  },
};

/**
 * Generate a cryptographically secure random string
 * Useful for CSRF tokens, nonces, etc.
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Simple hash function for non-sensitive data comparison
 * DO NOT use for passwords - that's handled by Supabase
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Check if the current session appears to be from a suspicious context
 * This is a basic check - serious security should be server-side
 */
export function detectSuspiciousActivity(): {
  suspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Check for dev tools (basic detection, can be bypassed)
  const devToolsThreshold = 160;
  if (
    window.outerWidth - window.innerWidth > devToolsThreshold ||
    window.outerHeight - window.innerHeight > devToolsThreshold
  ) {
    // Don't flag this as suspicious, just note it
    // Dev tools are legitimate for development
  }

  // Check for automation tools
  const navigatorAny = navigator as any;
  if (navigatorAny.webdriver) {
    reasons.push("Automated browser detected");
  }

  // Check for iframe embedding (potential clickjacking)
  if (window.self !== window.top) {
    reasons.push("Page is embedded in iframe");
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}
