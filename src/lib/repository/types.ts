/**
 * Repository Result Types
 *
 * Provides a type-safe wrapper for repository operations using the Result pattern.
 * This pattern makes error handling explicit and forces callers to handle both
 * success and failure cases.
 *
 * @example
 * ```typescript
 * const result = await fetchParts();
 * if (result.ok) {
 *   console.log(result.data); // Type: Part[]
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */

/**
 * Successful repository operation result
 * @template T - The type of data returned on success
 */
export type RepoSuccess<T> = {
  /** Indicates successful operation */
  ok: true;
  /** The returned data */
  data: T;
  /** Optional metadata (e.g., pagination info) */
  meta?: Record<string, any>;
};

/**
 * Failed repository operation result
 */
export type RepoError = {
  /** Indicates failed operation */
  ok: false;
  /** Error details */
  error: RepoErrorDetail;
};

/**
 * Detailed error information for repository operations
 */
export interface RepoErrorDetail {
  /**
   * Error category for programmatic handling
   * - `network`: Connection/timeout errors
   * - `validation`: Invalid input data
   * - `not_found`: Resource doesn't exist
   * - `supabase`: Database/Supabase specific errors
   * - `unknown`: Unexpected errors
   */
  code: "network" | "validation" | "not_found" | "supabase" | "unknown";
  /** Human-readable error message (Vietnamese) */
  message: string;
  /** Original error for debugging */
  cause?: any;
}

/**
 * Union type representing either success or failure
 * @template T - The type of data returned on success
 */
export type RepoResult<T> = RepoSuccess<T> | RepoError;

/**
 * Creates a successful result wrapper
 * @template T - The type of data being wrapped
 * @param data - The data to wrap
 * @param meta - Optional metadata (e.g., { total: 100, page: 1, pageSize: 20 })
 * @returns A RepoSuccess object
 *
 * @example
 * ```typescript
 * const parts = await db.query('SELECT * FROM parts');
 * return success(parts, { total: parts.length });
 * ```
 */
export const success = <T>(
  data: T,
  meta?: Record<string, any>
): RepoSuccess<T> => ({ ok: true, data, meta });

/**
 * Creates a failure result wrapper
 * Automatically tracks errors in dev mode for the RepoErrorPanel
 *
 * @param detail - Error details including code, message, and optional cause
 * @returns A RepoError object
 *
 * @example
 * ```typescript
 * if (!input.name) {
 *   return failure({ code: 'validation', message: 'Tên không được trống' });
 * }
 * ```
 */
export const failure = (detail: RepoErrorDetail): RepoError => {
  // In dev, track errors globally for the RepoErrorPanel
  try {
    if (typeof window !== "undefined" && (import.meta as any)?.env?.DEV) {
      window.__repoErrors = window.__repoErrors || [];
      window.__repoErrors.push(detail);
      // Fire an event so listeners (Dev Error Panel) can update immediately
      window.dispatchEvent(new CustomEvent("repo-error", { detail }));
    }
  } catch {}
  return {
    ok: false,
    error: detail,
  };
};

// Collect errors globally in dev for RepoErrorPanel
declare global {
  interface Window {
    __repoErrors?: RepoErrorDetail[];
  }
}
if (typeof window !== "undefined") {
  window.__repoErrors = window.__repoErrors || [];
}

// Legacy explicit tracking helper (now automatic via failure in dev)
export const failureWithTrack = failure;

/**
 * Formats a repository error for admin/developer display
 * Includes error code as prefix and any Supabase-specific details
 *
 * @param err - The error detail to format
 * @returns Formatted error string like "[SUPABASE] Query failed :: duplicate key"
 *
 * @example
 * ```typescript
 * console.error(mapRepoErrorForAdmin(result.error));
 * // Output: "[VALIDATION] Thiếu tên phụ tùng"
 * ```
 */
export const mapRepoErrorForAdmin = (err: RepoErrorDetail): string => {
  const code = err.code.toUpperCase();
  const base = `[${code}] ${err.message}`;
  if (err.code === "supabase" && err.cause?.message) {
    return `${base} :: ${err.cause.message}`;
  }
  return base;
};
