/**
 * TaskModal component - Modal for creating and editing tasks
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Notice } from '@/components/ui/notice';
import { useToast } from '../../hooks/useToast.ts';
import { useTasks } from '../../hooks/useTasks.ts';
import { useTimeEntries } from '../../hooks/useTimeEntries.ts';
import { useProjects } from '../../hooks/useProjects.ts';
import RecurringPicker from '../task/RecurringPicker';

const NO_PROJECT_VALUE = 'no-project';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object|null} props.editingTask
 * @param {Function} props.openProjectModal
 * @param {Object|null} props.modalOptions
 * @param {Function} props.saveFormState
 * @param {Function} props.getSavedState
 * @param {Function} props.clearSavedState
 */
const TaskModal = ({
    isOpen,
    onClose,
    editingTask = null,
    openProjectModal,
    modalOptions = null,
    saveFormState,
    getSavedState,
    clearSavedState
}) => {
    const { showSuccess, showError } = useToast();
    const { projects } = useProjects();
    const { createTask, updateTask } = useTasks();
    const { entries: timeEntries } = useTimeEntries();

    const activeProjects = useMemo(() => {
        return projects.filter((project) => !project.archived);
    }, [projects]);

    const [formData, setFormData] = useState({
        title: '',
        projectId: NO_PROJECT_VALUE,
        startDate: '',
        recurring: null,
        note: ''
    });

    const hasBilledEntries = useMemo(() => {
        if (!editingTask) return false;

        return timeEntries.some((entry) => (
            entry.taskId === editingTask.id && (
                entry.billedInvoiceId || entry.billedAt || entry.billedHourlyRate
            )
        ));
    }, [editingTask, timeEntries]);

    // Track initialization to prevent overwriting user input on re-renders
    // Using a specific object structure to distinguish "uninitialized" from "task id is null (create mode)"
    const lastInitializedRef = useRef({ initialized: false, taskId: undefined });

    // Reset initialization tracking when modal closes
    useEffect(() => {
        if (!isOpen) {
            lastInitializedRef.current = { initialized: false, taskId: undefined };
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const currentEditingTaskId = editingTask?.id || null;

        // Skip if already initialized for this task session
        if (lastInitializedRef.current.initialized && lastInitializedRef.current.taskId === currentEditingTaskId) {
            return;
        }
        
        lastInitializedRef.current = { initialized: true, taskId: currentEditingTaskId };

        const savedState = getSavedState ? getSavedState() : null;
        const savedEditingTaskId = savedState?.editingTaskId || null;

        if (savedState && savedEditingTaskId === currentEditingTaskId) {
            setFormData({
                title: savedState.title || '',
                projectId: savedState.projectId || NO_PROJECT_VALUE,
                startDate: savedState.startDate || '',
                recurring: savedState.recurring || null,
                note: savedState.note || ''
            });
            return;
        }

        if (editingTask) {
            setFormData({
                title: editingTask.title || '',
                projectId: editingTask.projectId || NO_PROJECT_VALUE,
                startDate: editingTask.recurring ? '' : (editingTask.startDate || ''),
                recurring: editingTask.recurring || null,
                note: editingTask.note || ''
            });
            return;
        }

        setFormData({
            title: '',
            projectId: NO_PROJECT_VALUE,
            startDate: modalOptions?.startDate || '',
            recurring: null,
            note: ''
        });
    }, [isOpen, editingTask, getSavedState, modalOptions]);

    useEffect(() => {
        if (!saveFormState || !isOpen) {
            return;
        }

        const timeoutId = setTimeout(() => {
            saveFormState({
                ...formData,
                editingTaskId: editingTask?.id || null
            });
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [formData, saveFormState, editingTask, isOpen]);

    const handleProjectChange = (value) => {
        handleChange('projectId', value === NO_PROJECT_VALUE ? NO_PROJECT_VALUE : value);
    };

    const handleChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value
        }));
    };

    const handleStartDateChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            startDate: value,
            recurring: value ? null : prev.recurring
        }));
    };

    const handleRecurringChange = (config) => {
        setFormData((prev) => ({
            ...prev,
            recurring: config,
            startDate: ''
        }));
    };

    const handleRecurringClear = () => {
        setFormData((prev) => ({
            ...prev,
            recurring: null
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (!formData.title.trim()) {
            showError('Task title is required');
            return;
        }

        const payload = {
            title: formData.title.trim(),
            projectId: formData.projectId === NO_PROJECT_VALUE ? null : formData.projectId,
            startDate: formData.recurring ? null : (formData.startDate || null),
            recurring: formData.recurring || null,
            note: formData.note.trim() ? formData.note.trim() : null,
            lastActive: Date.now()
        };

        if (editingTask) {
            updateTask(editingTask.id, {
                ...payload,
                parentTaskId: editingTask.parentTaskId || null
            });
            showSuccess('Task updated');
        } else {
            createTask({
                ...payload,
                parentTaskId: null,
                completed: false,
                archived: false
            });
            showSuccess('Task created');
        }

        if (clearSavedState) {
            clearSavedState();
        }

        onClose();
    };

    const handleClose = () => {
        if (clearSavedState) {
            clearSavedState();
        }

        onClose();
    };

    const modalFooter = (
        <div className="flex justify-end space-x-3">
            <Button
                variant="outline"
                onClick={handleClose}
                type="button"
            >
                Cancel
            </Button>
            <Button
                onClick={handleSubmit}
                type="submit"
            >
                {editingTask ? 'Save' : 'Create'}
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            size='lg'
            title={editingTask ? 'Edit Task' : 'New Task'}
            footer={modalFooter}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="task-title">Task Title <span className="text-red-500">*</span></Label>
                    <Input
                        id="task-title"
                        value={formData.title}
                        onChange={(event) => handleChange('title', event.target.value)}
                        placeholder="Enter task title"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-start gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="task-start-date">Start Date</Label>
                            <Input
                                id="task-start-date"
                                type="date"
                                value={formData.startDate}
                                onChange={(event) => handleStartDateChange(event.target.value)}
                                className="w-48 dark:[color-scheme:dark]"
                                disabled={Boolean(formData.recurring)}
                            />
                        </div>
                        <div className="flex items-center justify-center text-sm text-muted-foreground px-2 pt-7">
                            or
                        </div>
                        <div className="space-y-2 flex-1">
                            <Label>Recurring</Label>
                            <RecurringPicker
                                value={formData.recurring}
                                onChange={handleRecurringChange}
                                onClear={handleRecurringClear}
                                disabled={false}
                                buttonClassName="w-full"
                                inactiveVariant="ghost"
                                inactiveClassName="border border-input bg-transparent"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="task-note">Note</Label>
                    <Textarea
                        id="task-note"
                        value={formData.note}
                        onChange={(event) => handleChange('note', event.target.value)}
                        placeholder="Add details for this task..."
                        rows={3}
                        className="text-sm"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                        <Label>Project</Label>
                        {openProjectModal && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => {
                                    if (saveFormState) {
                                        saveFormState({
                                            ...formData,
                                            editingTaskId: editingTask?.id || null
                                        });
                                    }
                                    openProjectModal();
                                }}
                            >
                                + New Project
                            </Button>
                        )}
                    </div>
                    <Select
                        value={formData.projectId}
                        onValueChange={handleProjectChange}
                        disabled={Boolean(editingTask && hasBilledEntries)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="No project (Standalone)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_PROJECT_VALUE}>No project (Standalone)</SelectItem>
                            {activeProjects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                    {project.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {editingTask && hasBilledEntries && (
                        <Notice
                            title="Project is locked"
                            description="This task has billed time entries, so its project cannot be changed."
                        />
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default TaskModal;
