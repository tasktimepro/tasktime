/**
 * Planner component - Weekly planner view
 * 
 * Displays a 7-column week view (Mon-Sun) with:
 * - Pinned clients/projects
 * - Recurring and due tasks
 * - Time progress indicator for today
 * 
 * Responsive: Shows day tabs + single day on mobile, full grid on desktop.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { addDays, differenceInCalendarWeeks, getISOWeekYear, getWeek, setWeek, startOfWeek } from 'date-fns';
import { useUrlState } from '@/hooks/useUrlState';
import { usePlannerItems } from '@/hooks/usePlannerItems';
import { usePlannerAttachments } from '@/hooks/usePlannerAttachments';
import { useTasks } from '@/hooks/useTasks';
import { useTimers } from '@/hooks/useTimers';
import { useTodayDate } from '@/hooks/useDayRollover';
import { 
    WeekHeader, 
    DayColumn, 
    EntityPickerModal, 
    MobileDaySelector,
    MobileDayCard,
} from '@/components/planner/index.js';
import { useToast } from '@/hooks/useToast';

/**
 * Planner component
 * 
 * @param {Object} props
 * @param {Function} props.openClientModal - Opens the client creation modal
 * @param {Function} props.openProjectModal - Opens the project creation modal
 * @param {Function} props.openTaskModal - Opens the task creation/edit modal
 * @param {string | null} props.activeModal - Active global modal key
 * @param {(task: Object, options?: Object) => void} props.onViewTask - Opens the task view modal
 */
