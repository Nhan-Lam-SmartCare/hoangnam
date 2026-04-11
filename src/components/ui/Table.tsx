import React from "react";

type UiTableProps = {
  children: React.ReactNode;
  className?: string;
};

export const UiTableContainer: React.FC<UiTableProps> = ({ children, className = "" }) => (
  <div className={`app-surface rounded-xl overflow-auto ${className}`.trim()}>{children}</div>
);

export const UiTable: React.FC<UiTableProps> = ({ children, className = "" }) => (
  <table className={`w-full min-w-[860px] text-sm ${className}`.trim()}>{children}</table>
);

export const UiTableHead: React.FC<UiTableProps> = ({ children, className = "" }) => (
  <thead className={`bg-slate-100/90 dark:bg-slate-800/90 ${className}`.trim()}>{children}</thead>
);

export const UiTableRow: React.FC<UiTableProps> = ({ children, className = "" }) => (
  <tr className={`border-t border-slate-200 dark:border-slate-700 ${className}`.trim()}>{children}</tr>
);
