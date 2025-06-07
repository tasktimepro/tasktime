import { PlayIcon, PauseIcon, StopIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { generateId } from '../utils/idUtils';

/**
 * TimerControls component - Handles task timer functionality
 * @param {Object} props - Component props
 * @param {Object} props.task - Task object
 * @param {Function} props.setTimeEntries - Function to update time entries
 * @param {Object} props.currentTimer - Current active timer
 * @param {Function} props.setCurrentTimer - Function to update current timer
 * @param {string} props.size - Size variant ('sm' or normal)
 * @param {boolean} props.isGlobalTimer - Whether this is being used in global timer (affects styling)
 * @param {boolean} props.isPaused - Whether the timer is paused
 * @param {Function} props.setIsPaused - Function to set paused state
 * @param {number} props.pausedElapsedTime - Time elapsed when timer was paused
 * @param {Function} props.onComplete - Function called when timer is completely stopped
 */
function TimerControls({
    task,
    setTimeEntries,
    currentTimer,
    setCurrentTimer,
    size = 'normal',
    // New props for handling paused state
    isGlobalTimer = false,
    isPaused = false,
    setIsPaused = null,
    pausedElapsedTime = 0,
    setPausedElapsedTime = null,
    onComplete = null
}) {
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    /**
     * Start timer for current task
     */
    const startTimer = () => {
        // If there's a paused timer, we should resume it instead of creating a new one
        if (isPaused && currentTimer && currentTimer.taskId === task.id && setIsPaused) {
            resumeTimer();
            return;
        }
        
        // Stop any existing timer first
        if (currentTimer) {
            // Create time entry for the previous session
            const timeEntry = {
                id: generateId(),
                taskId: currentTimer.taskId,
                start: currentTimer.startTime,
                end: Date.now()
            };

            setTimeEntries(prevEntries => [...prevEntries, timeEntry]);
        }

        // Start new timer
        setCurrentTimer({
            taskId: task.id,
            startTime: Date.now()
        });
        
        // If we have access to the isPaused state, make sure it's set to false
        if (setIsPaused) {
            setIsPaused(false);
        }
    };

    /**
     * Resume a paused timer
     */
    const resumeTimer = () => {
        if (!currentTimer || !isPaused || currentTimer.taskId !== task.id) return;
        
        // When resuming, we need to adjust the start time based on how much time was already tracked
        // The pausedElapsedTime contains the total time that was already tracked before pausing
        const adjustedStartTime = Date.now() - (pausedElapsedTime || 0);
        
        setCurrentTimer({
            ...currentTimer,
            startTime: adjustedStartTime
        });
        
        setIsPaused(false);
        
        // Reset the paused elapsed time since we're resuming
        if (setPausedElapsedTime) {
            setPausedElapsedTime(0);
        }
    };

    /**
     * Pause timer but don't create time entry
     * Instead, just mark it as paused and save the elapsed time
     */
    const pauseTimer = () => {
        if (!currentTimer || currentTimer.taskId !== task.id) return;

        // If we have access to the isPaused state setter, use it
        if (setIsPaused) {
            // Calculate elapsed time up to the pause moment
            const elapsedTime = Date.now() - currentTimer.startTime;
            
            // Create time entry for the paused session
            const timeEntry = {
                id: generateId(),
                taskId: task.id,
                start: currentTimer.startTime,
                end: Date.now()
            };

            setTimeEntries(prevEntries => [...prevEntries, timeEntry]);
            
            // Update paused state with the correct elapsed time
            if (typeof pausedElapsedTime === 'number') {
                // Add to existing paused time if there was any
                const totalElapsedTime = pausedElapsedTime + elapsedTime;
                if (typeof setPausedElapsedTime === 'function') {
                    setPausedElapsedTime(totalElapsedTime);
                }
            } else if (typeof setPausedElapsedTime === 'function') {
                // First time pausing
                setPausedElapsedTime(elapsedTime);
            }
            
            setIsPaused(true);
        } else {
            // Legacy behavior - create entry and stop timer
            // This branch should only run if called from a component that doesn't support pausing
            const timeEntry = {
                id: generateId(),
                taskId: task.id,
                start: currentTimer.startTime,
                end: Date.now()
            };

            setTimeEntries(prevEntries => [...prevEntries, timeEntry]);
            setCurrentTimer(null);
        }
    };

    /**
     * Stop timer completely and remove it
     */
    const stopTimer = () => {
        if (!currentTimer || currentTimer.taskId !== task.id) return;

        // If we're paused, we already have a time entry for the activity
        if (!isPaused) {
            // Create time entry for the session
            const timeEntry = {
                id: generateId(),
                taskId: task.id,
                start: currentTimer.startTime,
                end: Date.now()
            };

            setTimeEntries(prevEntries => [...prevEntries, timeEntry]);
        }

        // Remove the timer entirely
        setCurrentTimer(null);
        
        // Reset paused state and elapsed time if we have access to them
        if (setIsPaused) {
            setIsPaused(false);
        }
        
        if (setPausedElapsedTime) {
            setPausedElapsedTime(0);
        }
        
        // Call onComplete callback if provided
        if (onComplete) {
            onComplete();
        }
    };

    // Determine icon size based on size prop
    const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-5 w-5';

    return (
        <div className="flex items-center space-x-1">
            {!isTimerActive ? (
                // Start button - shown when no timer active for this task
                <button
                    onClick={startTimer}
                    className="p-1 text-green-600 hover:bg-green-100 rounded-md transition-colors group"
                    title="Start Timer"
                >
                    <PlayIcon className={`${iconSize} group-hover:text-green-700`} />
                </button>
            ) : isPaused ? (
                // For paused state, show resume and stop buttons
                <div className="flex space-x-1">
                    <button
                        onClick={resumeTimer}
                        className="p-1 text-green-600 hover:bg-green-100 rounded-full transition-colors group"
                        title="Resume Timer"
                    >
                        <PlayIcon className={`${iconSize} group-hover:text-green-700`} />
                    </button>
                    {isGlobalTimer && <button
                        onClick={stopTimer}
                            className="flex items-center space-x-1 p-1 text-yellow-600 hover:bg-yellow-100 rounded-md transition-colors group"
                        title="Stop Timer"
                    >
                        <XMarkIcon className={`${iconSize} group-hover:text-yellow-700`} />
                    </button>}
                </div>
            ) : (
                // For active (running) state, show pause and stop buttons
                <div className="flex space-x-1">
                    <button
                        onClick={pauseTimer}
                        className={`flex items-center space-x-1 p-1 ${isGlobalTimer ? 'text-yellow-600 hover:bg-yellow-100' : 'text-yellow-600 hover:bg-yellow-100'} rounded-md transition-colors group`}
                        title="Pause Timer"
                    >
                        <PauseIcon className={`${iconSize} group-hover:text-yellow-700`} />
                        {!isGlobalTimer && <span className="text-xs font-medium group-hover:text-yellow-700">Pause</span>}
                    </button>
                    <button
                        onClick={stopTimer}
                        className={`${isGlobalTimer ? 'p-1' : 'flex items-center space-x-1 p-1'} text-red-600 hover:bg-red-100 rounded-md transition-colors group`}
                        title="Stop Timer"
                    >
                        <StopIcon className={`${iconSize} group-hover:text-red-700`} />
                        {!isGlobalTimer && <span className="text-xs font-medium group-hover:text-red-700">Stop</span>}
                    </button>
                </div>
            )}
        </div>
    );
}

export default TimerControls;
