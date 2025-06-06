import { useState, useEffect } from 'react';
import { StopIcon } from '@heroicons/react/24/outline';
import { formatActiveTimer } from '../utils/dateUtils';
import TimerControls from './TimerControls.jsx';

/**
 * GlobalTimer component - Shows active timer in the header
 * @param {Object} props - Component props
 * @param {Object} props.currentTimer - Current active timer object
 * @param {Function} props.setCurrentTimer - Function to update current timer
 * @param {Array} props.tasks - All tasks array
 * @param {Function} props.setTimeEntries - Function to update time entries
 * @param {boolean} props.isPaused - Global pause state
 * @param {Function} props.setIsPaused - Function to set global pause state
 * @param {number} props.pausedElapsedTime - Global paused elapsed time
 * @param {Function} props.onClose - Function called when timer is closed
 */
const GlobalTimer = ({
    currentTimer,
    setCurrentTimer,
    tasks,
    setTimeEntries,
    isPaused,
    setIsPaused,
    pausedElapsedTime,
    onClose
}) => {
    const [currentTime, setCurrentTime] = useState('');
    const [pausedTime, setPausedTime] = useState('');

    // Find the task associated with the current timer
    const currentTask = tasks.find(task => task.id === currentTimer?.taskId);

    // Update timer display every second
    useEffect(() => {
        if (!currentTimer || isPaused) return;

        const updateTimer = () => {
            const formattedTime = formatActiveTimer(currentTimer.startTime);
            setCurrentTime(formattedTime);
        };

        // Update immediately
        updateTimer();

        // Then update every second
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [currentTimer, isPaused]);

    // When paused, save the current time display
    useEffect(() => {
        if (isPaused && currentTime) {
            setPausedTime(currentTime);
        }
    }, [isPaused, currentTime]);

    if (!currentTimer || !currentTask) {
        return null;
    }

    // Determine styles based on timer state
    // const bgColor = isPaused ? 'bg-yellow-50' : 'bg-red-50';
    const borderColor = isPaused ? 'border-yellow-200' : 'border-red-200';
    const dotColor = isPaused ? 'bg-yellow-500' : 'bg-red-500';
    const dotAnimation = isPaused ? '' : 'animate-pulse';
    const textColor = isPaused ? 'text-yellow-900' : 'text-red-900';
    const timeColor = isPaused ? 'text-yellow-700 bg-yellow-100' : 'text-red-700 bg-red-100';

    return (
        <div className={`flex items-center space-x-3 border ${borderColor} rounded-lg px-4 py-2`}>
            {/* Timer info */}
            <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 ${dotColor} rounded-full ${dotAnimation}`}></div>
                <span className={`text-sm font-medium ${textColor} max-w-[150px] truncate`} title={currentTask.title}>
                    {currentTask.title}
                </span>
                <span className={`text-sm font-mono ${timeColor} px-2 py-1 rounded`}>
                    {isPaused ? pausedTime : currentTime}
                </span>
            </div>

            {/* Control buttons - using TimerControls component */}
            <TimerControls
                task={currentTask}
                setTimeEntries={setTimeEntries}
                currentTimer={currentTimer}
                setCurrentTimer={setCurrentTimer}
                isGlobalTimer={true}
                isPaused={isPaused}
                setIsPaused={setIsPaused}
                pausedElapsedTime={pausedElapsedTime}
                onComplete={() => {
                    // Call onClose when timer is completely stopped
                    if (onClose) onClose();
                }}
            />
        </div>
    );
};

export default GlobalTimer;
