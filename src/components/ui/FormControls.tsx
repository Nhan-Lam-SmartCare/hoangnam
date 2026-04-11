import React from "react";

type UiInputProps = React.InputHTMLAttributes<HTMLInputElement>;
type UiSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const UiInput: React.FC<UiInputProps> = ({ className = "", ...props }) => (
  <input
    className={`h-10 w-full px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 ${className}`.trim()}
    {...props}
  />
);

export const UiSelect: React.FC<UiSelectProps> = ({ className = "", children, ...props }) => (
  <select
    className={`h-10 w-full px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${className}`.trim()}
    {...props}
  >
    {children}
  </select>
);
