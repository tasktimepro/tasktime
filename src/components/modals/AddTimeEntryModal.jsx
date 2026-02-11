/**
 * AddTimeEntryModal - Modal for adding a new time entry
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { useToast } from '@/hooks/useToast';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { BILLABLE_TIME_THRESHOLD_MS } from '@/constants/app';
import { getCurrentTimeString, getTodayString, timestampToDateString, timestampToTimeString } from '@/utils/dateUtils.ts';
import { checkTimeOverlap } from '@/utils/timeValidationUtils.ts';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {Object|null} props.task
 * @param {Object|null} [props.entry]
 * @param {string|null} [props.initialDateStr]
 */
const AddTimeEntryModal = ({
    isOpen,
    onClose,
    task,
    entry = null,
    initialDateStr = null
}) => {

    const { showSuccess, showError } = useToast();
    const { entries: timeEntries, createEntry, updateEntry } = useTimeEntries();
    const { tasks: allTasks, updateTask } = useTasks();
    const { projects } = useProjects();

    const timeSpentInputRef = useRef(null);

    const MINUTES_PER_HOUR = 60;
    const HOURS_PER_DAY = 24;
    const DAYS_PER_WEEK = 7;
    const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
    const MINUTES_PER_WEEK = DAYS_PER_WEEK * MINUTES_PER_DAY;

    const [formData, setFormData] = useState({
        startDate: '',
        startTime: '',
        timeSpent: '',
        note: ''
    });

    const getShortTimeString = () => getCurrentTimeString().slice(0, 5);
    const formatShortTime = (timestamp) => timestampToTimeString(timestamp).slice(0, 5);

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

    const resetForm = useCallback(() => {
        if (entry) {
            setFormData({
                startDate: timestampToDateString(entry.start) || '',
                startTime: formatShortTime(entry.start),
                timeSpent: formatDurationForInput(entry.end - entry.start),
                note: entry.note || ''
            });
            return;
        }

        const todayDate = initialDateStr || getTodayString();
        const currentTime = getShortTimeString();

        setFormData({
            startDate: todayDate || '',
            startTime: currentTime,
            timeSpent: '',
            note: ''
        });
    }, [entry, initialDateStr]);

    useEffect(() => {
        if (isOpen) {
            resetForm();
        }
    }, [isOpen, resetForm]);

    useEffect(() => {
        if (isOpen && timeSpentInputRef.current) {
            timeSpentInputRef.current.focus();
        }
    }, [isOpen]);

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

    const updateFormForTimeSpent = (value) => {
        const durationResult = parseTimeSpentInput(value);
        const shouldAutoSetStart = !initialDateStr && !entry;
        const now = Date.now();

        setFormData(prev => {
            const nextForm = {
                ...prev,
                timeSpent: value
            };

            if (durationResult.isValid && shouldAutoSetStart) {
                const startTimestamp = now - durationResult.durationMs;
                nextForm.startDate = timestampToDateString(startTimestamp);
                nextForm.startTime = formatShortTime(startTimestamp);
            }

            return nextForm;
        });
    };

    const projectHasHourlyRate = useMemo(() => {
        if (!task?.projectId) return false;
        const project = projects.find(p => p.id === task.projectId);
        return project && typeof project.hourlyRate === 'number' && project.hourlyRate > 0;
    }, [task?.projectId, projects]);

    const taskBillableTimeMs = useMemo(() => {
        if (!task) return 0;
        const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
        return timeEntries
            .filter(entry => entry.taskId === task.id && entry.end && entry.start > taskLastBilledAt)
            .reduce((sum, entry) => sum + (entry.end - entry.start), 0);
    }, [task, timeEntries]);

    const maybeMarkTaskBillable = useCallback((addedDurationMs) => {
        if (!task || task.billable || task.billableSetByUser) return;
        if (!projectHasHourlyRate) return;

        const newTotalTime = taskBillableTimeMs + addedDurationMs;
        if (newTotalTime >= BILLABLE_TIME_THRESHOLD_MS) {
            updateTask(task.id, { billable: true, lastActive: Date.now() });
        }
    }, [task, projectHasHourlyRate, taskBillableTimeMs, updateTask]);

    const handleSubmit = () => {
        if (!task) return;

        if (!formData.startDate || !formData.startTime) {
            showError('Please fill in date started and start time');
            return;
        }

        const durationResult = parseTimeSpentInput(formData.timeSpent);
        if (!durationResult.isValid) {
            showError(durationResult.error);
            return;
        }

        const startTimestamp = new Date(`${formData.startDate}T${formData.startTime}`).getTime();
        const endTimestamp = startTimestamp + durationResult.durationMs;

        if (!entry) {
            const billingCutoffDate = task.lastBilledAt;
            if (startTimestamp <= billingCutoffDate) {
                showError('Cannot add time entries before the last billing date');
                return;
            }
        }

        const overlapCheck = checkTimeOverlap(
            startTimestamp,
            endTimestamp,
            task.projectId,
            timeEntries,
            allTasks,
            entry?.id || null
        );

        if (!overlapCheck.isValid) {
            showError(overlapCheck.error);
            return;
        }

        if (entry) {
            updateEntry(entry.id, {
                start: startTimestamp,
                end: endTimestamp,
                note: formData.note.trim() || undefined
            });
            showSuccess('Time entry updated successfully');
            onClose();
            return;
        }

        createEntry({
            taskId: task.id,
            start: startTimestamp,
            end: endTimestamp,
            note: formData.note.trim() || undefined
        });

        maybeMarkTaskBillable(durationResult.durationMs);
        showSuccess('Time entry added successfully');
        onClose();
    };

    const modalFooter = (
        <div className="flex justify-end space-x-3">
            <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
            >
                Cancel
            </Button>
            <Button
                size="sm"
                onClick={handleSubmit}
            >
                {entry ? 'Save Changes' : 'Add Entry'}
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={entry ? 'Edit Time Entry' : 'Add Time Entry'}
            size="md"
            footer={modalFooter}
        >
            <div className="space-y-3">
                <div className="space-y-2">
                    <Label htmlFor="add-time-spent">Time spent</Label>
                    <Input
                        id="add-time-spent"
                        type="text"
                        value={formData.timeSpent}
                        onChange={(e) => updateFormForTimeSpent(e.target.value)}
                        className="text-sm bg-background text-foreground"
                        ref={timeSpentInputRef}
                    />
                    <p className="text-xs text-muted-foreground">Format: 2w 4d 6h 45m</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="add-start-date">Date started</Label>
                        <Input
                            id="add-start-date"
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                            className="text-sm bg-background text-foreground dark:[color-scheme:dark]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="add-start-time">Start time</Label>
                        <TimePicker
                            id="add-start-time"
                            value={formData.startTime}
                            onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                            className="text-sm bg-background"
                            showSeconds={false}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="add-note">Note (optional)</Label>
                    <Textarea
                        id="add-note"
                        value={formData.note}
                        onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                        placeholder="What was done during this time..."
                        rows={2}
                        className="text-sm"
                    />
                </div>
            </div>
        </Modal>
    );
};

export default AddTimeEntryModal;
