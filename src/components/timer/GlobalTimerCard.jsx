import React from 'react';
import GlobalTimer from '../GlobalTimer';

/**
 * GlobalTimerCard component - Single timer card for the stack
 * @param {Object} props
 * @param {Object} props.timer - Timer data
 * @param {Function} props.onFocus - Focus handler
 * @param {Function} props.navigateToProject - Navigate to project handler
 * @param {(task: Object) => void} props.onOpenTaskView - Open task view modal
 * @param {Function} props.onClose - Close handler
 */
const GlobalTimerCard = ({
    timer,
    onFocus,
    isExpanded = false,
    onToggleExpanded,
    navigateToProject,
    onOpenTaskView,
    onClose
}) => {
    const handleFocus = () => {
        if (onFocus && timer?.projectId) {
            onFocus(timer.projectId);
        }
    };

    const handleToggleExpanded = (nextValue) => {
        if (onToggleExpanded) {
            onToggleExpanded(nextValue);
        }
    };

    const isTypingElement = (target) => {
        if (!(target instanceof HTMLElement)) return false;

        const tagName = target.tagName?.toLowerCase();
        return tagName === 'input'
            || tagName === 'textarea'
            || tagName === 'select'
            || target.isContentEditable;
    };

    return (
        <div
            className="transition-all bg-card shadow-md cursor-pointer rounded-lg"
            onClick={handleFocus}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
                if (isTypingElement(event.target)) {
                    return;
                }

                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleFocus();
                }
            }}
        >
            <GlobalTimer
                key={`${timer?.projectId || 'none'}-${timer?.startTime || 'none'}-${timer?.note || ''}`}
                timer={timer}
                navigateToProject={navigateToProject}
                onOpenTaskView={onOpenTaskView}
                onClose={onClose}
                isExpanded={isExpanded}
                onToggleExpanded={handleToggleExpanded}
            />
        </div>
    );
};

export default GlobalTimerCard;
