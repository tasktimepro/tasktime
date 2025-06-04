import { PlayIcon, PauseIcon } from '@heroicons/react/24/outline';
import { generateId } from '../utils/idUtils';

/**
 * TimerControls component - Handles task timer functionality
 * @param {Object} props - Component props
 * @param {Object} props.task - Task object
 * @param {Array} props.timeEntries - Array of time entries
 * @param {Function} props.setTimeEntries - Function to update time entries
 * @param {Object} props.currentTimer - Current active timer
 * @param {Function} props.setCurrentTimer - Function to update current timer
 * @param {string} props.size - Size variant ('sm' or normal)
 */
function TimerControls({
    task,
    // timeEntries,
    setTimeEntries,
    currentTimer,
    setCurrentTimer,
    size = 'normal'
}) {
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    /**
     * Start timer for current task
     */
    const startTimer = () => {
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
    };

    /**
     * Pause timer and create time entry
     */
    const pauseTimer = () => {
        if (!currentTimer || currentTimer.taskId !== task.id) return;

        // Create time entry for the paused session
        const timeEntry = {
            id: generateId(),
            taskId: task.id,
            start: currentTimer.startTime,
            end: Date.now()
        };

        setTimeEntries(prevEntries => [...prevEntries, timeEntry]);

        setCurrentTimer(null);
    };

    // Determine icon size based on size prop
    const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-5 w-5';

    return (
        <div className="flex items-center space-x-1">
            {!isTimerActive ? (
                <button
                    onClick={startTimer}
                    className="p-1 text-green-600 hover:bg-green-100 rounded-full transition-colors group"
                    title="Start Timer"
                >
                    <PlayIcon className={`${iconSize} group-hover:text-green-700`} />
                </button>
            ) : (
                <button
                    onClick={pauseTimer}
                    className="flex items-center space-x-1 px-2 py-1 text-yellow-600 hover:bg-yellow-100 rounded-md transition-colors group"
                    title="Pause Timer"
                >
                    <PauseIcon className={`${iconSize} group-hover:text-yellow-700`} />
                    <span className="text-xs font-medium group-hover:text-yellow-700">Pause</span>
                </button>
            )}
        </div>
    );
}

export default TimerControls;
