/**
 * EntityPickerModal - Modal for selecting a client, project, or task
 * 
 * Shows a dropdown select for clients/projects (non-archived only),
 * or a searchable list for tasks.
 * Includes schedule selection: "This day only" or "Every {weekday}"
 */

import { useState, useMemo, useCallback } from 'react';
import { addDays, format, getDay } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InlineFieldHeader } from '@/components/ui/inline-field-header';
import { Label } from '@/components/ui/label';
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { 
    CheckIcon,
    MagnifyingGlassIcon,
    ArrowPathIcon
} from '@/components/ui/icons';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import CustomCheckbox from '@/components/CustomCheckbox';

/**
 * @typedef {'client' | 'project' | 'task'} EntityType
 * @typedef {'date' | 'weekday' | 'week' | 'every-week'} ScheduleMode
 */

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const createInitialModalState = ({
    isEditMode,
    lockedEntityId,
    lockedScheduleMode,
    initialTargetHours,
    scope,
}) => ({
    selectedEntityId: isEditMode ? (lockedEntityId || '') : '',
    scheduleMode: isEditMode ? (lockedScheduleMode || 'date') : (scope === 'week' ? 'week' : 'date'),
    taskSearch: '',
    targetHours: isEditMode && initialTargetHours !== null && initialTargetHours !== undefined
        ? String(initialTargetHours)
        : '',
    includeWeekends: true,
});

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {EntityType} props.entityType - 'client', 'project', or 'task'
 * @param {string} props.dateStr - Date string (YYYY-MM-DD) for the selected day
 * @param {'day' | 'week'} props.scope
 * @param {Date | null} props.weekStart
 * @param {Date | null} props.weekEnd
 * @param {Function} props.onSelect - Called with (entity, scheduleMode, weekday, targetHours, options) when selected
 * @param {Function} props.onCreateNew - Called when user wants to create new entity
 * @param {'add' | 'edit'} props.mode
 * @param {string | null} props.lockedEntityId
 * @param {'date' | 'weekday' | null} props.lockedScheduleMode
 * @param {number | null} props.lockedWeekday
 * @param {number | null} props.initialTargetHours
 */
