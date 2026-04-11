import React from "react";

type UiCardProps = {
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
};

export const UiCard: React.FC<UiCardProps> = ({ children, className = "", muted = false }) => {
  const base = muted ? "app-surface-muted" : "app-surface";
  return <div className={`${base} rounded-xl ${className}`.trim()}>{children}</div>;
};

export default UiCard;
