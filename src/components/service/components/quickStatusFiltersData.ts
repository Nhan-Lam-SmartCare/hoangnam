import type { ServiceTabKey, FilterColor, ServiceStats } from "../types/service.types";

export interface QuickStatusFilter {
  key: ServiceTabKey;
  label: string;
  color: FilterColor;
  count: number;
}

export const getQuickStatusFilters = (
  stats: ServiceStats,
  allCount: number
): QuickStatusFilter[] => [
  {
    key: "all",
    label: "Tất cả",
    color: "slate",
    count: allCount,
  },
  {
    key: "pending",
    label: "Tiếp nhận",
    color: "blue",
    count: stats.pending,
  },
  {
    key: "inProgress",
    label: "Đang sửa",
    color: "orange",
    count: stats.inProgress,
  },
  {
    key: "done",
    label: "Đã sửa xong",
    color: "green",
    count: stats.done,
  },
  {
    key: "delivered",
    label: "Đã trả máy",
    color: "purple",
    count: stats.delivered,
  },
];