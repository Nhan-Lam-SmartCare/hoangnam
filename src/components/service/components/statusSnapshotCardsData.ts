import type { ServiceTabKey, ServiceStats } from "../types/service.types";

export interface StatusSnapshotCard {
  key: ServiceTabKey;
  label: string;
  value: number;
  subtitle: string;
  accent: string;
  dot: string;
}

export const getStatusSnapshotCards = (
  stats: ServiceStats
): StatusSnapshotCard[] => [
  {
    key: "pending",
    label: "Tiếp nhận",
    value: stats.pending,
    subtitle: "Chờ phân công",
    accent:
      "from-sky-50 via-sky-50 to-white dark:from-sky-900/30 dark:via-sky-900/10",
    dot: "bg-sky-500",
  },
  {
    key: "inProgress",
    label: "Đang sửa",
    value: stats.inProgress,
    subtitle: "Đang thi công",
    accent:
      "from-amber-50 via-amber-50 to-white dark:from-amber-900/30 dark:via-amber-900/10",
    dot: "bg-amber-500",
  },
  {
    key: "done",
    label: "Đã sửa xong",
    value: stats.done,
    subtitle: "Chờ giao khách",
    accent:
      "from-emerald-50 via-emerald-50 to-white dark:from-emerald-900/30 dark:via-emerald-900/10",
    dot: "bg-emerald-500",
  },
  {
    key: "delivered",
    label: "Trả máy",
    value: stats.delivered,
    subtitle: "Hoàn tất",
    accent:
      "from-purple-50 via-purple-50 to-white dark:from-purple-900/30 dark:via-purple-900/10",
    dot: "bg-purple-500",
  },
];