const EntityPickerModal = ({
    isOpen,
    onClose,
    entityType,
    dateStr,
    onSelect,
    onCreateNew,
    scope = 'day',
    weekStart = null,
    weekEnd = null,
    mode = 'add',
    lockedEntityId = null,
    lockedScheduleMode = null,
    lockedWeekday = null,
    initialTargetHours = null,
}) => {
    const { clients } = useClients();
    const { projects } = useProjects();
    const { tasks } = useTasks({ includeArchived: mode === 'edit' });

    const isEditMode = mode === 'edit';

    const [modalState, setModalState] = useState(() => createInitialModalState({
        isEditMode,
        lockedEntityId,
        lockedScheduleMode,
        initialTargetHours,
        scope,
    }));

    const {
        selectedEntityId,
        scheduleMode,
        taskSearch,
        targetHours,
        includeWeekends,
    } = modalState;

    // Calculate the weekday for the selected date
    const weekday = useMemo(() => {
        if (!dateStr) return 0;
        const [year, month, day] = dateStr.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        return getDay(localDate);
    }, [dateStr]);

    const effectiveWeekday = useMemo(() => {
        if (isEditMode && typeof lockedWeekday === 'number') {
            return lockedWeekday;
        }
        return weekday;
    }, [isEditMode, lockedWeekday, weekday]);

    const weekdayName = WEEKDAY_NAMES[effectiveWeekday];

    const weekRangeLabel = useMemo(() => {
        if (!weekStart) return '';
        const start = weekStart;
        const end = includeWeekends
            ? addDays(weekStart, 6)
            : addDays(weekStart, 4);
        return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
    }, [weekStart, includeWeekends]);

    // Get entities based on type (filter out archived)
    const entities = useMemo(() => {
        switch (entityType) {
            case 'client':
                return clients
                    .filter(c => !c.archived || c.id === lockedEntityId)
                    .map(c => ({
                        id: c.id,
                        name: c.title,
                        subtitle: c.email || null,
                        entity: c,
                    }))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            case 'project':
                return projects
                    .filter(p => !p.archived || p.id === lockedEntityId)
                    .map(p => {
                        const client = clients.find(c => c.id === p.preferredClientId);
                        return {
                            id: p.id,
                            name: p.title,
                            subtitle: client?.title || null,
                            entity: p,
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name));
            case 'task':
                return tasks
                    .filter(t => (!t.archived && !t.completed) || t.id === lockedEntityId)
                    .map(t => {
                        const project = projects.find(p => p.id === t.projectId);
                        return {
                            id: t.id,
                            name: t.title,
                            subtitle: project?.title || 'Standalone task',
                            entity: t,
                        };
                    })
                    .sort((a, b) => {
                        const createdDiff = (b.entity.createdAt || 0) - (a.entity.createdAt || 0);
                        if (createdDiff !== 0) return createdDiff;
                        return a.name.localeCompare(b.name);
                    });
            default:
                return [];
        }
    }, [entityType, clients, projects, tasks, lockedEntityId]);

    // Filter tasks by search
    const filteredTasks = useMemo(() => {
        if (entityType !== 'task' || !taskSearch.trim()) return entities;
        const query = taskSearch.toLowerCase();
        return entities.filter(e => 
            e.name.toLowerCase().includes(query) ||
            (e.subtitle && e.subtitle.toLowerCase().includes(query))
        );
    }, [entityType, entities, taskSearch]);

    // Selected entity
    const selectedEntity = useMemo(() => {
        return entities.find(e => e.id === selectedEntityId)?.entity || null;
    }, [entities, selectedEntityId]);

    const typeLabel = useMemo(() => {
        switch (entityType) {
            case 'client': return 'Client';
            case 'project': return 'Project';
            case 'task': return 'Task';
            default: return 'Item';
        }
    }, [entityType]);

    const handleConfirm = useCallback(() => {
        if (!selectedEntity) return;
        const parsedTargetHours = targetHours === '' ? null : Number(targetHours);
        const safeTargetHours = Number.isFinite(parsedTargetHours) ? parsedTargetHours : null;
        const appliedScheduleMode = isEditMode && lockedScheduleMode ? lockedScheduleMode : scheduleMode;
        const appliedWeekday = isEditMode && typeof lockedWeekday === 'number' ? lockedWeekday : weekday;
        const shouldClose = onSelect(selectedEntity, appliedScheduleMode, appliedWeekday, safeTargetHours, {
            includeWeekends,
            weekStart,
            weekEnd,
        });
        if (shouldClose === false) {
            return;
        }
        onClose();
    }, [selectedEntity, scheduleMode, weekday, targetHours, onSelect, onClose, isEditMode, lockedScheduleMode, lockedWeekday, includeWeekends, weekStart, weekEnd]);

    const handleCreateNew = useCallback(() => {
        if (!onCreateNew) return;
        onCreateNew();
        onClose();
    }, [onCreateNew, onClose]);

    const handleTaskSelect = useCallback((entity) => {
        setModalState((prev) => ({ ...prev, selectedEntityId: entity.id }));
    }, []);

    // For tasks, we need the scrollable list; for clients/projects, use dropdown
    const showDropdown = entityType === 'client' || entityType === 'project';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEditMode ? 'Edit planner options' : `Attach ${typeLabel} to Planner`}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    {/* Entity Selection - Dropdown for clients/projects */}
                    {showDropdown && !isEditMode && (
                        <div className="space-y-2">
                            <InlineFieldHeader
                                action={onCreateNew ? (
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        onClick={handleCreateNew}
                                        className="h-auto p-0"
                                    >
                                        + New {typeLabel}
                                    </Button>
                                ) : null}
                            >
                                <Label htmlFor="entity-select">
                                    {typeLabel} <span className="text-destructive-strong">*</span>
                                </Label>
                            </InlineFieldHeader>
                            <Select
                                value={selectedEntityId}
                                onValueChange={(value) => setModalState((prev) => ({ ...prev, selectedEntityId: value }))}
                            >
                                <SelectTrigger id="entity-select">
                                    <SelectValue placeholder={`Select a ${typeLabel.toLowerCase()}...`}>
                                        {selectedEntity ? selectedEntity.title : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {entities.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-muted-foreground">
                                            No {typeLabel.toLowerCase()}s found
                                        </div>
                                    ) : (
                                        entities.map((item) => (
                                            <SelectItem key={item.id} value={item.id}>
                                                <div className="flex flex-col">
                                                    <span>{item.name}</span>
                                                    {item.subtitle && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {item.subtitle}
                                                        </span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Task Selection - Searchable list */}
                    {entityType === 'task' && !isEditMode && (
                        <div className="space-y-2">
                            <InlineFieldHeader
                                action={onCreateNew ? (
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        onClick={handleCreateNew}
                                        className="h-auto p-0"
                                    >
                                        + New Task
                                    </Button>
                                ) : null}
                            >
                                <Label>
                                    Task <span className="text-destructive-strong">*</span>
                                </Label>
                            </InlineFieldHeader>
                            <div className="relative">
                                <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
                                <Input
                                    placeholder="Search tasks"
                                    value={taskSearch}
                                    onChange={(e) => setModalState((prev) => ({ ...prev, taskSearch: e.target.value }))}
                                    autoFocus
                                    className="pl-9"
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto border rounded-md">
                                {filteredTasks.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        {taskSearch ? `No tasks matching "${taskSearch}"` : 'No tasks found'}
                                    </div>
                                ) : (
                                    <ul className="divide-y">
                                        {filteredTasks.map((item) => (
                                            <li key={item.id}>
                                                <button
                                                    type="button"
                                                    className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2 cursor-pointer ${
                                                        selectedEntityId === item.id 
                                                            ? 'bg-primary/10 border-l-2 border-l-primary' 
                                                            : 'hover:bg-accent'
                                                    }`}
                                                    onClick={() => handleTaskSelect(item.entity)}
                                                >
                                                    {item.entity.recurring ? (
                                                        <ArrowPathIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    ) : (
                                                        <CheckIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium truncate">{item.name}</div>
                                                        {item.subtitle && (
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {item.subtitle}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {isEditMode && selectedEntity && (
                        <div className="space-y-2">
                            <Label>
                                {typeLabel} <span className="text-destructive-strong">*</span>
                            </Label>
                            <Input
                                value={selectedEntity.title}
                                disabled
                                readOnly
                            />
                            {(selectedEntity.email || selectedEntity.preferredClientId || selectedEntity.projectId) && (
                                <p className="text-xs text-muted-foreground">
                                    {entityType === 'client' && selectedEntity.email}
                                    {entityType === 'project' && clients.find(c => c.id === selectedEntity.preferredClientId)?.title}
                                    {entityType === 'task' && projects.find(p => p.id === selectedEntity.projectId)?.title}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Schedule Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="schedule-select">Schedule</Label>
                        {isEditMode ? (
                            <Input
                                value={lockedScheduleMode === 'weekday'
                                    ? `Every ${weekdayName}`
                                    : `This day (${dateStr ? format(new Date(dateStr), 'MMM d') : ''})`
                                }
                                disabled
                                readOnly
                            />
                        ) : (
                            <Select
                                value={scheduleMode}
                                onValueChange={(value) => setModalState((prev) => ({ ...prev, scheduleMode: value }))}
                            >
                                <SelectTrigger id="schedule-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {scope === 'week' ? (
                                        <>
                                            <SelectItem value="week">
                                                This week ({weekRangeLabel})
                                            </SelectItem>
                                            <SelectItem value="every-week">
                                                Every week
                                            </SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="date">
                                                This day ({dateStr ? format(new Date(dateStr), 'MMM d') : ''})
                                            </SelectItem>
                                            <SelectItem value="weekday">
                                                Every {weekdayName}
                                            </SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {scope === 'week'
                                ? (scheduleMode === 'every-week'
                                    ? 'Item will appear every week on the selected days.'
                                    : 'Item will appear on each day in this week.')
                                : (scheduleMode === 'date'
                                    ? 'Item will appear on this specific date.'
                                    : `Item will appear every ${weekdayName} going forward.`
                                )
                            }
                        </p>
                    </div>

                    {scope === 'week' && (
                        <CustomCheckbox
                            checked={includeWeekends}
                            onChange={(checked) => setModalState((prev) => ({ ...prev, includeWeekends: checked }))}
                            label="Include weekends"
                        />
                    )}

                    {/* Target Hours for Selected Day */}
                    <div className="space-y-2">
                        <Label htmlFor="target-hours">
                            {scope === 'week'
                                ? `Target hours for ${scheduleMode === 'every-week' ? 'every week' : `this week (${weekRangeLabel})`}`
                                : `Target hours for ${scheduleMode === 'weekday' ? weekdayName : 'this day'}`
                            }
                            <span className="text-muted-foreground ml-1 text-xs">(optional)</span>
                        </Label>
                        <Input
                            id="target-hours"
                            type="number"
                            min="0.5"
                            max={scope === 'week' ? 168 : 24}
                            step="0.5"
                            placeholder={scope === 'week' ? 'e.g., 40' : 'e.g., 2.5'}
                            value={targetHours}
                            onChange={(e) => {
                                const nextValue = e.target.value;
                                if (nextValue === '') {
                                    setModalState((prev) => ({ ...prev, targetHours: '' }));
                                    return;
                                }
                                const parsedValue = Number(nextValue);
                                if (!Number.isFinite(parsedValue)) {
                                    return;
                                }
                                const maxValue = scope === 'week' ? 168 : 24;
                                const clampedValue = Math.min(maxValue, Math.max(0.5, parsedValue));
                                setModalState((prev) => ({ ...prev, targetHours: String(clampedValue) }));
                            }}
                        />
                        <p className="text-xs text-muted-foreground">
                            {scope === 'week'
                                ? 'How many hours you plan to work across the week.'
                                : (scheduleMode === 'weekday'
                                    ? `How many hours you plan to work each ${weekdayName}.`
                                    : 'How many hours you plan to work on this date.'
                                )
                            }
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2">
                        <Button
                            className="w-full"
                            onClick={handleConfirm}
                            disabled={!selectedEntity}
                        >
                            {isEditMode ? 'Save changes' : 'Attach to Planner'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default EntityPickerModal;