const Planner = ({
    openClientModal,
    openProjectModal,
    openTaskModal,
    activeModal = null,
    onViewTask
}) => {

    const { urlParams, updateUrl, navigateToProject, navigateToClient } = useUrlState();
    const { showSuccess } = useToast();

    const today = useTodayDate();
    const currentIsoYear = useMemo(() => getISOWeekYear(today), [today]);
    const currentWeekNumber = useMemo(
        () => getWeek(today, { weekStartsOn: 1, firstWeekContainsDate: 4 }),
        [today]
    );

    const requestedYear = useMemo(() => {
        const parsed = parseInt(urlParams.year || '', 10);
        if (Number.isNaN(parsed) || parsed < 1) return currentIsoYear;
        return parsed;
    }, [urlParams.year, currentIsoYear]);

    const maxWeeksInRequestedYear = useMemo(() => {
        return getWeek(new Date(requestedYear, 11, 28), { weekStartsOn: 1, firstWeekContainsDate: 4 });
    }, [requestedYear]);

    const requestedWeekNumber = useMemo(() => {
        const parsed = parseInt(urlParams.week || '', 10);
        if (Number.isNaN(parsed) || parsed < 1) return currentWeekNumber;
        return Math.min(parsed, maxWeeksInRequestedYear);
    }, [urlParams.week, currentWeekNumber, maxWeeksInRequestedYear]);

    useEffect(() => {
        if (!urlParams.week || !urlParams.year) {
            updateUrl({ year: String(currentIsoYear), week: String(currentWeekNumber) });
        }
    }, [urlParams.week, urlParams.year, updateUrl, currentIsoYear, currentWeekNumber]);

    const targetWeekStart = useMemo(() => {
        const weekAnchor = setWeek(new Date(requestedYear, 0, 4), requestedWeekNumber, {
            weekStartsOn: 1,
            firstWeekContainsDate: 4,
        });
        return startOfWeek(weekAnchor, { weekStartsOn: 1 });
    }, [requestedYear, requestedWeekNumber]);

    // Calculate week offset from current week based on requested week number
    const weekOffset = useMemo(() => {
        const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
        return differenceInCalendarWeeks(targetWeekStart, thisWeekStart, { weekStartsOn: 1 });
    }, [today, targetWeekStart]);

    // Get planner data for this week
    const { weekDays, weekStart } = usePlannerItems(weekOffset);

    // Planner attachment operations
    const { createAttachment, deleteAttachment, isAttached } = usePlannerAttachments();

    // Task operations for toggling completion and deletion
    const { deleteTask, archiveTask } = useTasks();
    const { timers, clearTimer } = useTimers();

    // Calculate week end (Sunday)
    const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
    const weekNumber = useMemo(
        () => getWeek(weekStart, { weekStartsOn: 1, firstWeekContainsDate: 4 }),
        [weekStart]
    );

    // Mobile: selected day (default to today's index or first day)
    const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
        const todayIndex = weekDays.findIndex(d => d.isToday);
        return todayIndex >= 0 ? todayIndex : 0;
    });

    // Update selected day when week changes
    useEffect(() => {
        const todayIndex = weekDays.findIndex(d => d.isToday);
        if (todayIndex >= 0) {
            setSelectedDayIndex(todayIndex);
        } else {
            setSelectedDayIndex(0);
        }
    }, [weekStart, weekDays]);

    // Get selected day data for mobile view
    const selectedDay = weekDays[selectedDayIndex] || weekDays[0];

    // State for entity picker modal
    const [pickerState, setPickerState] = useState({
        isOpen: false,
        entityType: null,  // 'client' | 'project' | 'task'
        dateStr: null,
    });

    const [pendingPickerReopen, setPendingPickerReopen] = useState(null);

    const prevActiveModalRef = useRef(activeModal);

    // Navigation handlers
    const navigateWeek = useCallback((direction) => {
        const nextWeekStart = addDays(weekStart, direction * 7);
        const nextWeekNumber = getWeek(nextWeekStart, { weekStartsOn: 1, firstWeekContainsDate: 4 });
        const nextWeekYear = getISOWeekYear(nextWeekStart);
        updateUrl({ year: String(nextWeekYear), week: String(nextWeekNumber) });
    }, [weekStart, updateUrl]);

    const navigateToToday = useCallback(() => {
        updateUrl({ year: String(currentIsoYear), week: String(currentWeekNumber) });
    }, [updateUrl, currentIsoYear, currentWeekNumber]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.defaultPrevented) return;

            const target = event.target;
            const isEditable = target instanceof HTMLElement
                && (target.isContentEditable
                    || target.tagName === 'INPUT'
                    || target.tagName === 'TEXTAREA'
                    || target.tagName === 'SELECT');

            if (isEditable) return;

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                navigateWeek(-1);
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                navigateWeek(1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigateWeek]);

    // Mobile: select day by dateStr
    const handleSelectDay = useCallback((dateStr) => {
        const index = weekDays.findIndex(d => d.dateStr === dateStr);
        if (index >= 0) {
            setSelectedDayIndex(index);
        }
    }, [weekDays]);

    // Mobile: navigate to prev/next day
    const handlePrevDay = useCallback(() => {
        if (selectedDayIndex > 0) {
            setSelectedDayIndex(selectedDayIndex - 1);
        } else {
            // Go to previous week, last day
            navigateWeek(-1);
            setSelectedDayIndex(6);
        }
    }, [selectedDayIndex, navigateWeek]);

    const handleNextDay = useCallback(() => {
        if (selectedDayIndex < 6) {
            setSelectedDayIndex(selectedDayIndex + 1);
        } else {
            // Go to next week, first day
            navigateWeek(1);
            setSelectedDayIndex(0);
        }
    }, [selectedDayIndex, navigateWeek]);

    // Item click handler
    const handleItemClick = useCallback((item) => {
        switch (item.type) {
            case 'client':
                navigateToClient(item.entity.id);
                break;
            case 'project':
                navigateToProject(item.entity.id);
                break;
            case 'task':
                // Open task preview modal
                const dateMatch = item.key.match(/\d{4}-\d{2}-\d{2}/);
                onViewTask?.(item.entity, {
                    dateStr: dateMatch ? dateMatch[0] : null,
                    attachment: item.attachment || null
                });
                break;
        }
    }, [navigateToClient, navigateToProject, onViewTask]);

    // Delete task from preview
    const handleDeleteTask = useCallback((task) => {
        if (window.confirm(`Delete "${task.title}"?`)) {
            deleteTask(task.id);
            showSuccess('Task deleted');
        }
    }, [deleteTask, showSuccess]);

    const handleArchiveTask = useCallback((task) => {
        if (!task || task.projectId) return;

        timers.forEach((timer) => {
            if (timer.taskId === task.id) {
                clearTimer(timer.projectId || task.id);
            }
        });

        archiveTask(task.id);
        showSuccess('Task archived');
    }, [archiveTask, timers, clearTimer, showSuccess]);

    // Remove item from planner (delete attachment)
    const handleRemoveItem = useCallback((item) => {
        if (!item.attachment) return;
        deleteAttachment(item.attachment.id);
        const typeLabel = item.type === 'client' ? 'Client' : item.type === 'project' ? 'Project' : 'Task';
        showSuccess(`${typeLabel} removed from planner`);
    }, [deleteAttachment, showSuccess]);

    // Set estimated hours for an item - opens the item for editing
    // Add item handler - opens entity picker
    const handleAddClick = useCallback((dateStr, type) => {
        setPendingPickerReopen(null);
        setPickerState({
            isOpen: true,
            entityType: type,
            dateStr: dateStr,
        });
    }, []);

    // Close entity picker
    const closeEntityPicker = useCallback(() => {
        setPickerState(prev => ({ ...prev, isOpen: false }));
    }, []);

    // Entity selected from picker - create attachment
    const handleEntitySelect = useCallback((entity, scheduleMode, weekday) => {
        const { entityType, dateStr } = pickerState;

        // For weekday recurrence, anchor the start to the selected date so it shows immediately
        if (scheduleMode === 'weekday') {
            const [year, month, day] = dateStr.split('-').map(Number);
            const createdAt = new Date(year, month - 1, day).getTime();

            if (!isAttached(entityType, entity.id, { weekday })) {
                createAttachment({
                    type: entityType,
                    referenceId: entity.id,
                    mode: 'weekday',
                    date: null,
                    weekday,
                    createdAt,
                });
            }
        } else {
            // Single date attachment
            if (!isAttached(entityType, entity.id, { date: dateStr })) {
                createAttachment({
                    type: entityType,
                    referenceId: entity.id,
                    mode: 'date',
                    date: dateStr,
                    weekday: null,
                });
            }
        }

        const typeLabel = entityType === 'client' ? 'Client' : entityType === 'project' ? 'Project' : 'Task';
        const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const actionLabel = scheduleMode === 'weekday' 
            ? `added for every ${WEEKDAY_NAMES[weekday]}` 
            : `added to ${dateStr}`;
        showSuccess(`${typeLabel} ${actionLabel}`);
    }, [pickerState, createAttachment, isAttached, showSuccess]);

    // Create new entity from picker
    const handleCreateNew = useCallback(() => {
        const { entityType, dateStr } = pickerState;

        setPendingPickerReopen({
            entityType,
            dateStr,
        });
        setPickerState(prev => ({ ...prev, isOpen: false }));
        
        // Open the appropriate modal
        switch (entityType) {
            case 'client':
                openClientModal?.();
                break;
            case 'project':
                openProjectModal?.();
                break;
            case 'task':
                openTaskModal?.();
                break;
        }
    }, [pickerState, openClientModal, openProjectModal, openTaskModal]);

    useEffect(() => {
        if (!pendingPickerReopen) return;
        if (activeModal !== null) return;

        setPickerState({
            isOpen: true,
            entityType: pendingPickerReopen.entityType,
            dateStr: pendingPickerReopen.dateStr,
        });
        setPendingPickerReopen(null);
    }, [pendingPickerReopen, activeModal]);

    return (
        <div
            className="flex flex-col gap-4"
            style={{
                height: 'calc(100vh - var(--app-content-padding-top, 1.5rem) - var(--app-content-padding-bottom, 1.5rem))'
            }}
        >
            {/* Page header */}
            <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-foreground">
                    Planner
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Plan your week with clients, projects, tasks, and goals.
                </p>
            </div>

            {/* Week navigation header */}
            <div className="flex-shrink-0">
                <WeekHeader
                    weekStart={weekStart}
                    weekEnd={weekEnd}
                    weekNumber={weekNumber}
                    onPrevious={() => navigateWeek(-1)}
                    onNext={() => navigateWeek(1)}
                    onToday={navigateToToday}
                    isCurrentWeek={weekNumber === currentWeekNumber}
                />
            </div>

            {/* Mobile: Day selector tabs */}
            <div className="md:hidden flex-shrink-0">
                <MobileDaySelector
                    weekDays={weekDays}
                    selectedDateStr={selectedDay?.dateStr}
                    onSelectDay={handleSelectDay}
                />
            </div>

            {/* Mobile: Single day view */}
            {selectedDay && (
                <div className="md:hidden flex-1 overflow-hidden">
                    <MobileDayCard
                        date={selectedDay.date}
                        dateStr={selectedDay.dateStr}
                        isToday={selectedDay.isToday}
                        items={selectedDay.items}
                        totalTimeMs={selectedDay.totalTimeMs}
                        hasPrev={true}
                        hasNext={true}
                        onPrev={handlePrevDay}
                        onNext={handleNextDay}
                        onAddClick={handleAddClick}
                        onItemClick={handleItemClick}
                        onRemoveItem={handleRemoveItem}
                    />
                </div>
            )}

            {/* Desktop: Week grid (hidden on mobile) */}
            <div className="hidden md:grid grid-cols-7 gap-2 flex-1 overflow-hidden">
                {weekDays.map((day) => (
                    <DayColumn
                        key={day.dateStr}
                        date={day.date}
                        dateStr={day.dateStr}
                        isToday={day.isToday}
                        items={day.items}
                        totalTimeMs={day.totalTimeMs}
                        onAddClick={handleAddClick}
                        onItemClick={handleItemClick}
                        onRemoveItem={handleRemoveItem}
                    />
                ))}
            </div>

            {/* Entity Picker Modal */}
            <EntityPickerModal
                isOpen={pickerState.isOpen}
                onClose={closeEntityPicker}
                entityType={pickerState.entityType}
                dateStr={pickerState.dateStr}
                onSelect={handleEntitySelect}
                onCreateNew={handleCreateNew}
            />

        </div>
    );
};

export default Planner;
