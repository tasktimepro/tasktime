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
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { getActualDurationMs, getBillableDurationMs, hasBillableDurationOverride } from '../utils/timeEntryDurationUtils.ts';
import { isManualTimeEntryLocked } from '@/domain/time/manualTimeEntryOperations';

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
    const isMobileLayout = useIsMobileLayout();

    // Yjs hooks for state
    const { entries: timeEntries, deleteManualEntry } = useTimeEntries();

    // Helper functions for billing protection

    const isEntryBilled = useCallback(
        (entry) => {
            if (!task || !entry) return false;
            return isManualTimeEntryLocked(entry, task);
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
    const [isDeletingEntry, setIsDeletingEntry] = useState(false);

    // State for collapsible billed entries section
    const [showBilledEntries, setShowBilledEntries] = useState(false);

    // Reset forms when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setEditingEntry(null);
            setPendingDeleteEntryId(null);
            setIsDeletingEntry(false);
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

        if (isDeletingEntry) return;
        setPendingDeleteEntryId(null);
    };

    const confirmDeleteEntry = async () => {

        if (!pendingDeleteEntryId || isDeletingEntry) {

            return;
        }

        setIsDeletingEntry(true);
        try {
            const deleted = await deleteManualEntry(pendingDeleteEntryId);
            if (!deleted) throw new Error('Time entry not found.');
            showSuccess('Time entry deleted successfully');
            setPendingDeleteEntryId(null);
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Could not delete the time entry');
        } finally {
            setIsDeletingEntry(false);
        }
    };

    const pendingDeleteEntry = pendingDeleteEntryId
        ? timeEntries.find(entry => entry.id === pendingDeleteEntryId)
        : null;

    if (!task) return null;

    // Helper function to render a time entry
    const renderTimeEntry = (entry, isBilled = false) => {
        const { date: startDate, time: startTime } = formatDateTime(entry.start);
        const { date: endDate, time: endTime } = formatDateTime(entry.end);
        const duration = getActualDurationMs(entry);
        const billableDuration = getBillableDurationMs(entry);
        const showsBillableMinimum = hasBillableDurationOverride(entry);

        return (
            <div key={entry.id} className={`border border-border rounded-lg p-3 hover:shadow-md transition-shadow ${isBilled ? 'bg-muted/70' : ''}`}>
                {isMobileLayout ? (
                    <div className="space-y-2">
                        <div
                            className="flex items-center justify-between gap-3 text-sm"
                            data-testid={`time-entry-summary-${entry.id}`}
                        >
                            <div className="min-w-0 text-muted-foreground">
                                {startDate !== endDate ? `${startDate} → ${endDate}` : startDate}
                            </div>
                            <div className="shrink-0 text-foreground font-medium">
                                {formatDurationWithSeconds(duration)}
                            </div>
                        </div>
                        <div
                            className="flex items-center justify-between gap-3"
                            data-testid={`time-entry-row-${entry.id}`}
                        >
                            <div
                                className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                                data-testid={`time-entry-range-${entry.id}`}
                            >
                                <span className="font-mono text-foreground">{startTime}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-mono text-foreground">{endTime}</span>
                            </div>
                            <div
                                className="flex shrink-0 items-center gap-2"
                                data-testid={`time-entry-actions-${entry.id}`}
                            >
                                {isBilled && (
                                    <Badge className="border-border bg-background text-foreground">Billed</Badge>
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
                        {entry.note && (
                            <div className="text-sm text-muted-foreground bg-muted p-2 rounded border-l-4 border-border">
                                {entry.note}
                            </div>
                        )}
                        {showsBillableMinimum && (
                            <div className="text-xs text-muted-foreground">
                                Billed: <span className="font-bold text-foreground">{formatDurationWithSeconds(billableDuration)}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-3" data-testid={`time-entry-desktop-${entry.id}`}>
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
                            {showsBillableMinimum && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                    Billed: <span className="font-bold text-foreground">{formatDurationWithSeconds(billableDuration)}</span>
                                </div>
                            )}
                        </div>
                        <div className="ml-4 flex items-center space-x-2" data-testid={`time-entry-desktop-actions-${entry.id}`}>
                            {isBilled && (
                                <Badge className="border-border bg-background text-foreground">Billed</Badge>
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
                            disabled={isDeletingEntry}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteEntry}
                            disabled={isDeletingEntry}
                        >
                            {isDeletingEntry ? 'Deleting…' : 'Delete'}
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
