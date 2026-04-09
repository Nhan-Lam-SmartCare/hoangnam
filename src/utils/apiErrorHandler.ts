/**
 * Global API Error Handler
 *
 * Centralized error handling for all repository operations and API calls.
 * Provides consistent toast notifications, developer logging, and offline detection.
 */

import { showToast } from "./toast";
import { RepoErrorDetail } from "../lib/repository/types";
import { mapRepoErrorForUser } from "./errorMapping";

export interface ErrorHandlerContext {
  /** Optional custom message to show instead of the auto-mapped one */
  customMessage?: string;
  /** Silently log the error without showing a toast to the user */
  silent?: boolean;
  /** Component or action name for debugging (e.g. "WorkOrder.Save") */
  context?: string;
  /** Function to call when user retries the action */
  onRetry?: () => void;
}

/**
 * Handle API / Repository errors centrally.
 *
 * @param error - The RepoErrorDetail object returned from repository functions
 * @param options - Additional context and options
 */
export function handleApiError(
  error: RepoErrorDetail | any,
  options?: ErrorHandlerContext
): void {
  // Normalize error
  let normalizedError: RepoErrorDetail;
  if ("code" in error && "message" in error) {
    normalizedError = error;
  } else {
    normalizedError = {
      code: "unknown",
      message: error?.message || "Đã xảy ra lỗi không xác định",
      cause: error,
    };
  }

  // Handle offline specific case explicitly if it's not a standard RepoError
  if (!navigator.onLine) {
    normalizedError.code = "offline" as any;
  }

  // Developer Logging
  if (import.meta.env?.DEV) {
    console.error(
      `[API_ERROR] ${options?.context ? `[${options.context}]` : ""}`,
      {
        code: normalizedError.code,
        msg: normalizedError.message,
        cause: normalizedError.cause,
      }
    );
  }

  // If silent, stop here
  if (options?.silent) {
    return;
  }

  // Map to user-friendly message
  const displayMessage =
    options?.customMessage || mapRepoErrorForUser(normalizedError);

  // Show Toast
  switch (normalizedError.code) {
    case "offline" as any:
    case "network":
      // Provide retry button on toast for network errors if onRetry provided
      // Wait, native react-toastify doesn't easily support buttons inside toast via string.
      // Easiest is to just show standard toast.
      showToast.warning(displayMessage, { autoClose: 5000 });
      break;

    case "validation":
      showToast.warning(displayMessage);
      break;

    case "permission" as any:
      showToast.error(`⛔ ${displayMessage}`, { autoClose: 7000 });
      break;

    default:
      showToast.error(displayMessage);
      break;
  }
}

/**
 * Execute an async API call with automatic error handling.
 * Useful for easy wrapping inside React components.
 *
 * @example
 * ```typescript
 * await withApiErrorHandling(
 *   async () => await fetchParts(),
 *   { context: "LoadParts", silent: false }
 * );
 * ```
 */
export async function withApiErrorHandling<T>(
  action: () => Promise<T>,
  options?: ErrorHandlerContext
): Promise<T | null> {
  try {
    const result = await action();
    // Assuming result might be a RepoResult
    if (result && typeof result === "object" && "ok" in result && !result.ok) {
      handleApiError((result as any).error, options);
      return null;
    }
    return result;
  } catch (err) {
    handleApiError(err, options);
    return null;
  }
}
