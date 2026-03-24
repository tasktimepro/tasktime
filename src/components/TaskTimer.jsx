import { useMemo } from 'react';
import { formatDurationWithSeconds } from '../utils/dateUtils';
import TimerControls from './TimerControls';
import { useTimers } from '../hooks/useTimers';

/**
 * TaskTimer component - Shows task timer and timer controls
 * 
 * This component consolidates timer logic for consistent display and behavior
 * across all places where timers are shown (Dashboard, ProjectDashboard, etc.)
 * Now uses Yjs hooks directly for timer state, with synchronized time via master clock.
 */
const TaskTimer = ({
    task,
    size = 'normal',
    showTimeDisplay = true,
    isGlobalTimer = false,
    onComplete = null
}) => {
    // Use Yjs timer hook directly - elapsedTime is synchronized via master clock
    const { timers } = useTimers();
    
    const activeTimer = timers.find(timer => timer.taskId === task.id) || null;
    const isTimerActive = !!activeTimer;
    const isTimerPaused = isTimerActive && activeTimer.isPaused;
    const elapsedTime = activeTimer?.elapsedTime || 0;

    // Display time computed from synchronized elapsedTime (no individual interval needed)
    const currentTime = useMemo(() => {
        if (!isTimerActive || elapsedTime === 0) return '0s';
        return formatDurationWithSeconds(elapsedTime);
    }, [isTimerActive, elapsedTime]);

    return (
        <div className="flex items-center gap-2">
            {showTimeDisplay && isTimerActive && (
                <span className={`text-xs font-mono ${
                    isTimerPaused 
                        ? 'status-warning-text status-warning-surface' 
                        : 'status-danger-text status-danger-surface'
                } px-2 py-1 rounded-md min-w-[32px] inline-block text-center`}>
                    {currentTime}
                </span>
            )}
            
            <TimerControls
                task={task}
                size={size}
                isGlobalTimer={isGlobalTimer}
                onComplete={onComplete}
            />
        </div>
    );
};

export default TaskTimer;
