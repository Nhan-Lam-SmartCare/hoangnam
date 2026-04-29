/**
 * Service-related constants
 * Extracted from ServiceManager.tsx for better organization
 */

/**
 * Danh sách thiết bị phổ biến — re-export từ file dùng chung.
 * Chỉnh sửa tại src/constants/devices.ts
 */
export { POPULAR_DEVICES as POPULAR_MOTORCYCLES, POPULAR_DEVICES } from "../../../constants/devices";

export type DeviceModel = string;

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
