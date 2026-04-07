import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "blue" | "white" | "slate";
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  color = "blue",
  text,
}) => {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  const colorClasses = {
    blue: "border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400",
    white: "border-white/30 border-t-white",
    slate:
      "border-slate-200 dark:border-slate-700 border-t-slate-600 dark:border-t-slate-400",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-spin`}
      ></div>
      {text && (
        <p className="text-sm text-slate-600 dark:text-slate-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;

// Full page loading overlay
export const LoadingOverlay: React.FC<{ text?: string }> = ({ text }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-8">
        <LoadingSpinner size="lg" text={text || "Đang xử lý..."} />
      </div>
    </div>
  );
};

// Inline loading for buttons
export const ButtonSpinner: React.FC = () => {
  return (
    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
  );
};
