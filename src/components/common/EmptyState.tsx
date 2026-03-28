import React from "react";
import { Boxes, Search, ClipboardList, AlertTriangle } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Boxes className="w-16 h-16 opacity-50" />,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fadeIn">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

// Pre-built empty states
export const NoResultsFound: React.FC = () => (
  <EmptyState
    icon={<Search className="w-16 h-16 opacity-50" />}
    title="Không tìm thấy kết quả"
    description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
  />
);

export const NoDataYet: React.FC<{
  entityName: string;
  onAdd?: () => void;
}> = ({ entityName, onAdd }) => (
  <EmptyState
    icon={<ClipboardList className="w-16 h-16 opacity-50" />}
    title={`Chưa có ${entityName} nào`}
    description={`Thêm ${entityName} đầu tiên để bắt đầu`}
    action={
      onAdd
        ? {
            label: `Thêm ${entityName}`,
            onClick: onAdd,
          }
        : undefined
    }
  />
);

export const ErrorState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <EmptyState
    icon={<AlertTriangle className="w-16 h-16 opacity-50" />}
    title="Đã xảy ra lỗi"
    description="Không thể tải dữ liệu. Vui lòng thử lại."
    action={
      onRetry
        ? {
            label: "Thử lại",
            onClick: onRetry,
          }
        : undefined
    }
  />
);
