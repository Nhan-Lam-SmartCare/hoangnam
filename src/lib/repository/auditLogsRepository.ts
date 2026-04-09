/**
 * Audit Logs Repository
 *
 * Provides fire-and-forget audit logging for important user actions.
 * Uses a batched queue to minimize network requests.
 * Falls back to localStorage when the audit_logs table doesn't exist yet.
 *
 * Usage:
 *   import { safeAudit } from "./auditLogsRepository";
 *   safeAudit(userId, { action: "auth.login" });
 *   safeAudit(userId, {
 *     action: "work_order.create",
 *     entityType: "work_order",
 *     entityId: orderId,
 *     details: { total, customerName },
 *   });
 */

import { supabase } from "../../supabaseClient";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface AuditEntry {
  /** Action identifier, e.g. "auth.login", "work_order.create" */
  action: string;
  /** Entity type, e.g. "work_order", "cash_transaction" */
  entityType?: string;
  /** ID of the affected record */
  entityId?: string;
  /** Additional context (old/new values, metadata) */
  details?: Record<string, any>;
  /** Branch ID override (defaults to "CN1") */
  branchId?: string;
}

interface QueuedEntry extends AuditEntry {
  userId: string | null;
  timestamp: string;
}

// ────────────────────────────────────────────
// Internal State
// ────────────────────────────────────────────

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5_000; // Flush every 5 seconds
const LOCAL_STORAGE_KEY = "motocare_audit_queue";
const TABLE_MISSING_FLAG = "motocare_audit_table_missing";

let queue: QueuedEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let tableMissing = false;

// Check if we already know the table is missing
try {
  tableMissing = localStorage.getItem(TABLE_MISSING_FLAG) === "1";
} catch {
  // localStorage not available
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Log an audit event (fire-and-forget).
 * Never throws — errors are silently logged to console.
 *
 * @param userId - The user performing the action (null for system actions)
 * @param entry  - Audit entry details
 */
export function safeAudit(
  userId: string | null,
  entry: AuditEntry
): void {
  try {
    const queuedEntry: QueuedEntry = {
      ...entry,
      userId,
      timestamp: new Date().toISOString(),
    };

    queue.push(queuedEntry);

    // Auto-flush when batch is full
    if (queue.length >= BATCH_SIZE) {
      void flushQueue();
    }

    // Start periodic flush timer if not already running
    if (!flushTimer) {
      flushTimer = setInterval(() => {
        void flushQueue();
      }, FLUSH_INTERVAL_MS);
    }
  } catch (err) {
    // safeAudit must NEVER throw
    console.warn("[AuditLog] Failed to queue audit entry:", err);
  }
}

/**
 * Force-flush the audit queue (e.g. before page unload).
 * Returns the number of entries successfully flushed.
 */
export async function flushQueue(): Promise<number> {
  if (queue.length === 0) return 0;

  // Drain the queue atomically
  const batch = queue.splice(0);

  // If we know the table is missing, save to localStorage
  if (tableMissing) {
    saveToLocalStorage(batch);
    return 0;
  }

  try {
    const rows = batch.map((entry) => ({
      user_id: entry.userId || null,
      action: entry.action,
      entity_type: entry.entityType || null,
      entity_id: entry.entityId || null,
      details: entry.details || {},
      branch_id: entry.branchId || "CN1",
      created_at: entry.timestamp,
    }));

    const { error } = await supabase.from("audit_logs").insert(rows);

    if (error) {
      // Check if table doesn't exist
      const msg = String(error.message || "").toLowerCase();
      if (
        msg.includes("does not exist") ||
        msg.includes("could not find") ||
        (error as any)?.code === "PGRST205"
      ) {
        tableMissing = true;
        try {
          localStorage.setItem(TABLE_MISSING_FLAG, "1");
        } catch {
          // Ignore
        }
        console.warn(
          "[AuditLog] audit_logs table not found. Run sql/create_audit_logs.sql to enable audit logging. Falling back to localStorage."
        );
        saveToLocalStorage(batch);
        return 0;
      }

      // Other error — put entries back in queue for retry
      console.warn("[AuditLog] Insert failed, will retry:", error.message);
      queue.unshift(...batch);
      return 0;
    }

    return batch.length;
  } catch (err) {
    // Network error — save to localStorage for later
    console.warn("[AuditLog] Network error, saving to localStorage:", err);
    saveToLocalStorage(batch);
    return 0;
  }
}

// ────────────────────────────────────────────
// LocalStorage Fallback
// ────────────────────────────────────────────

function saveToLocalStorage(entries: QueuedEntry[]): void {
  try {
    const existing = getLocalStorageEntries();
    const combined = [...existing, ...entries];
    // Keep only last 200 entries to prevent storage overflow
    const trimmed = combined.slice(-200);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently drop
  }
}

function getLocalStorageEntries(): QueuedEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Retry flushing entries saved in localStorage to the database.
 * Call this periodically or on app startup after the table is created.
 */
export async function retryLocalStorageEntries(): Promise<number> {
  if (tableMissing) return 0;

  const entries = getLocalStorageEntries();
  if (entries.length === 0) return 0;

  // Clear localStorage first to prevent double-processing
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // Ignore
  }

  // Add to queue and flush
  queue.push(...entries);
  return flushQueue();
}

// ────────────────────────────────────────────
// Cleanup on page unload
// ────────────────────────────────────────────

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (queue.length > 0) {
      // Save remaining entries to localStorage before page closes
      saveToLocalStorage(queue.splice(0));
    }
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  });
}
