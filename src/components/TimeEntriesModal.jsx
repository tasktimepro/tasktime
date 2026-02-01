import { useState, useEffect, useMemo, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon, ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Notice } from '@/components/ui/notice';
import { TimePicker } from '@/components/ui/time-picker';
import { formatDurationWithSeconds, toDisplayDate, getTodayString, getCurrentTimeString, timestampToDateString, timestampToTimeString } from '../utils/dateUtils.ts';
import { checkTimeOverlap } from '../utils/timeValidationUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useTasks } from '../hooks/useTasks.ts';

/**
 * TimeEntriesModal component - Modal for viewing and managing time entries for a task
 * Uses Yjs hooks directly for state management
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Function to close modal
 * @param {Object} props.task - Task object
 */
const TimeEntriesModal = ({ isOpen, onClose, task }) => {
    const { showSuccess, showError } = useToast();

    const MINUTES_PER_HOUR = 60;
    const HOURS_PER_DAY = 24;
    const DAYS_PER_WEEK = 7;
    const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
    const MINUTES_PER_WEEK = DAYS_PER_WEEK * MINUTES_PER_DAY;

    const parseTimeSpentInput = (value) => {
        if (!value || !value.trim()) {
            return { isValid: false, error: 'Please enter time spent' };
        }

        const normalized = value.toLowerCase().replace(/,/g, ' ').trim();
        const compact = normalized.replace(/\s+/g, '');
        const matches = [...compact.matchAll(/(\d+)([wdhm])/g)];

        if (matches.length === 0) {
            return { isValid: false, error: 'Use format like 2w 4d 6h 45m' };
        }

        const reconstructed = matches.map(match => `${match[1]}${match[2]}`).join('');
        if (reconstructed.length !== compact.length) {
            return { isValid: false, error: 'Use format like 2w 4d 6h 45m' };
        }

        let totalMinutes = 0;

        matches.forEach(match => {
            const amount = parseInt(match[1], 10);
            const unit = match[2];

            if (Number.isNaN(amount) || amount <= 0) {
                return;
            }

            switch (unit) {
                case 'w':
                    totalMinutes += amount * MINUTES_PER_WEEK;
                    break;
                case 'd':
                    totalMinutes += amount * MINUTES_PER_DAY;
                    break;
                case 'h':
                    totalMinutes += amount * MINUTES_PER_HOUR;
                    break;
                case 'm':
                    totalMinutes += amount;
                    break;
                default:
                    break;
            }
        });

        if (totalMinutes <= 0) {
            return { isValid: false, error: 'Time spent must be greater than 0' };
        }

        return { isValid: true, durationMs: totalMinutes * 60 * 1000 };
    };

    const formatDurationForInput = (durationMs) => {
        if (!durationMs || durationMs <= 0) return '';

        let remainingMinutes = Math.round(durationMs / (1000 * 60));

        const weeks = Math.floor(remainingMinutes / MINUTES_PER_WEEK);
        remainingMinutes -= weeks * MINUTES_PER_WEEK;

        const days = Math.floor(remainingMinutes / MINUTES_PER_DAY);
        remainingMinutes -= days * MINUTES_PER_DAY;

        const hours = Math.floor(remainingMinutes / MINUTES_PER_HOUR);
        remainingMinutes -= hours * MINUTES_PER_HOUR;

        const minutes = remainingMinutes;

        const parts = [];

        if (weeks) parts.push(`${weeks}w`);
        if (days) parts.push(`${days}d`);
        if (hours) parts.push(`${hours}h`);
        if (minutes || parts.length === 0) parts.push(`${minutes}m`);

        return parts.join(' ');
    };
    
    // Yjs hooks for state
    const { entries: timeEntries, createEntry, updateEntry, deleteEntry } = useTimeEntries();
    const { tasks: allTasks } = useTasks();

    // Helper functions for billing protection

    const isEntryBilled = useCallback(
        (entry) => {
            if (!task || !entry) return false;
            // Only consider entries billed if the task has actually been billed (has lastBilledAt)
            if (!task.lastBilledAt) return false;
            return entry.start <= task.lastBilledAt;
        },
        [task]
    );

    const canEditEntry = (entry) => {
        return !isEntryBilled(entry);
    };

    const canDeleteEntry = (entry) => {
        return !isEntryBilled(entry);
    };

    // Filter time entries for this task
    const taskTimeEntries = useMemo(() => {
        return timeEntries
            .filter(entry => entry.taskId === task?.id)
            .sort((a, b) => b.start - a.start); // Most recent first
    }, [timeEntries, task?.id]);

    // Separate billed and unbilled entries
    const { billedEntries, unbilledEntries } = useMemo(() => {
        const billed = [];
        const unbilled = [];
        
        taskTimeEntries.forEach(entry => {
            if (isEntryBilled(entry)) {
                billed.push(entry);
            } else {
                unbilled.push(entry);
            }
        });
        
        return { billedEntries: billed, unbilledEntries: unbilled };
    }, [taskTimeEntries, isEntryBilled]);

    // Calculate total time
    const totalTime = useMemo(() => {
        return taskTimeEntries.reduce((total, entry) => {
            if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' && 
                !isNaN(entry.start) && !isNaN(entry.end)) {
                return total + (entry.end - entry.start);
            }
            return total;
        }, 0);
    }, [taskTimeEntries]);

    // State for editing entries
    const [editingEntry, setEditingEntry] = useState(null);
    const [editForm, setEditForm] = useState({
        startDate: '',
        startTime: '',
        timeSpent: '',
        note: ''
    });

    // State for adding new entry
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({
        startDate: '',
        startTime: '',
        timeSpent: '',
        note: ''
    });

    const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState(null);

    // State for collapsible billed entries section
    const [showBilledEntries, setShowBilledEntries] = useState(false);

    // Reset forms when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setEditingEntry(null);
            setShowAddForm(false);
            resetForms();
            setPendingDeleteEntryId(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!showAddForm) {
            return;
        }

        setAddForm(prev => {
            const todayDate = getTodayString();
            const currentTime = getCurrentTimeString();

            return {
                ...prev,
                startDate: prev.startDate || todayDate,
                startTime: prev.startTime || currentTime
            };
        });
    }, [showAddForm]);

    const getShortTimeString = () => getCurrentTimeString().slice(0, 5);
    const formatShortTime = (timestamp) => timestampToTimeString(timestamp).slice(0, 5);

    const resetForms = () => {
        const todayDate = getTodayString();
        const currentTime = getShortTimeString();
        
        setEditForm({
            startDate: '',
            startTime: '',
            timeSpent: '',
            note: ''
        });
        
        setAddForm({
            startDate: todayDate,
            startTime: currentTime,
            timeSpent: '',
            note: ''
        });
    };

    const updateFormForTimeSpent = (setForm, value) => {
        const durationResult = parseTimeSpentInput(value);
        const now = Date.now();

        setForm(prev => {
            const nextForm = {
                ...prev,
                timeSpent: value
            };

            if (durationResult.isValid) {
                const startTimestamp = now - durationResult.durationMs;
                nextForm.startDate = timestampToDateString(startTimestamp);
                nextForm.startTime = formatShortTime(startTimestamp);
            }

            return nextForm;
        });
    };

    // Format date and time for display
    const formatDateTime = (timestamp) => {
        const date = new Date(timestamp);
        return {
            date: toDisplayDate(date),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
    };

    // Handle editing an entry
    const handleEditEntry = (entry) => {
        if (!canEditEntry(entry)) {
            showError('Cannot edit billed time entries. This entry was included in a previous invoice.');
            return;
        }

        setEditForm({
            startDate: timestampToDateString(entry.start),
            startTime: formatShortTime(entry.start),
            timeSpent: formatDurationForInput(entry.end - entry.start),
            note: entry.note || ''
        });
        
        setEditingEntry(entry);
    };

    // Handle saving edited entry
    const handleSaveEdit = () => {
        if (!editForm.startDate || !editForm.startTime) {
            showError('Please fill in date started and start time');
            return;
        }

        const durationResult = parseTimeSpentInput(editForm.timeSpent);
        if (!durationResult.isValid) {
            showError(durationResult.error);
            return;
        }

        const startTimestamp = new Date(`${editForm.startDate}T${editForm.startTime}`).getTime();
        const endTimestamp = startTimestamp + durationResult.durationMs;

        // Check for overlaps with other time entries in the same project
        const overlapCheck = checkTimeOverlap(
            startTimestamp,
            endTimestamp,
            task.projectId,
            timeEntries,
            allTasks,
            editingEntry.id // Exclude the entry being edited
        );

        if (!overlapCheck.isValid) {
            showError(overlapCheck.error);
            return;
        }

        updateEntry(editingEntry.id, {
            start: startTimestamp,
            end: endTimestamp,
            note: editForm.note.trim() || undefined
        });

        setEditingEntry(null);
        showSuccess('Time entry updated successfully');
    };

    // Handle deleting an entry (soft-delete with tombstone)
    const handleDeleteEntry = (entryId) => {
        const entry = timeEntries.find(e => e.id === entryId);
        if (!canDeleteEntry(entry)) {
            showError('Cannot delete billed time entries. This entry was included in a previous invoice and must be preserved for accounting records.');
            return;
        }
        setPendingDeleteEntryId(entryId);
    };

    const closeDeleteEntryModal = () => {

        setPendingDeleteEntryId(null);
    };

    const confirmDeleteEntry = () => {

        if (!pendingDeleteEntryId) {

            return;
        }

        deleteEntry(pendingDeleteEntryId);
        showSuccess('Time entry deleted successfully');
        setPendingDeleteEntryId(null);
    };

    const pendingDeleteEntry = pendingDeleteEntryId
        ? timeEntries.find(entry => entry.id === pendingDeleteEntryId)
        : null;

    // Handle adding new entry
    const handleAddEntry = () => {
        if (!addForm.startDate || !addForm.startTime) {
            showError('Please fill in date started and start time');
            return;
        }

        const durationResult = parseTimeSpentInput(addForm.timeSpent);
        if (!durationResult.isValid) {
            showError(durationResult.error);
            return;
        }

        const startTimestamp = new Date(`${addForm.startDate}T${addForm.startTime}`).getTime();
        const endTimestamp = startTimestamp + durationResult.durationMs;

        // Check for billing cutoff date (same logic as task editing)
        // Allow creating entries before task created time
        const billingCutoffDate = task.lastBilledAt; // || task.createdAt || 0;
        
        if (startTimestamp <= billingCutoffDate) {
            showError('Cannot add time entries before the last billing date');
            return;
        }

        // Check for overlaps with other time entries in the same project
        const overlapCheck = checkTimeOverlap(
            startTimestamp,
            endTimestamp,
            task.projectId,
            timeEntries,
            allTasks
        );

        if (!overlapCheck.isValid) {
            showError(overlapCheck.error);
            return;
        }

        createEntry({
            taskId: task.id,
            start: startTimestamp,
            end: endTimestamp,
            note: addForm.note.trim() || undefined
        });

        setShowAddForm(false);
        resetForms();
        showSuccess('Time entry added successfully');
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setEditingEntry(null);
        resetForms();
    };

    // Cancel adding
    const handleCancelAdd = () => {
        setShowAddForm(false);
        resetForms();
    };

    if (!task) return null;

    // Helper function to render a time entry
    const renderTimeEntry = (entry, isBilled = false) => {
        const { date: startDate, time: startTime } = formatDateTime(entry.start);
        const { date: endDate, time: endTime } = formatDateTime(entry.end);
        const duration = entry.end - entry.start;
        const isEditing = editingEntry?.id === entry.id;

        return (
            <div key={entry.id} className={`border border-border rounded-lg p-3 hover:shadow-md transition-shadow ${isBilled ? 'bg-muted opacity-75' : ''}`}>
                {isEditing ? (
                    // Edit form
                    <div className="border border-border rounded-lg p-3 bg-card">
                        <h4 className="text-sm font-medium text-foreground mb-3">Edit Time Entry</h4>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor={`edit-time-spent-${entry.id}`}>Time spent</Label>
                                <Input
                                    id={`edit-time-spent-${entry.id}`}
                                    type="text"
                                    value={editForm.timeSpent}
                                    onChange={(e) => updateFormForTimeSpent(setEditForm, e.target.value)}
                                    className="text-sm bg-background text-foreground"
                                />
                                <p className="text-xs text-muted-foreground">Format: 2w 4d 6h 45m</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor={`edit-start-date-${entry.id}`}>Date started</Label>
                                    <Input
                                        id={`edit-start-date-${entry.id}`}
                                        type="date"
                                        value={editForm.startDate}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                                        className="text-sm bg-background text-foreground dark:[color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor={`edit-start-time-${entry.id}`}>Start time</Label>
                                    <TimePicker
                                        id={`edit-start-time-${entry.id}`}
                                        value={editForm.startTime}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                                        className="text-sm bg-background"
                                        showSeconds={false}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 space-y-2">
                            <Label htmlFor={`edit-note-${entry.id}`}>Note (optional)</Label>
                            <Textarea
                                id={`edit-note-${entry.id}`}
                                value={editForm.note}
                                onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                                placeholder="What was done during this time..."
                                rows={2}
                                className="text-sm"
                            />
                        </div>
                        <div className="mt-3 flex justify-end space-x-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleCancelEdit}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveEdit}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                ) : (
                    // Display mode
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <div className="flex items-center space-x-4 text-sm">
                                <div className="flex items-center space-x-2">
                                    <span className="text-muted-foreground">{startDate}</span>
                                    <span className="font-mono text-foreground">{startTime}</span>
                                    <span className="text-muted-foreground">→</span>
                                    {startDate !== endDate && <span className="text-muted-foreground">{endDate}</span>}
                                    <span className="font-mono text-foreground">{endTime}</span>
                                </div>
                                <div className="text-foreground font-medium">
                                    {formatDurationWithSeconds(duration)}
                                </div>
                            </div>
                            {entry.note && (
                                <div className="mt-2 text-sm text-muted-foreground bg-muted p-2 rounded border-l-4 border-border">
                                    {entry.note}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                            {isBilled && (
                                <Badge variant="secondary">Billed</Badge>
                            )}
                            {!isBilled && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditEntry(entry)}
                                        className="h-7 w-7 text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50"
                                        title="Edit entry"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteEntry(entry.id)}
                                        className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                        title="Delete entry"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const footer = (
        <div className="flex justify-between items-center gap-3">
            <div className="text-sm text-muted-foreground">
                Total Time: <span className="font-medium text-foreground">{formatDurationWithSeconds(totalTime)}</span>
            </div>
            <Button variant="secondary" onClick={onClose}>
                Close
            </Button>
        </div>
    );

    return (
        <>
            <Modal 
                isOpen={isOpen} 
                onClose={onClose}
                title={`Time Entries - ${task.title}`}
                size="xl"
                footer={footer}
            >
                <div className="space-y-4">
                {/* Add New Entry Button */}
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-foreground">
                        {taskTimeEntries.length} {taskTimeEntries.length === 1 ? 'Entry' : 'Entries'}
                    </h3>
                    {!showAddForm && (
                        <Button
                            onClick={() => setShowAddForm(true)}
                            leadingIcon={PlusIcon}
                        >
                            Add Entry
                        </Button>
                    )}
                </div>

                {/* Add New Entry Form */}
                {showAddForm && (
                    <div className="border border-border rounded-lg p-4 bg-card">
                        <h4 className="text-sm font-medium text-foreground mb-3">Add New Time Entry</h4>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="add-time-spent">Time spent</Label>
                                <Input
                                    id="add-time-spent"
                                    type="text"
                                    value={addForm.timeSpent}
                                    onChange={(e) => updateFormForTimeSpent(setAddForm, e.target.value)}
                                    className="text-sm bg-background text-foreground"
                                />
                                <p className="text-xs text-muted-foreground">Format: 2w 4d 6h 45m</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="add-start-date">Date started</Label>
                                    <Input
                                        id="add-start-date"
                                        type="date"
                                        value={addForm.startDate}
                                        onChange={(e) => setAddForm(prev => ({ ...prev, startDate: e.target.value }))}
                                        className="text-sm bg-background text-foreground dark:[color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="add-start-time">Start time</Label>
                                    <TimePicker
                                        id="add-start-time"
                                        value={addForm.startTime}
                                        onChange={(e) => setAddForm(prev => ({ ...prev, startTime: e.target.value }))}
                                        className="text-sm bg-background"
                                        showSeconds={false}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 space-y-2">
                            <Label htmlFor="add-note">Note (optional)</Label>
                            <Textarea
                                id="add-note"
                                value={addForm.note}
                                onChange={(e) => setAddForm(prev => ({ ...prev, note: e.target.value }))}
                                placeholder="What was done during this time..."
                                rows={2}
                                className="text-sm"
                            />
                        </div>
                        <div className="mt-3 flex justify-end space-x-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleCancelAdd}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleAddEntry}
                            >
                                Add Entry
                            </Button>
                        </div>
                    </div>
                )}

                {/* Time Entries List */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {taskTimeEntries.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <ClockIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-sm">No time entries found for this task</p>
                            <p className="text-xs text-muted-foreground mt-1">Click "Add Entry" to get started</p>
                        </div>
                    ) : (
                        <>
                            {/* Unbilled Time Entries */}
                            {unbilledEntries.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-foreground mb-2">
                                        Current Time Entries ({unbilledEntries.length})
                                    </h4>
                                    {unbilledEntries.map((entry) => renderTimeEntry(entry, false))}
                                </div>
                            )}

                            {/* Billed Time Entries - Collapsible Section */}
                            {billedEntries.length > 0 && (
                                <div className="border-t border-border pt-4">
                                    <button
                                        onClick={() => setShowBilledEntries(!showBilledEntries)}
                                        className="flex items-center justify-between w-full text-left text-sm font-medium text-foreground hover:text-foreground transition-colors"
                                    >
                                        <span>Billed Time Entries ({billedEntries.length})</span>
                                        {showBilledEntries ? (
                                            <ChevronDownIcon className="h-4 w-4 mr-1" />
                                        ) : (
                                            <ChevronRightIcon className="h-4 w-4 mr-1" />
                                        )}
                                    </button>
                                    
                                    {showBilledEntries && (
                                        <div className="mt-1 space-y-2">
                                            <p className="text-xs text-muted-foreground mb-3">
                                                These entries have been billed and cannot be modified
                                            </p>
                                            {billedEntries.map((entry) => renderTimeEntry(entry, true))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                </div>
            </Modal>

            <Modal
                isOpen={Boolean(pendingDeleteEntryId)}
                onClose={closeDeleteEntryModal}
                title="Delete time entry?"
                description="This will permanently remove the time entry."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeDeleteEntryModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteEntry}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <Notice
                    title={pendingDeleteEntry
                        ? `Deleting this time entry (${formatDurationWithSeconds(pendingDeleteEntry.end - pendingDeleteEntry.start)}) cannot be undone.`
                        : 'Deleting this time entry cannot be undone.'}
                    variant="destructive"
                />
            </Modal>
        </>
    );
};

export default TimeEntriesModal;
