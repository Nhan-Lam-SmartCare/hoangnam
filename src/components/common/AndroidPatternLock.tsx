import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCcw } from 'lucide-react';

interface AndroidPatternLockProps {
    onPatternComplete?: (pattern: string) => void;
    className?: string;
    initialValue?: string; // Format "1-2-3-4"
    readOnly?: boolean;
}

export const AndroidPatternLock: React.FC<AndroidPatternLockProps> = ({
    onPatternComplete,
    className = '',
    initialValue = '',
    readOnly = false
}) => {
    // Initialize state from initialValue if present
    const [pattern, setPattern] = useState<number[]>(() => {
        if (!initialValue) return [];
        return initialValue.split('-').map(Number).filter(n => !isNaN(n));
    });

    // Update pattern when initialValue changes matches
    useEffect(() => {
        if (initialValue) {
            setPattern(initialValue.split('-').map(Number).filter(n => !isNaN(n)));
        }
    }, [initialValue]);

    const [isDragging, setIsDragging] = useState(false);
    const svgRef = useRef<SVGSVGElement>(null);

    // Grid configuration
    const DOT_RADIUS = 6;
    const ACTIVE_DOT_RADIUS = 12; // Larger halo
    const HIT_RADIUS = 25; // Hit area
    const GRID_SIZE = 3;
    const GAP = 80;
    const OFFSET = 40;

    // 1-9 coordinates
    const dots = Array.from({ length: 9 }, (_, i) => ({
        id: i + 1,
        x: (i % GRID_SIZE) * GAP + OFFSET,
        y: Math.floor(i / GRID_SIZE) * GAP + OFFSET
    }));

    const getTouchedDot = (clientX: number, clientY: number) => {
        if (!svgRef.current) return null;
        const rect = svgRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        return dots.find(dot => {
            const distance = Math.sqrt(Math.pow(dot.x - x, 2) + Math.pow(dot.y - y, 2));
            return distance < HIT_RADIUS;
        });
    };

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (readOnly) return; // Disable interaction if readOnly
        e.preventDefault(); // Prevent scrolling on touch
        setIsDragging(true);
        setPattern([]);

        // Check initial touch
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const dot = getTouchedDot(clientX, clientY);
        if (dot) {
            setPattern([dot.id]);
        }
    };

    const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging || readOnly) return;
        e.preventDefault();

        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

        const dot = getTouchedDot(clientX, clientY);
        if (dot && !pattern.includes(dot.id)) {
            // Optional: Check for skipping dots (e.g. 1->3 should capture 2).
            // For simplicity, we assume direct connection or implement midpoint logic later if needed.
            // Implementing simple midway point check:
            const lastDotId = pattern[pattern.length - 1];
            if (lastDotId) {
                const lastDot = dots.find(d => d.id === lastDotId)!;
                // Check if midpoint is skipped
                const midX = (lastDot.x + dot.x) / 2;
                const midY = (lastDot.y + dot.y) / 2;
                const midDot = dots.find(d => Math.abs(d.x - midX) < 5 && Math.abs(d.y - midY) < 5);
                if (midDot && !pattern.includes(midDot.id)) {
                    setPattern(prev => [...prev, midDot.id, dot.id]);
                    return;
                }
            }
            setPattern(prev => [...prev, dot.id]);
        }
    }, [isDragging, pattern, readOnly]);

    const handleEnd = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            if (pattern.length > 0 && onPatternComplete) {
                onPatternComplete(pattern.join('-'));
            }
        }
    }, [isDragging, pattern, onPatternComplete]);

    // Global event listeners for drag outside the SVG
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, handleMove, handleEnd]);

    const containerSize = GAP * 2 + OFFSET * 2;
    // Scale down if readOnly to make it smaller
    const scale = readOnly ? 0.6 : 1;
    const size = containerSize * scale;

    return (
        <div className={`flex flex-col items-center ${className}`}>
            <div className="relative mb-2 select-none touch-none"
                style={{
                    width: size,
                    height: size,
                }}
                onMouseDown={handleStart}
                onTouchStart={handleStart}
            >
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <svg
                        ref={svgRef}
                        width={containerSize}
                        height={containerSize}
                        className={`rounded-3xl shadow-inner block ${readOnly ? 'bg-transparent border border-slate-200 dark:border-slate-700' : 'bg-slate-100 dark:bg-slate-800 cursor-pointer'}`}
                        style={{ touchAction: 'none' }}
                    >
                        {/* Connection Lines */}
                        <polyline
                            points={pattern.map(id => {
                                const d = dots.find(d => d.id === id);
                                return `${d?.x},${d?.y}`;
                            }).join(' ')}
                            fill="none"
                            stroke={readOnly ? "#10b981" : "#3b82f6"} // Emerald for readonly (view), Blue for edit
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-80"
                        />

                        {/* Dots */}
                        {dots.map(dot => {
                            const isActive = pattern.includes(dot.id);
                            return (
                                <g key={dot.id}>
                                    {/* Hit area (invisible) */}
                                    <circle cx={dot.x} cy={dot.y} r={HIT_RADIUS} fill="transparent" />
                                    {/* Outer Glow for active */}
                                    {!readOnly && (
                                        <circle
                                            cx={dot.x}
                                            cy={dot.y}
                                            r={isActive ? ACTIVE_DOT_RADIUS : 0}
                                            fill="rgba(59, 130, 246, 0.2)"
                                            className="transition-all duration-300"
                                        />
                                    )}
                                    {/* Core Dot */}
                                    <circle
                                        cx={dot.x}
                                        cy={dot.y}
                                        r={DOT_RADIUS}
                                        fill={isActive ? (readOnly ? "#10b981" : "#3b82f6") : "#94a3b8"}
                                        className="transition-colors duration-200"
                                    />
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>

            {!readOnly && pattern.length > 0 && (
                <button
                    onClick={() => { setPattern([]); if (onPatternComplete) onPatternComplete(""); }}
                    className="text-xs flex items-center gap-1 text-slate-500 hover:text-red-500 transition-colors mt-2"
                >
                    <RefreshCcw className="w-3 h-3" /> Vẽ lại
                </button>
            )}
        </div>
    );
};
