import { useState, useEffect } from 'react';
import { formatActiveTimer } from '../utils/dateUtils';
import TimerControls from './TimerControls';
import { useTimer } from '../hooks/useTimer';
import { TIMER_UPDATE_INTERVAL_MS } from '../constants/app';

/**
 * TaskTimer component - Shows task timer and timer controls
 * 
 * This component consolidates timer logic for consistent display and behavior
 * across all places where timers are shown (Dashboard, ProjectDashboard, etc.)
 * Now uses Yjs hooks directly for timer state.
 */
const TaskTimer = ({
    task,
    size = 'normal',
    showTimeDisplay = true,
    isGlobalTimer = false,
    onComplete = null
}) => {
    const [currentTime, setCurrentTime] = useState('');
    
    // Use Yjs timer hook directly
    const { isActive, isPaused, taskId, elapsedTime } = useTimer();
    
    const isTimerActive = isActive && taskId === task.id;
    const isTimerPaused = isTimerActive && isPaused;

    // Update timer display every second
    useEffect(() => {
        if (!isTimerActive) return;
        
        // For paused timers, just show the elapsed time once
        if (isTimerPaused) {
            const formattedTime = formatActiveTimer(elapsedTime);
            setCurrentTime(formattedTime);
            return;
        }
        
        // For active timers, update every second
        const updateTimer = () => {
            const formattedTime = formatActiveTimer(elapsedTime);
            setCurrentTime(formattedTime);
        };

        // Update immediately
        updateTimer();

        // Then update every second
        const interval = setInterval(updateTimer, TIMER_UPDATE_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [isTimerActive, isTimerPaused, elapsedTime]);

    return (
        <div className="flex items-center space-x-2">
            {showTimeDisplay && isTimerActive && (
                <span className={`text-xs font-mono ${
                    isTimerPaused 
                        ? 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900' 
                        : 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900'
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
