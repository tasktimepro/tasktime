import { PlayIcon, PauseIcon, StopIcon } from '@heroicons/react/24/outline';
import { generateId } from '../utils/idUtils';

function TimerControls({
    task,
    timeEntries,
    setTimeEntries,
    currentTimer,
    setCurrentTimer
}) {
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    const startTimer = () => {
        // Stop any existing timer first
        if (currentTimer) {
            stopTimer();
        }

        // Start new timer
        setCurrentTimer({
            taskId: task.id,
            start: Date.now()
        });
    };

    const pauseTimer = () => {
        if (!currentTimer || currentTimer.taskId !== task.id) return;

        // Create time entry for the paused session
        const timeEntry = {
            id: generateId(),
            taskId: task.id,
            start: currentTimer.start,
            end: Date.now()
        };

        setTimeEntries([...timeEntries, timeEntry]);
        setCurrentTimer(null);
    };

    const stopTimer = () => {
        if (!currentTimer) return;

        // Create time entry for the stopped session
        const timeEntry = {
            id: generateId(),
            taskId: currentTimer.taskId,
            start: currentTimer.start,
            end: Date.now()
        };

        setTimeEntries([...timeEntries, timeEntry]);
        setCurrentTimer(null);
    };

    return (
        <div className="flex items-center space-x-1">
            {!isTimerActive ? (
                <button
                    onClick={startTimer}
                    className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                    title="Start Timer"
                >
                    <PlayIcon className="h-4 w-4" />
                </button>
            ) : (
                <>
                    <button
                        onClick={pauseTimer}
                        className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded transition-colors"
                        title="Pause Timer"
                    >
                        <PauseIcon className="h-4 w-4" />
                    </button>

                    <button
                        onClick={stopTimer}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        title="Stop Timer"
                    >
                        <StopIcon className="h-4 w-4" />
                    </button>
                </>
            )}
        </div>
    );
}

export default TimerControls;
