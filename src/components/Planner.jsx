/**
 * Planner component - Weekly planner view
 * 
 * Displays a 7-column week view with:
 * - Pinned clients/projects
 * - Recurring and due tasks
 * 
 * Responsive: Shows day tabs + single day on mobile, full grid on desktop.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { addDays, differenceInCalendarWeeks, getWeek, getWeekYear, setWeek, startOfWeek } from 'date-fns';
import { useUrlState } from '@/hooks/useUrlState';
import { usePlannerItems } from '@/hooks/usePlannerItems';
import { usePlannerAttachments } from '@/hooks/usePlannerAttachments';
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
import { cn } from '@/lib/utils';

/**
 * Planner component
 * 
 * @param {Object} props
 * @param {Function} props.openClientModal - Opens the client creation modal
 * @param {Function} props.openProjectModal - Opens the project creation modal
 * @param {Function} props.openTaskModal - Opens the task creation/edit modal
 * @param {Function} props.openExpenseView - Opens the expense view modal
 * @param {string | null} props.activeModal - Active global modal key
 * @param {(task: Object, options?: Object) => void} props.onViewTask - Opens the task view modal
 */
const Planner = ({
    openClientModal,
    openProjectModal,
    openTaskModal,
    openExpenseView,
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
    const weekStartsOn = useMemo(
        () => (typeof preferences.weekStartsOn === 'number' ? preferences.weekStartsOn : 1),
        [preferences.weekStartsOn]
    );
    const firstWeekContainsDate = useMemo(
        () => (weekStartsOn === 1 ? 4 : 1),
        [weekStartsOn]
    );
    const weekOptions = useMemo(
        () => ({ weekStartsOn, firstWeekContainsDate }),
        [weekStartsOn, firstWeekContainsDate]
    );
    const currentWeekYear = useMemo(() => getWeekYear(today, weekOptions), [today, weekOptions]);
    const currentWeekNumber = useMemo(
        () => getWeek(today, weekOptions),
        [today, weekOptions]
    );

    const requestedYear = useMemo(() => {
        const parsed = parseInt(urlParams.year || '', 10);
        if (Number.isNaN(parsed) || parsed < 1) return currentWeekYear;
        return parsed;
    }, [urlParams.year, currentWeekYear]);

    const maxWeeksInRequestedYear = useMemo(() => {
        const endOfRequestedYear = new Date(requestedYear, 11, 31);
        const endWeekYear = getWeekYear(endOfRequestedYear, weekOptions);
        const anchorDate = endWeekYear === requestedYear
            ? endOfRequestedYear
            : addDays(endOfRequestedYear, -7);
        return getWeek(anchorDate, weekOptions);
    }, [requestedYear, weekOptions]);

    const requestedWeekNumber = useMemo(() => {
        const parsed = parseInt(urlParams.week || '', 10);
        if (Number.isNaN(parsed) || parsed < 1) return currentWeekNumber;
        return Math.min(parsed, maxWeeksInRequestedYear);
    }, [urlParams.week, currentWeekNumber, maxWeeksInRequestedYear]);

    useEffect(() => {
        if (!urlParams.week || !urlParams.year) {
            updateUrl({ year: String(currentWeekYear), week: String(currentWeekNumber) });
        }
    }, [urlParams.week, urlParams.year, updateUrl, currentWeekYear, currentWeekNumber]);

    const targetWeekStart = useMemo(() => {
        const weekAnchor = setWeek(new Date(requestedYear, 0, firstWeekContainsDate), requestedWeekNumber, weekOptions);
        return startOfWeek(weekAnchor, { weekStartsOn });
    }, [requestedYear, requestedWeekNumber, firstWeekContainsDate, weekOptions, weekStartsOn]);

    // Calculate week offset from current week based on requested week number
    const weekOffset = useMemo(() => {
        const thisWeekStart = startOfWeek(today, { weekStartsOn });
        return differenceInCalendarWeeks(targetWeekStart, thisWeekStart, { weekStartsOn });
    }, [today, targetWeekStart, weekStartsOn]);

    // Get planner data for this week
    const { weekDays, weekStart } = usePlannerItems(weekOffset);

    // Planner attachment operations
    const { attachments, createAttachment, updateAttachment, deleteAttachment, isAttached } = usePlannerAttachments();

    // Calculate week end (Sunday)
    const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
    const weekNumber = useMemo(
        () => getWeek(weekStart, weekOptions),
        [weekStart, weekOptions]
    );

    const [isMobileLayout, setIsMobileLayout] = useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }

        return window.matchMedia('(max-width: 767px)').matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const handleChange = (event) => {
            setIsMobileLayout(event.matches);
        };

        setIsMobileLayout(mediaQuery.matches);
        mediaQuery.addEventListener?.('change', handleChange);
        mediaQuery.addListener?.(handleChange);

        return () => {
            mediaQuery.removeEventListener?.('change', handleChange);
            mediaQuery.removeListener?.(handleChange);
        };
    }, []);

    const defaultSelectedDateStr = useMemo(() => {
        const todayDay = weekDays.find((day) => day.isToday);
        return todayDay?.dateStr || weekDays[0]?.dateStr || null;
    }, [weekDays]);

    // Mobile: selected day (default to today's date or first day)
    const [selectedDateStr, setSelectedDateStr] = useState(() => defaultSelectedDateStr);

    // Preserve the selected day across same-week re-renders, but recover when the date falls out of view.
    useEffect(() => {
        if (!selectedDateStr || !weekDays.some((day) => day.dateStr === selectedDateStr)) {
            setSelectedDateStr(defaultSelectedDateStr);
        }
    }, [selectedDateStr, weekDays, defaultSelectedDateStr]);

    const selectedDayIndex = useMemo(() => {
        return weekDays.findIndex((day) => day.dateStr === selectedDateStr);
    }, [weekDays, selectedDateStr]);

    // Get selected day data for mobile view
    const selectedDay = (selectedDayIndex >= 0 ? weekDays[selectedDayIndex] : null) || weekDays[0];

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

    // Navigation handlers
    const navigateWeek = useCallback((direction) => {
        const nextWeekStart = addDays(weekStart, direction * 7);
        const nextWeekNumber = getWeek(nextWeekStart, weekOptions);
        const nextWeekYear = getWeekYear(nextWeekStart, weekOptions);
        updateUrl({ year: String(nextWeekYear), week: String(nextWeekNumber) });
    }, [weekStart, updateUrl, weekOptions]);

    const navigateToToday = useCallback(() => {
        updateUrl({ year: String(currentWeekYear), week: String(currentWeekNumber) });
    }, [updateUrl, currentWeekYear, currentWeekNumber]);

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
        const nextSelectedDay = weekDays.find((day) => day.dateStr === dateStr);
        if (nextSelectedDay) {
            setSelectedDateStr(nextSelectedDay.dateStr);
        }
    }, [weekDays]);

    // Mobile: navigate to prev/next day
    const handlePrevDay = useCallback(() => {
        if (!selectedDay) {
            return;
        }

        if (selectedDayIndex > 0) {
            setSelectedDateStr(weekDays[selectedDayIndex - 1].dateStr);
        } else {
            // Go to previous week, last day
            navigateWeek(-1);
            setSelectedDateStr(addDays(selectedDay.date, -1).toISOString().slice(0, 10));
        }
    }, [selectedDay, selectedDayIndex, navigateWeek, weekDays]);

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
        if (!selectedDay) {
            return;
        }

        if (selectedDayIndex >= 0 && selectedDayIndex < (weekDays.length - 1)) {
            setSelectedDateStr(weekDays[selectedDayIndex + 1].dateStr);
        } else {
            // Go to next week, first day
            navigateWeek(1);
            setSelectedDateStr(addDays(selectedDay.date, 1).toISOString().slice(0, 10));
        }
    }, [selectedDay, selectedDayIndex, navigateWeek, weekDays]);

    // Item click handler
    const handleItemClick = useCallback((item) => {
        switch (item.type) {
            case 'client':
                navigateToClient(item.entity.id);
                break;
            case 'project':
                navigateToProject(item.entity.id);
                break;
            case 'task': {
                // Open task preview modal
                const dateMatch = item.key.match(/\d{4}-\d{2}-\d{2}/);
                onViewTask?.(item.entity, {
                    dateStr: dateMatch ? dateMatch[0] : null,
                    attachment: item.attachment || null
                });
                break;
            }
            case 'expense':
                openExpenseView?.(item.expense);
                break;
        }
    }, [navigateToClient, navigateToProject, onViewTask, openExpenseView]);

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
            className={cn(
                'flex flex-col gap-3 md:gap-4',
                isMobileLayout && 'min-h-0'
            )}
            style={isMobileLayout ? undefined : {
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
                    isMobile={isMobileLayout}
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
                <div className="md:hidden flex-1 min-h-0 overflow-hidden">
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
                key={`entity-picker-${pickerState.isOpen ? 'open' : 'closed'}-${pickerState.entityType}-${pickerState.mode}-${pickerState.dateStr || 'none'}-${pickerState.lockedEntityId || 'none'}-${pickerState.lockedScheduleMode || 'none'}`}
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
                key={`daily-goal-${dailyGoalDateStr || 'closed'}`}
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
