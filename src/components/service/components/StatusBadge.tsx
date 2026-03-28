import React from "react";

export type WorkOrderStatus =
  | "Tiếp nhận"
  | "Đang sửa"
  | "Đã sửa xong"
  | "Trả máy";

const StatusBadge: React.FC<{ status: WorkOrderStatus }> = ({ status }) => {
  const styles = {
    "Tiếp nhận":
      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    "Đang sửa":
      "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    "Đã sửa xong":
      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    "Trả máy":
      "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  };

  return (
    <span
      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
