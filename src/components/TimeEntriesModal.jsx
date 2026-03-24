import { useState, useEffect, useMemo, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon, ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import AddTimeEntryModal from './modals/AddTimeEntryModal';
import { formatDurationWithSeconds, toDisplayDate } from '../utils/dateUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';

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

    // Yjs hooks for state
    const { entries: timeEntries, deleteEntry } = useTimeEntries();

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

    // State for add/edit entry modal
    const [editingEntry, setEditingEntry] = useState(null);
    const [showAddEntryModal, setShowAddEntryModal] = useState(false);

    const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState(null);

    // State for collapsible billed entries section
    const [showBilledEntries, setShowBilledEntries] = useState(false);

    // Reset forms when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setEditingEntry(null);
            setPendingDeleteEntryId(null);
            setShowAddEntryModal(false);
        }
    }, [isOpen]);

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
        setEditingEntry(entry);
        setShowAddEntryModal(true);
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

    if (!task) return null;

    // Helper function to render a time entry
    const renderTimeEntry = (entry, isBilled = false) => {
        const { date: startDate, time: startTime } = formatDateTime(entry.start);
        const { date: endDate, time: endTime } = formatDateTime(entry.end);
        const duration = entry.end - entry.start;

        return (
            <div key={entry.id} className={`border border-border rounded-lg p-3 hover:shadow-md transition-shadow ${isBilled ? 'bg-muted opacity-75' : ''}`}>
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
                                    className="status-warning-action h-7 w-7 text-muted-foreground"
                                    title="Edit entry"
                                >
                                    <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="status-danger-action h-7 w-7 text-muted-foreground"
                                    title="Delete entry"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
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
                    <Button
                        onClick={() => {
                            setEditingEntry(null);
                            setShowAddEntryModal(true);
                        }}
                        leadingIcon={PlusIcon}
                    >
                        Add Entry
                    </Button>
                </div>

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

            <AddTimeEntryModal
                isOpen={showAddEntryModal}
                onClose={() => {
                    setShowAddEntryModal(false);
                    setEditingEntry(null);
                }}
                task={task}
                entry={editingEntry}
            />

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
