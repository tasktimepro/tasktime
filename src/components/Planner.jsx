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
import { usePreferences } from '@/hooks/usePreferences';
import { useWeeklyGoals } from '@/hooks/useWeeklyGoals';
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currencyUtils';
import { 
    WeekHeader, 
    WeekAddPopover,
    DayColumn, 
    EntityPickerModal, 
    MobileDaySelector,
    MobileDayCard,
    DailyGoalModal,
    WeeklyGoalModal,
} from '@/components/planner/index.js';
import { useToast } from '@/hooks/useToast';
import { PlusIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
    const { preferences } = usePreferences();
    const { weeklyGoals, hasGoals: hasWeeklyGoals } = useWeeklyGoals();

    const defaultCurrency = useMemo(
        () => normalizeCurrencyCode(preferences.currency || 'EUR'),
        [preferences.currency]
    );

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
    const { attachments, createAttachment, updateAttachment, deleteAttachment, isAttached } = usePlannerAttachments();

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
        mode: 'add',
        entityType: null,  // 'client' | 'project' | 'task'
        scope: 'day',
        dateStr: null,
        weekStart: null,
        weekEnd: null,
        attachmentId: null,
        lockedEntityId: null,
        lockedScheduleMode: null,
        lockedWeekday: null,
        initialTargetHours: null,
    });

    const [pendingPickerReopen, setPendingPickerReopen] = useState(null);
    const [dailyGoalDateStr, setDailyGoalDateStr] = useState(null);
    const [weeklyGoalsOpen, setWeeklyGoalsOpen] = useState(false);
    const [weeklyAttachWarning, setWeeklyAttachWarning] = useState(null);

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

    const handleOpenDailyGoals = useCallback((dateStr) => {
        if (!dateStr) return;
        setDailyGoalDateStr(dateStr);
    }, []);

    const handleCloseDailyGoals = useCallback(() => {
        setDailyGoalDateStr(null);
    }, []);

    const handleOpenWeeklyGoals = useCallback(() => {
        setWeeklyGoalsOpen(true);
    }, []);

    const handleCloseWeeklyGoals = useCallback(() => {
        setWeeklyGoalsOpen(false);
    }, []);

    const findWeeklyAttachmentForDay = useCallback((entityType, entityId, scheduleMode, day) => {
        if (scheduleMode === 'every-week') {
            return attachments.find((attachment) => (
                attachment.type === entityType
                && attachment.referenceId === entityId
                && attachment.mode === 'weekday'
                && attachment.weekday === day.dayOfWeek
            )) || null;
        }

        return attachments.find((attachment) => (
            attachment.type === entityType
            && attachment.referenceId === entityId
            && attachment.mode === 'date'
            && attachment.date === day.dateStr
        )) || null;
    }, [attachments]);

    const applyWeeklyAttachment = useCallback(({
        entity,
        entityType,
        scheduleMode,
        includeWeekends,
        targetHours,
        mode,
    }) => {
        const activeDays = includeWeekends
            ? weekDays
            : weekDays.filter(day => day.dayOfWeek !== 0 && day.dayOfWeek !== 6);

        const matches = activeDays.map((day) => ({
            day,
            attachment: findWeeklyAttachmentForDay(entityType, entity.id, scheduleMode, day),
        }));

        const daysToApply = mode === 'skip'
            ? matches.filter((match) => !match.attachment)
            : matches;

        if (daysToApply.length === 0) {
            showSuccess('All selected days already have this attached');
            return;
        }

        const dayCount = daysToApply.length;
        const totalHours = typeof targetHours === 'number' ? targetHours : null;
        const baseHours = totalHours !== null && dayCount > 0
            ? Number((totalHours / dayCount).toFixed(2))
            : null;
        const lastHours = totalHours !== null && dayCount > 0
            ? Number((totalHours - (baseHours * (dayCount - 1))).toFixed(2))
            : null;

        daysToApply.forEach((match, index) => {
            const estimatedHours = totalHours !== null
                ? (index === dayCount - 1 ? lastHours : baseHours)
                : null;

            if (match.attachment) {
                updateAttachment(match.attachment.id, {
                    estimatedHours,
                });
                return;
            }

            if (scheduleMode === 'every-week') {
                createAttachment({
                    type: entityType,
                    referenceId: entity.id,
                    mode: 'weekday',
                    date: null,
                    weekday: match.day.dayOfWeek,
                    createdAt: match.day.date.getTime(),
                    estimatedHours,
                });
            } else {
                createAttachment({
                    type: entityType,
                    referenceId: entity.id,
                    mode: 'date',
                    date: match.day.dateStr,
                    weekday: null,
                    estimatedHours,
                });
            }
        });

        const typeLabel = entityType === 'client' ? 'Client' : entityType === 'project' ? 'Project' : 'Task';
        const actionLabel = scheduleMode === 'every-week'
            ? 'added for every week'
            : 'added to this week';
        showSuccess(`${typeLabel} ${actionLabel}`);
    }, [weekDays, findWeeklyAttachmentForDay, updateAttachment, createAttachment, showSuccess]);

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
            mode: 'add',
            entityType: type,
            scope: 'day',
            dateStr: dateStr,
            weekStart: null,
            weekEnd: null,
            attachmentId: null,
            lockedEntityId: null,
            lockedScheduleMode: null,
            lockedWeekday: null,
            initialTargetHours: null,
        });
    }, []);

    const handleAddWeekClick = useCallback((type) => {
        setPendingPickerReopen(null);
        setPickerState({
            isOpen: true,
            mode: 'add',
            entityType: type,
            scope: 'week',
            dateStr: null,
            weekStart,
            weekEnd,
            attachmentId: null,
            lockedEntityId: null,
            lockedScheduleMode: null,
            lockedWeekday: null,
            initialTargetHours: null,
        });
    }, [weekStart, weekEnd]);

    const handleCreateTask = useCallback((dateStr) => {
        openTaskModal?.(null, { startDate: dateStr });
    }, [openTaskModal]);

    const handleEditPlannerOptions = useCallback((item, dateStr) => {
        if (!item?.attachment) return;

        const scheduleMode = item.attachment.mode === 'weekday' ? 'weekday' : 'date';

        setPickerState({
            isOpen: true,
            mode: 'edit',
            entityType: item.type,
            scope: 'day',
            dateStr: item.attachment.date || dateStr,
            weekStart: null,
            weekEnd: null,
            attachmentId: item.attachment.id,
            lockedEntityId: item.entity.id,
            lockedScheduleMode: scheduleMode,
            lockedWeekday: item.attachment.weekday ?? null,
            initialTargetHours: item.attachment.estimatedHours ?? null,
        });
    }, []);

    // Close entity picker
    const closeEntityPicker = useCallback(() => {
        setPickerState(prev => ({ ...prev, isOpen: false }));
    }, []);

    // Entity selected from picker - create attachment
    const handleEntitySelect = useCallback((entity, scheduleMode, weekday, targetHours, options = {}) => {
        const { entityType, dateStr, scope } = pickerState;

        if (scope === 'week') {
            const includeWeekends = options.includeWeekends !== false;
            const activeDays = includeWeekends
                ? weekDays
                : weekDays.filter(day => day.dayOfWeek !== 0 && day.dayOfWeek !== 6);

            const existingMatches = activeDays
                .map((day) => findWeeklyAttachmentForDay(entityType, entity.id, scheduleMode, day))
                .filter(Boolean);

            if (existingMatches.length > 0) {
                setWeeklyAttachWarning({
                    entity,
                    entityType,
                    scheduleMode,
                    includeWeekends,
                    targetHours,
                });
                return false;
            }

            applyWeeklyAttachment({
                entity,
                entityType,
                scheduleMode,
                includeWeekends,
                targetHours,
                mode: 'overwrite',
            });
            return true;
        }

        if (pickerState.mode === 'edit') {
            if (!pickerState.attachmentId) return;
            updateAttachment(pickerState.attachmentId, {
                estimatedHours: targetHours ?? null,
            });
            const typeLabel = entityType === 'client' ? 'Client' : entityType === 'project' ? 'Project' : 'Task';
            showSuccess(`${typeLabel} planner options updated`);
            return;
        }

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
                    estimatedHours: targetHours ?? null,
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
                    estimatedHours: targetHours ?? null,
                });
            }
        }

        const typeLabel = entityType === 'client' ? 'Client' : entityType === 'project' ? 'Project' : 'Task';
        const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const actionLabel = scheduleMode === 'weekday' 
            ? `added for every ${WEEKDAY_NAMES[weekday]}` 
            : `added to ${dateStr}`;
        showSuccess(`${typeLabel} ${actionLabel}`);
    }, [pickerState, createAttachment, updateAttachment, isAttached, showSuccess, weekDays, findWeeklyAttachmentForDay, applyWeeklyAttachment]);

    // Create new entity from picker
    const handleCreateNew = useCallback(() => {
        const { entityType, dateStr, scope, weekStart, weekEnd } = pickerState;

        setPendingPickerReopen({
            entityType,
            dateStr,
            scope,
            weekStart,
            weekEnd,
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
            mode: 'add',
            entityType: pendingPickerReopen.entityType,
            scope: pendingPickerReopen.scope || 'day',
            dateStr: pendingPickerReopen.dateStr,
            weekStart: pendingPickerReopen.weekStart || null,
            weekEnd: pendingPickerReopen.weekEnd || null,
            attachmentId: null,
            lockedEntityId: null,
            lockedScheduleMode: null,
            lockedWeekday: null,
            initialTargetHours: null,
        });
        setPendingPickerReopen(null);
    }, [pendingPickerReopen, activeModal]);

    const weekSummary = useMemo(() => {
        const totalTimeMs = weekDays.reduce((sum, day) => sum + (day.totalTimeMs || 0), 0);
        const totalEarnings = weekDays.reduce((sum, day) => sum + (day.totalEarnings || 0), 0);
        const actualHours = totalTimeMs / 3600000;
        const hasTargetHours = typeof weeklyGoals.targetHours === 'number' && weeklyGoals.targetHours > 0;
        const hasTargetEarnings = typeof weeklyGoals.targetEarnings === 'number' && weeklyGoals.targetEarnings > 0;
        const shouldShow = actualHours > 0 || totalEarnings > 0 || hasTargetHours || hasTargetEarnings;

        const formatHours = (value, alwaysDecimal = false) => {
            if (!Number.isFinite(value)) return '0h';
            if (alwaysDecimal) return `${value.toFixed(1)}h`;
            return `${Number.isInteger(value) ? value : value.toFixed(1)}h`;
        };

        const getCurrencyDecimals = (value) => {
            if (typeof value !== 'number') return 2;
            return Number.isInteger(value) ? 0 : 2;
        };

        const earningsDecimals = getCurrencyDecimals(totalEarnings);
        const targetEarningsDecimals = getCurrencyDecimals(weeklyGoals.targetEarnings ?? null);

        const hoursText = hasWeeklyGoals && typeof weeklyGoals.targetHours === 'number'
            ? `${formatHours(actualHours, true)} / ${formatHours(weeklyGoals.targetHours, false)}`
            : formatHours(actualHours, true);

        const earningsText = hasWeeklyGoals && typeof weeklyGoals.targetEarnings === 'number'
            ? `${formatCurrency(totalEarnings, defaultCurrency, earningsDecimals)} / ${formatCurrency(weeklyGoals.targetEarnings, defaultCurrency, targetEarningsDecimals)}`
            : formatCurrency(totalEarnings, defaultCurrency, earningsDecimals);

        if (!shouldShow) {
            return null;
        }

        return {
            hoursText,
            earningsText,
            hasGoals: hasWeeklyGoals && (typeof weeklyGoals.targetHours === 'number' || typeof weeklyGoals.targetEarnings === 'number'),
        };
    }, [weekDays, weeklyGoals, defaultCurrency, hasWeeklyGoals]);

    return (
        <div
            className="flex flex-col gap-4"
            style={{
                height: 'calc(100vh - var(--app-content-padding-top, 1.5rem) - var(--app-content-padding-bottom, 1.5rem))'
            }}
        >
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
                    weekSummary={weekSummary}
                    weekAddControl={(
                        <WeekAddPopover
                            onSelectType={handleAddWeekClick}
                            onSetWeeklyGoal={handleOpenWeeklyGoals}
                        >
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Add items to this week"
                            >
                                <PlusIcon className="h-4 w-4" />
                            </Button>
                        </WeekAddPopover>
                    )}
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
                        totalEarnings={selectedDay.totalEarnings}
                        dailyGoal={selectedDay.dailyGoal}
                        currency={defaultCurrency}
                        hasPrev={true}
                        hasNext={true}
                        onPrev={handlePrevDay}
                        onNext={handleNextDay}
                        onAddClick={handleAddClick}
                        onCreateTask={handleCreateTask}
                        onItemClick={handleItemClick}
                        onRemoveItem={handleRemoveItem}
                        onEditItem={handleEditPlannerOptions}
                        onSetDailyGoal={handleOpenDailyGoals}
                    />
                </div>
            )}

            {/* Desktop: Week grid (hidden on mobile) */}
            <div className="hidden md:grid grid-cols-7 gap-2 flex-1 overflow-hidden">
                {weekDays.map((day, index) => (
                    <DayColumn
                        key={day.dateStr}
                        date={day.date}
                        dateStr={day.dateStr}
                        dayOfWeek={day.dayOfWeek}
                        isLastColumn={index === weekDays.length - 1}
                        isToday={day.isToday}
                        items={day.items}
                        totalTimeMs={day.totalTimeMs}
                        totalEarnings={day.totalEarnings}
                        dailyGoal={day.dailyGoal}
                        currency={defaultCurrency}
                        onAddClick={handleAddClick}
                        onCreateTask={handleCreateTask}
                        onItemClick={handleItemClick}
                        onRemoveItem={handleRemoveItem}
                        onEditItem={handleEditPlannerOptions}
                        onSetDailyGoal={handleOpenDailyGoals}
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
                onCreateNew={pickerState.mode === 'add' ? handleCreateNew : null}
                scope={pickerState.scope}
                weekStart={pickerState.weekStart}
                weekEnd={pickerState.weekEnd}
                mode={pickerState.mode}
                lockedEntityId={pickerState.lockedEntityId}
                lockedScheduleMode={pickerState.lockedScheduleMode}
                lockedWeekday={pickerState.lockedWeekday}
                initialTargetHours={pickerState.initialTargetHours}
            />

            <DailyGoalModal
                isOpen={!!dailyGoalDateStr}
                onClose={handleCloseDailyGoals}
                dateStr={dailyGoalDateStr}
            />

            <WeeklyGoalModal
                isOpen={weeklyGoalsOpen}
                onClose={handleCloseWeeklyGoals}
                weekStart={weekStart}
            />

            <Dialog
                open={!!weeklyAttachWarning}
                onOpenChange={(open) => !open && setWeeklyAttachWarning(null)}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Some days already have this attached</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2 text-sm text-muted-foreground">
                        <p>
                            Some of the selected days already include this item.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>
                                Skip existing: only new days are added. Target hours are split across the new days.
                            </li>
                            <li>
                                Overwrite existing: existing attachments are updated and target hours are split across all selected days.
                            </li>
                        </ul>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-4">
                        <Button
                            variant="secondary"
                            onClick={() => setWeeklyAttachWarning(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!weeklyAttachWarning) return;
                                applyWeeklyAttachment({
                                    ...weeklyAttachWarning,
                                    mode: 'skip',
                                });
                                setWeeklyAttachWarning(null);
                                setPickerState((prev) => ({ ...prev, isOpen: false }));
                            }}
                        >
                            Skip existing
                        </Button>
                        <Button
                            onClick={() => {
                                if (!weeklyAttachWarning) return;
                                applyWeeklyAttachment({
                                    ...weeklyAttachWarning,
                                    mode: 'overwrite',
                                });
                                setWeeklyAttachWarning(null);
                                setPickerState((prev) => ({ ...prev, isOpen: false }));
                            }}
                        >
                            Overwrite existing
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default Planner;
