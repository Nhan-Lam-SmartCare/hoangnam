import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "rect" | "circle";
  width?: string | number;
  height?: string | number;
  count?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  variant = "text",
  width,
  height,
  count = 1,
}) => {
  const baseClasses =
    "bg-slate-200 dark:bg-slate-700 animate-pulse bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 bg-[length:200%_100%]";

  const variantClasses = {
    text: "rounded h-4",
    rect: "rounded-lg",
    circle: "rounded-full",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height)
    style.height = typeof height === "number" ? `${height}px` : height;

  if (count === 1) {
    return (
      <div
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        style={style}
      />
    );
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${baseClasses} ${variantClasses[variant]} ${className}`}
          style={style}
        />
      ))}
    </>
  );
};

export default Skeleton;

// Pre-built skeleton layouts
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-slate-200 dark:border-slate-700">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${100 / columns}%`} height={24} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} width={`${100 / columns}%`} height={20} />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton width={120} height={24} />
        <Skeleton variant="circle" width={40} height={40} />
      </div>
      <Skeleton count={3} className="mb-2" />
      <div className="flex gap-3">
        <Skeleton width={80} height={32} variant="rect" />
        <Skeleton width={80} height={32} variant="rect" />
      </div>
    </div>
  );
};

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-6">
      <Skeleton width={100} height={16} className="mb-3" />
      <Skeleton width={80} height={36} />
    </div>
  );
};

export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton variant="circle" width={48} height={48} />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height={20} />
            <Skeleton width="40%" height={16} />
          </div>
          <Skeleton width={80} height={32} variant="rect" />
        </div>
      ))}
    </div>
  );
};
