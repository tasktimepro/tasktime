import React, { useEffect, useRef, useState } from 'react';
import { useTimers } from '../../hooks/useTimers';
import GlobalTimerCard from './GlobalTimerCard';

/**
 * GlobalTimerStack component - Shows active timers in a stacked layout
 * @param {Object} props - Component props
 * @param {Function} props.navigateToProject - Function to navigate to project page
 * @param {(task: Object) => void} props.onOpenTaskView - Open task view modal
 * @param {Function} props.onClose - Function called when timer stack is closed
 */
const GlobalTimerStack = ({
    navigateToProject,
    onOpenTaskView,
    onClose,
    enableHoverExpansion = true,
    enableManualToggle = false,
}) => {
    const { timers, focusTimer } = useTimers();
    const stackRef = useRef(null);
    const [isHoverExpanded, setIsHoverExpanded] = useState(false);
    const [isManualExpanded, setIsManualExpanded] = useState(false);
    const [expandedTimerId, setExpandedTimerId] = useState(null);

    const setStackExpanded = (nextValue) => {
        setIsManualExpanded(nextValue);

        if (!nextValue) {
            setExpandedTimerId(null);
        }
    };

    useEffect(() => {
        if (!isManualExpanded) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (!stackRef.current?.contains(event.target)) {
                setStackExpanded(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [isManualExpanded]);

    useEffect(() => {
        if (timers.length <= 1) {
            setIsHoverExpanded(false);
            setIsManualExpanded(false);
            setExpandedTimerId(null);
        }
    }, [timers.length]);

    if (timers.length === 0) {
        return null;
    }

    const isExpanded = isHoverExpanded || isManualExpanded;
    const focusedTimer = timers[0];
    const visibleTimers = isExpanded ? timers : [focusedTimer];
    const allowFocus = timers.length > 1;
    const extraTimerCount = timers.length - 1;

    return (
        <div
            ref={stackRef}
            className="relative"
            onMouseEnter={() => {
                if (enableHoverExpansion) {
                    setIsHoverExpanded(true);
                }
            }}
            onMouseLeave={() => {
                if (enableHoverExpansion) {
                    setIsHoverExpanded(false);
                }
            }}
        >
            <div className="space-y-2">
                {visibleTimers.map((timer, index) => (
                    <div
                        key={timer.projectId}
                        style={isExpanded ? {} : { transform: `translateY(${index * -6}px)` }}
                    >
                        <GlobalTimerCard
                            timer={timer}
                            isFocused={timer.projectId === focusedTimer.projectId}
                            onFocus={allowFocus ? focusTimer : null}
                            isExpanded={expandedTimerId === timer.projectId}
                            onToggleExpanded={(nextValue) => {
                                setExpandedTimerId(nextValue ? timer.projectId : null);
                            }}
                            navigateToProject={navigateToProject}
                            onOpenTaskView={onOpenTaskView}
                            onClose={onClose}
                        />
                    </div>
                ))}
            </div>

            {!enableManualToggle && !isExpanded && timers.length > 1 && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shadow">
                    +{extraTimerCount} more
                </div>
            )}

            {enableManualToggle && timers.length > 1 && (
                <div className={isExpanded ? 'mt-2 flex justify-center' : 'absolute -bottom-3 left-1/2 flex -translate-x-1/2 justify-center'}>
                    <button
                        type="button"
                        className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground shadow transition-colors hover:bg-accent"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Hide extra timers' : `Show ${timers.length} timers`}
                        onClick={() => setStackExpanded(!isExpanded)}
                    >
                        {isExpanded ? 'Hide extra timers' : `+${extraTimerCount} more`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default GlobalTimerStack;
