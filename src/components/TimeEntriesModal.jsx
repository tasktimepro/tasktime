import { useState, useEffect, useMemo, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon, ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDurationWithSeconds, toDisplayDate, getTodayString, getCurrentTimeString, timestampToDateString, timestampToTimeString } from '../utils/dateUtils';
import { checkTimeOverlap } from '../utils/timeValidationUtils';
import { generateId } from '../utils/idUtils';
import { useToast } from '../hooks/useToast';

/**
 * TimeEntriesModal component - Modal for viewing and managing time entries for a task
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Function to close modal
 * @param {Object} props.task - Task object
 * @param {Array} props.timeEntries - Array of all time entries
 * @param {Function} props.setTimeEntries - Function to update time entries
 * @param {Array} props.allTasks - Array of all tasks (for overlap validation)
 */
const TimeEntriesModal = ({ isOpen, onClose, task, timeEntries, setTimeEntries, allTasks = [] }) => {
    const { showSuccess, showError } = useToast();

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
        endDate: '',
        endTime: '',
        note: ''
    });

    // State for adding new entry
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        note: ''
    });

    // State for collapsible billed entries section
    const [showBilledEntries, setShowBilledEntries] = useState(false);

    // Reset forms when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setEditingEntry(null);
            setShowAddForm(false);
            resetForms();
        }
    }, [isOpen]);

    const resetForms = () => {
        const todayDate = getTodayString();
        const currentTime = getCurrentTimeString();
        
        setEditForm({
            startDate: '',
            startTime: '',
            endDate: '',
            endTime: '',
            note: ''
        });
        
        setAddForm({
            startDate: todayDate,
            startTime: currentTime,
            endDate: todayDate,
            endTime: currentTime,
            note: ''
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
            startTime: timestampToTimeString(entry.start),
            endDate: timestampToDateString(entry.end),
            endTime: timestampToTimeString(entry.end),
            note: entry.note || ''
        });
        
        setEditingEntry(entry);
    };

    // Handle saving edited entry
    const handleSaveEdit = () => {
        if (!editForm.startDate || !editForm.startTime || !editForm.endDate || !editForm.endTime) {
            showError('Please fill in all date and time fields');
            return;
        }

        const startTimestamp = new Date(`${editForm.startDate}T${editForm.startTime}`).getTime();
        const endTimestamp = new Date(`${editForm.endDate}T${editForm.endTime}`).getTime();

        if (endTimestamp <= startTimestamp) {
            showError('End time must be after start time');
            return;
        }

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

        const updatedEntries = timeEntries.map(entry => 
            entry.id === editingEntry.id 
                ? { 
                    ...entry, 
                    start: startTimestamp, 
                    end: endTimestamp,
                    note: editForm.note.trim() || undefined
                }
                : entry
        );

        setTimeEntries(updatedEntries);
        setEditingEntry(null);
        showSuccess('Time entry updated successfully');
    };

    // Handle deleting an entry
    const handleDeleteEntry = (entryId) => {
        const entry = timeEntries.find(e => e.id === entryId);
        if (!canDeleteEntry(entry)) {
            showError('Cannot delete billed time entries. This entry was included in a previous invoice and must be preserved for accounting records.');
            return;
        }

        if (window.confirm('Are you sure you want to delete this time entry?')) {
            const updatedEntries = timeEntries.filter(entry => entry.id !== entryId);
            setTimeEntries(updatedEntries);
            showSuccess('Time entry deleted successfully');
        }
    };

    // Handle adding new entry
    const handleAddEntry = () => {
        if (!addForm.startDate || !addForm.startTime || !addForm.endDate || !addForm.endTime) {
            showError('Please fill in all date and time fields');
            return;
        }

        const startTimestamp = new Date(`${addForm.startDate}T${addForm.startTime}`).getTime();
        const endTimestamp = new Date(`${addForm.endDate}T${addForm.endTime}`).getTime();

        if (endTimestamp <= startTimestamp) {
            showError('End time must be after start time');
            return;
        }

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

        const newEntry = {
            id: generateId(),
            taskId: task.id,
            start: startTimestamp,
            end: endTimestamp,
            note: addForm.note.trim() || undefined
        };

        setTimeEntries([...timeEntries, newEntry]);
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
                    <div className="border border-border rounded-lg p-3 bg-muted">
                        <h4 className="text-sm font-medium text-foreground mb-3">Edit Time Entry</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor={`edit-start-date-${entry.id}`} className="text-xs">Start Date</Label>
                                <Input
                                    id={`edit-start-date-${entry.id}`}
                                    type="date"
                                    value={editForm.startDate}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={`edit-start-time-${entry.id}`} className="text-xs">Start Time</Label>
                                <Input
                                    id={`edit-start-time-${entry.id}`}
                                    type="time"
                                    step="1"
                                    value={editForm.startTime}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={`edit-end-date-${entry.id}`} className="text-xs">End Date</Label>
                                <Input
                                    id={`edit-end-date-${entry.id}`}
                                    type="date"
                                    value={editForm.endDate}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={`edit-end-time-${entry.id}`} className="text-xs">End Time</Label>
                                <Input
                                    id={`edit-end-time-${entry.id}`}
                                    type="time"
                                    step="1"
                                    value={editForm.endTime}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                        </div>
                        <div className="mt-3 space-y-1.5">
                            <Label htmlFor={`edit-note-${entry.id}`} className="text-xs">Note (optional)</Label>
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
                    <Button
                        onClick={() => setShowAddForm(true)}
                        leadingIcon={PlusIcon}
                    >
                        Add Entry
                    </Button>
                </div>

                {/* Add New Entry Form */}
                {showAddForm && (
                    <div className="border border-border rounded-lg p-4 bg-muted">
                        <h4 className="text-sm font-medium text-foreground mb-3">Add New Time Entry</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="add-start-date" className="text-xs">Start Date</Label>
                                <Input
                                    id="add-start-date"
                                    type="date"
                                    value={addForm.startDate}
                                    onChange={(e) => setAddForm(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="add-start-time" className="text-xs">Start Time</Label>
                                <Input
                                    id="add-start-time"
                                    type="time"
                                    step="1"
                                    value={addForm.startTime}
                                    onChange={(e) => setAddForm(prev => ({ ...prev, startTime: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="add-end-date" className="text-xs">End Date</Label>
                                <Input
                                    id="add-end-date"
                                    type="date"
                                    value={addForm.endDate}
                                    onChange={(e) => setAddForm(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="add-end-time" className="text-xs">End Time</Label>
                                <Input
                                    id="add-end-time"
                                    type="time"
                                    step="1"
                                    value={addForm.endTime}
                                    onChange={(e) => setAddForm(prev => ({ ...prev, endTime: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                        </div>
                        <div className="mt-3 space-y-1.5">
                            <Label htmlFor="add-note" className="text-xs">Note (optional)</Label>
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
    );
};

export default TimeEntriesModal;
