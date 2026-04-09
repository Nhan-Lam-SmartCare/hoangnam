import React from "react";

interface WorkOrderStatusStepperProps {
  currentStatus?: string;
  onStatusChange: (status: string) => void;
}

const STATUS_STEPS = [
  {
    value: "Tiếp nhận",
    label: "Tiếp nhận",
    activeClass:
      "bg-sky-600 text-white border-sky-500 shadow-sm shadow-sky-500/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h8M8 17h5M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
      </svg>
    ),
  },
  {
    value: "Đang sửa",
    label: "Đang sửa",
    activeClass:
      "bg-amber-500 text-white border-amber-400 shadow-sm shadow-amber-500/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 01-5.4 5.4l-5 5a1.5 1.5 0 102.1 2.1l5-5a4 4 0 005.4-5.4l-2.1 2.1-1.4-1.4 2.1-2.1z" />
      </svg>
    ),
  },
  {
    value: "Đã sửa xong",
    label: "Đã xong",
    activeClass:
      "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7L9 18l-5-5" />
      </svg>
    ),
  },
  {
    value: "Trả máy",
    label: "Trả máy",
    activeClass:
      "bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-500/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14v10H5zM9 19h6M12 15v4" />
      </svg>
    ),
  },
] as const;

export const WorkOrderStatusStepper: React.FC<WorkOrderStatusStepperProps> = ({
  currentStatus,
  onStatusChange,
}) => {
  return (
    <div className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/80 dark:bg-slate-900/30">
      <div className="grid grid-cols-4 gap-1.5">
        {STATUS_STEPS.map((step) => {
          const isActive = (currentStatus || "Tiếp nhận") === step.value;
          return (
            <button
              key={step.value}
              type="button"
              onClick={() => onStatusChange(step.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold border transition-all ${
                isActive
                  ? step.activeClass
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {step.icon}
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
