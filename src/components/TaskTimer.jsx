import { useState, useEffect } from 'react';
import { formatActiveTimer } from '../utils/dateUtils';
import TimerControls from './TimerControls.jsx';
import { TIMER_UPDATE_INTERVAL_MS } from '../constants/app';

/**
 * TaskTimer component - Shows task timer and timer controls
 * 
 * This component consolidates timer logic for consistent display and behavior
 * across all places where timers are shown (Dashboard, ProjectDashboard, etc.)
 */
const TaskTimer = ({
    task,
    timeEntries,
    setTimeEntries,
    tasks = [], // All tasks for overlap validation
    currentTimer,
    setCurrentTimer,
    isPaused = false,
    setIsPaused = null,
    pausedElapsedTime = 0,
    setPausedElapsedTime = null,
    size = 'normal',
    showTimeDisplay = true,
    isGlobalTimer = false,
    onComplete = null,
    setTasks = null
}) => {
    const [currentTime, setCurrentTime] = useState('');
    const [pausedTime, setPausedTime] = useState('');
    
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    // Update timer display every second
    useEffect(() => {
        if (!currentTimer || currentTimer.taskId !== task.id) return;
        
        // For active timers, show elapsed time since start
        const updateTimer = () => {
            if (isPaused) return; // Skip updates when paused
            
            // Calculate elapsed time in ms for active timer
            const elapsedMs = Date.now() - currentTimer.startTime;
            // Format to time string
            const formattedTime = formatActiveTimer(elapsedMs);
            setCurrentTime(formattedTime);
        };

        // Update immediately
        updateTimer();

        // Then update every second
        const interval = setInterval(updateTimer, TIMER_UPDATE_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [currentTimer, isPaused, task.id]);

    // For paused timers, display the paused elapsed time
    useEffect(() => {
        if (isPaused && pausedElapsedTime > 0 && currentTimer?.taskId === task.id) {
            // Format the paused elapsed time directly (it's already in ms)
            const formattedPausedTime = formatActiveTimer(pausedElapsedTime);
            setPausedTime(formattedPausedTime);
        }
    }, [isPaused, pausedElapsedTime, currentTimer, task.id]);

    return (
        <div className="flex items-center space-x-2">
            {showTimeDisplay && isTimerActive && (
                <span className={`text-xs font-mono ${
                    isPaused 
                        ? 'text-yellow-700 bg-yellow-100' 
                        : 'text-red-700 bg-red-100'
                } px-2 py-1 rounded-md min-w-[32px] inline-block text-center`}>
                    {isPaused ? pausedTime : currentTime}
                </span>
            )}
            
            <TimerControls
                task={task}
                timeEntries={timeEntries}
                setTimeEntries={setTimeEntries}
                tasks={tasks}
                currentTimer={currentTimer}
                setCurrentTimer={setCurrentTimer}
                isPaused={isPaused}
                setIsPaused={setIsPaused}
                pausedElapsedTime={pausedElapsedTime}
                setPausedElapsedTime={setPausedElapsedTime}
                size={size}
                isGlobalTimer={isGlobalTimer}
                onComplete={onComplete}
                setTasks={setTasks}
            />
        </div>
    );
};

export default TaskTimer;
