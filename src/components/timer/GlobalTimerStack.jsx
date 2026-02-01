import React, { useState } from 'react';
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
    onClose
}) => {
    const { timers, focusTimer } = useTimers();
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedTimerId, setExpandedTimerId] = useState(null);

    if (timers.length === 0) {
        return null;
    }

    const focusedTimer = timers[0];
    const visibleTimers = isExpanded ? timers : [focusedTimer];
    const allowFocus = timers.length > 1;

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
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

            {!isExpanded && timers.length > 1 && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-muted text-xs text-muted-foreground px-2 py-0.5 rounded-full shadow">
                    +{timers.length - 1} more
                </div>
            )}
        </div>
    );
};

export default GlobalTimerStack;
