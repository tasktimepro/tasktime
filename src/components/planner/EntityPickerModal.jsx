/**
 * EntityPickerModal - Modal for selecting a client, project, or task
 * 
 * Shows a dropdown select for clients/projects (non-archived only),
 * or a searchable list for tasks.
 * Includes schedule selection: "This day only" or "Every {weekday}"
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { format, getDay } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

/**
 * @typedef {'client' | 'project' | 'task'} EntityType
 * @typedef {'date' | 'weekday'} ScheduleMode
 */

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {EntityType} props.entityType - 'client', 'project', or 'task'
 * @param {string} props.dateStr - Date string (YYYY-MM-DD) for the selected day
 * @param {Function} props.onSelect - Called with (entity, scheduleMode, weekday, targetHours) when selected
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
    mode = 'add',
    lockedEntityId = null,
    lockedScheduleMode = null,
    lockedWeekday = null,
    initialTargetHours = null,
}) => {

    const [selectedEntityId, setSelectedEntityId] = useState('');
    const [scheduleMode, setScheduleMode] = useState('date'); // 'date' or 'weekday'
    const [taskSearch, setTaskSearch] = useState('');
    const [targetHours, setTargetHours] = useState('');

    const { clients } = useClients();
    const { projects } = useProjects();
    const { tasks } = useTasks({ includeArchived: mode === 'edit' });

    const isEditMode = mode === 'edit';

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

    // Reset state when modal opens
    useEffect(() => {
        if (!isOpen) return;

        if (isEditMode) {
            setSelectedEntityId(lockedEntityId || '');
            setScheduleMode(lockedScheduleMode || 'date');
            setTaskSearch('');
            setTargetHours(initialTargetHours !== null && initialTargetHours !== undefined
                ? String(initialTargetHours)
                : ''
            );
            return;
        }

        setSelectedEntityId('');
        setScheduleMode('date');
        setTaskSearch('');
        setTargetHours('');
    }, [isOpen, entityType, isEditMode, lockedEntityId, lockedScheduleMode, initialTargetHours]);

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
        onSelect(selectedEntity, appliedScheduleMode, appliedWeekday, safeTargetHours);
        onClose();
    }, [selectedEntity, scheduleMode, weekday, targetHours, onSelect, onClose, isEditMode, lockedScheduleMode, lockedWeekday]);

    const handleCreateNew = useCallback(() => {
        if (!onCreateNew) return;
        onCreateNew();
        onClose();
    }, [onCreateNew, onClose]);

    const handleTaskSelect = useCallback((entity) => {
        setSelectedEntityId(entity.id);
    }, []);

    // For tasks, we need the scrollable list; for clients/projects, use dropdown
    const showDropdown = entityType === 'client' || entityType === 'project';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEditMode ? 'Edit planner options' : `Add ${typeLabel} to Planner`}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    {/* Entity Selection - Dropdown for clients/projects */}
                    {showDropdown && !isEditMode && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <Label htmlFor="entity-select">
                                    {typeLabel} <span className="text-red-500">*</span>
                                </Label>
                                {onCreateNew && (
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        onClick={handleCreateNew}
                                        className="h-auto p-0"
                                    >
                                        + New {typeLabel}
                                    </Button>
                                )}
                            </div>
                            <Select
                                value={selectedEntityId}
                                onValueChange={setSelectedEntityId}
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
                            <div className="flex items-center justify-between mb-1">
                                <Label>
                                    Task <span className="text-red-500">*</span>
                                </Label>
                                {onCreateNew && (
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        onClick={handleCreateNew}
                                        className="h-auto p-0"
                                    >
                                        + New Task
                                    </Button>
                                )}
                            </div>
                            <div className="relative">
                                <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
                                <Input
                                    placeholder="Search tasks"
                                    value={taskSearch}
                                    onChange={(e) => setTaskSearch(e.target.value)}
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
                                {typeLabel} <span className="text-red-500">*</span>
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
                                onValueChange={setScheduleMode}
                            >
                                <SelectTrigger id="schedule-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date">
                                        This day ({dateStr ? format(new Date(dateStr), 'MMM d') : ''})
                                    </SelectItem>
                                    <SelectItem value="weekday">
                                        Every {weekdayName}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {scheduleMode === 'date' 
                                ? 'Item will appear on this specific date.'
                                : `Item will appear every ${weekdayName} going forward.`
                            }
                        </p>
                    </div>

                    {/* Target Hours for Selected Day */}
                    <div className="space-y-2">
                        <Label htmlFor="target-hours">
                            Target hours for {scheduleMode === 'weekday' ? weekdayName : 'this day'}
                            <span className="text-muted-foreground ml-1 text-xs">(optional)</span>
                        </Label>
                        <Input
                            id="target-hours"
                            type="number"
                            min="0.5"
                            max="24"
                            step="0.5"
                            placeholder="e.g., 2.5"
                            value={targetHours}
                            onChange={(e) => {
                                const nextValue = e.target.value;
                                if (nextValue === '') {
                                    setTargetHours('');
                                    return;
                                }
                                const parsedValue = Number(nextValue);
                                if (!Number.isFinite(parsedValue)) {
                                    return;
                                }
                                const clampedValue = Math.min(24, Math.max(0.5, parsedValue));
                                setTargetHours(String(clampedValue));
                            }}
                        />
                        <p className="text-xs text-muted-foreground">
                            {scheduleMode === 'weekday'
                                ? `How many hours you plan to work each ${weekdayName}.`
                                : 'How many hours you plan to work on this date.'
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
                            {isEditMode ? 'Save changes' : 'Add to Planner'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default EntityPickerModal;
