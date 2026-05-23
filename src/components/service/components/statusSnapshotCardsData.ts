import type { ServiceTabKey, ServiceStats } from "../types/service.types";

export interface StatusSnapshotCard {
  key: ServiceTabKey;
  label: string;
  value: number;
  subtitle: string;
  accent: string;
  dot: string;
  icon: string;
  glow: string;
  textColor: string;
}

export const getStatusSnapshotCards = (
  stats: ServiceStats
): StatusSnapshotCard[] => [
  {
    key: "pending",
    label: "Tiếp nhận",
    value: stats.pending,
    subtitle: "Chờ phân công",
    accent: "from-sky-500/10 via-sky-500/5 to-transparent dark:from-sky-500/15 dark:via-sky-500/5 dark:to-transparent",
    dot: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]",
    icon: "Wrench",
    glow: "hover:border-sky-500/40 hover:shadow-[0_0_20px_rgba(14,165,233,0.15)]",
    textColor: "text-sky-600 dark:text-sky-400",
  },
  {
    key: "inProgress",
    label: "Đang sửa",
    value: stats.inProgress,
    subtitle: "Đang thi công",
    accent: "from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:via-amber-500/5 dark:to-transparent",
    dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse",
    icon: "Settings",
    glow: "hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "done",
    label: "Đã sửa xong",
    value: stats.done,
    subtitle: "Chờ giao khách",
    accent: "from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/15 dark:via-emerald-500/5 dark:to-transparent",
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
    icon: "Check",
    glow: "hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    textColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "delivered",
    label: "Trả máy",
    value: stats.delivered,
    subtitle: "Hoàn tất",
    accent: "from-purple-500/10 via-purple-500/5 to-transparent dark:from-purple-500/15 dark:via-purple-500/5 dark:to-transparent",
    dot: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]",
    icon: "HandCoins",
    glow: "hover:border-purple-500/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]",
    textColor: "text-purple-600 dark:text-purple-400",
  },
];