import React, { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export const TopProgressBar: React.FC = () => {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const active = fetching + mutating > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setVisible(true);
    } else {
      // Delay hide slightly for smooth UX
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [active]);

  return (
    <div
      aria-hidden={!visible}
      className="fixed top-0 left-0 right-0 z-[60] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.2s ease" }}
    >
      <div className="h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-fuchsia-500 animate-[progress_1.2s_linear_infinite]" />
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-[progress_1.2s_linear_infinite] {
          background-size: 200% 100%;
        }
      `}</style>
    </div>
  );
};

export default TopProgressBar;
