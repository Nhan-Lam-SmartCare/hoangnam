import React, { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
    onRefresh: () => Promise<any>;
    children: React.ReactNode;
    disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
    onRefresh,
    children,
    disabled = false,
}) => {
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Threshold values
    const PULL_THRESHOLD = 80; // Distance to pull to trigger refresh
    const MAX_PULL = 120; // Max visual pull distance

    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled || isRefreshing || !containerRef.current) return;

        // Only enable pull if we are at the top of the scroll container
        if (containerRef.current.scrollTop <= 0) {
            setStartY(e.touches[0].clientY);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (disabled || isRefreshing || startY === 0) return;

        const y = e.touches[0].clientY;
        const diff = y - startY;

        // Only allow pulling down
        if (diff > 0 && containerRef.current?.scrollTop === 0) {
            // Add resistance to the pull
            const resistance = 0.5;
            const dampedDiff = Math.min(diff * resistance, MAX_PULL);

            setCurrentY(dampedDiff);

            // Prevent default scrolling behavior when pulling
            if (e.cancelable) {
                // e.preventDefault(); // Commenting out as it might interfere with normal scroll in some browsers
            }
        }
    };

    const handleTouchEnd = async () => {
        if (disabled || isRefreshing || startY === 0) {
            setStartY(0);
            setCurrentY(0);
            return;
        }

        if (currentY >= PULL_THRESHOLD) {
            setIsRefreshing(true);
            setCurrentY(50); // Keep loading spinner visible

            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setCurrentY(0);
                setStartY(0);
            }
        } else {
            // Snap back
            setCurrentY(0);
            setStartY(0);
        }
    };

    return (
        <div
            ref={containerRef}
            className="h-full overflow-y-auto overscroll-contain relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Loading Indicator */}
            <div
                className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-transform duration-200"
                style={{
                    transform: `translateY(${currentY > 0 ? currentY - 40 : -40}px)`,
                    opacity: currentY > 0 ? 1 : 0
                }}
            >
                <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg border border-slate-200 dark:border-slate-700">
                    <Loader2
                        className={`w-5 h-5 text-blue-500 ${isRefreshing || currentY >= PULL_THRESHOLD ? "animate-spin" : ""}`}
                        style={{
                            transform: !isRefreshing && currentY < PULL_THRESHOLD ? `rotate(${currentY * 3}deg)` : undefined
                        }}
                    />
                </div>
            </div>

            {/* Content */}
            <div
                ref={contentRef}
                className="transition-transform duration-200 ease-out min-h-full"
                style={{ transform: `translateY(${currentY}px)` }}
            >
                {children}
            </div>
        </div>
    );
};
