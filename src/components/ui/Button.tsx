import React from "react";

type UiButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type UiButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiButtonVariant;
};

const variantClassMap: Record<UiButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 disabled:bg-blue-400/60",
  secondary:
    "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700",
  ghost:
    "bg-transparent text-slate-700 dark:text-slate-200 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700",
  danger:
    "bg-red-600 text-white border border-red-600 hover:bg-red-700 disabled:bg-red-400/60",
};

export const UiButton: React.FC<UiButtonProps> = ({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}) => {
  return (
    <button
      type={type}
      className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${variantClassMap[variant]} ${className}`.trim()}
      {...props}
    />
  );
};

export default UiButton;
