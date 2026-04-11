import React from "react";

type UiModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export const UiModal: React.FC<UiModalProps> = ({ open, title, onClose, children, className = "" }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className={`app-surface w-full max-w-xl rounded-2xl overflow-hidden ${className}`.trim()}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title || "Thông tin"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

export default UiModal;
