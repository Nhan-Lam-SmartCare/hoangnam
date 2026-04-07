import React from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "red" | "blue" | "green";
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  confirmColor = "blue",
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const colorClasses = {
    red: "bg-red-600 hover:bg-red-700",
    blue: "bg-blue-600 hover:bg-blue-700",
    green: "bg-emerald-600 hover:bg-emerald-700",
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full animate-scaleIn">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                confirmColor === "red"
                  ? "bg-red-100 dark:bg-red-900/30"
                  : confirmColor === "green"
                  ? "bg-emerald-100 dark:bg-emerald-900/30"
                  : "bg-blue-100 dark:bg-blue-900/30"
              }`}
            >
              {confirmColor === "red" ? (
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              ) : confirmColor === "green" ? (
                <svg
                  className="w-6 h-6 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 text-white rounded-lg transition-colors font-medium ${colorClasses[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
