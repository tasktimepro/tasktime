import { TrashIcon } from '@/components/ui/icons';
import { formatDurationWithSeconds, hoursToMinutes } from '../../utils/dateUtils.ts';
import CustomCheckbox from '../CustomCheckbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { orderTasksWithSubtasks } from './utils/taskOrdering.ts';

/**
 * InvoiceTaskSelector component - Task selection and time inputs for invoicing.
 * @param {Object} props
 */
const InvoiceTaskSelector = ({
    activeSection,
    toggleSection,
    invoiceTasks,
    selectedTasksForBilling,
    setSelectedTasksForBilling,
    setShowAddTaskForm,
    showAddTaskForm,
    taskInputRef,
    newTaskTitle,
    setNewTaskTitle,
    newTaskUseFlatRate,
    handleToggleNewTaskFlatRate,
    newTaskQuantity,
    setNewTaskQuantity,
    newTaskHours,
    setNewTaskHours,
    newTaskHourlyRate,
    setNewTaskHourlyRate,
    additionalTasks,
    handleAddAdditionalTask,
    handleRemoveAdditionalTask,
    handleTaskSelectionForBilling,
    handleHoursChange,
    handleFlatRateChange,
    handleQuantityChange,
    handleTaskHourlyRateChange,
    handleAdditionalTaskHoursChange,
    handleAdditionalTaskFlatRateChange,
    handleAdditionalTaskQuantityChange,
    handleAdditionalTaskHourlyRateChange,
    handleToggleAdditionalTaskFlatRate,
    editableHours,
    taskFlatRates,
    useFlatRate,
    taskHourlyRates,
    taskQuantities,
    mergedSubtasks,
    handleToggleMergeSubtasks,
    selectedProject,
    selectedClient,
    getInvoiceCurrency,
    setNewTaskUseFlatRate
}) => {
    const selectedTasksCount = Object.values(selectedTasksForBilling).filter(Boolean).length + additionalTasks.length;
    const orderedInvoiceTasks = orderTasksWithSubtasks(invoiceTasks);
    const taskRowClassName = 'flex flex-col gap-3 rounded border bg-card p-3 md:flex-row md:items-center md:justify-between';
    const taskMetaClassName = 'flex min-w-0 items-start gap-3 md:flex-1 md:items-center';
    const taskControlsClassName = 'flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center md:gap-4';
    const taskOptionsClassName = 'flex flex-wrap items-center gap-3 md:flex-nowrap md:gap-4';
    const taskFieldsClassName = 'grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:items-center md:gap-2';
    const quantityInputClassName = 'w-full min-w-0 rounded-md border border-border px-2.5 py-1.5 text-base text-foreground md:w-16 md:text-sm';
    const amountInputClassName = 'w-full min-w-0 rounded-md border border-border px-2.5 py-1.5 text-base text-foreground md:w-20 md:text-sm';

    return (
        <div className="border border-border rounded-lg">
            <button
                type="button"
                onClick={() => toggleSection('tasksTime')}
                className={`w-full px-4 py-3 text-left cursor-pointer bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'tasksTime' ? 'rounded-t-lg' : 'rounded-lg'}`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-foreground">Tasks & Time</h4>
                        <span className="text-xs text-muted-foreground">({selectedTasksCount})</span>
                        <div className="relative hidden sm:flex group">
                            <div
                                className="text-muted-foreground hover:text-muted-foreground cursor-help focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
                                tabIndex="0"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="absolute left-0 top-6 w-64 p-2 bg-popover text-popover-foreground border border-border text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
                                Select or create the tasks you want to bill. Unchecked tasks will remain unbilled and appear in future invoices.
                            </div>
                        </div>
                    </div>
                    <svg
                        className={`w-5 h-5 text-muted-foreground transform transition-transform ${activeSection === 'tasksTime' ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>
            {activeSection === 'tasksTime' && (
                <div className="p-4 space-y-2">
                    {/* Select All/Deselect All and Add Task buttons */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:flex-nowrap">
                            {invoiceTasks.length > 0 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allSelected = {};
                                            invoiceTasks.forEach(task => {
                                                allSelected[task.id] = true;
                                            });
                                            setSelectedTasksForBilling(allSelected);
                                        }}
                                        className="text-xs text-muted-foreground underline underline-offset-2 cursor-pointer hover:text-foreground"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-xs text-muted-foreground">|</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedTasksForBilling({});
                                        }}
                                        className="text-xs text-muted-foreground underline underline-offset-2 cursor-pointer hover:text-foreground"
                                    >
                                        Deselect All
                                    </button>
                                </>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto shrink-0 p-0"
                            onClick={() => {
                                setShowAddTaskForm(true);
                                // Use setTimeout to ensure the form is rendered before focusing
                                setTimeout(() => {
                                    if (taskInputRef && taskInputRef.current) {
                                        taskInputRef.current.focus();
                                    }
                                }, 50);
                            }}
                        >
                            + Add Task
                        </Button>
                    </div>

                    {/* Tasks with Editable Hours */}
                    <div className="space-y-2">
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {orderedInvoiceTasks.map((task) => {
                                const currentHours = editableHours[task.id] !== undefined ? editableHours[task.id] : task.hours;
                                const currentFlatRate = taskFlatRates[task.id] !== undefined ? taskFlatRates[task.id] : '';
                                // For existing invoices, calculate originalTimeMs from originalHours if not present
                                const originalTimeMs = task.originalTimeMs || (task.originalHours * 60 * 60 * 1000);

                                // Check if this task uses flat rate
                                const isUsingFlatRate = useFlatRate[task.id] || false;

                                // Check if this is a parent task with subtasks in the invoice
                                // Make sure to check all subtasks, not just selected ones
                                const hasSubtasksInInvoice = invoiceTasks.some(subtask => subtask.parentTaskId === task.id);
                                const isSubtask = Boolean(task.parentTaskId);
                                const isParentMerged = task.parentTaskId && mergedSubtasks[task.parentTaskId];

                                const numericCurrentHours = parseFloat(currentHours) || 0;
                                const mergedSubtaskHours = mergedSubtasks[task.id]
                                    ? invoiceTasks
                                        .filter(subtask => subtask.parentTaskId === task.id)
                                        .reduce((total, subtask) => {
                                            const hours = editableHours[subtask.id] !== undefined ? editableHours[subtask.id] : subtask.hours;
                                            return total + (parseFloat(hours) || 0);
                                        }, 0)
                                    : 0;
                                const displayHours = numericCurrentHours + mergedSubtaskHours;
                                const displayMinutes = hoursToMinutes(displayHours);

                                // Skip rendering subtasks if their parent is merged
                                if (isSubtask && isParentMerged) {
                                    return null;
                                }

                                return (
                                    <div key={task.id} className={taskRowClassName}>
                                        <div className={taskMetaClassName}>
                                            {/* Task selection checkbox */}
                                            <CustomCheckbox
                                                checked={selectedTasksForBilling[task.id] || false}
                                                onChange={(checked) => handleTaskSelectionForBilling(task.id, checked)}
                                            />
                                            <div className="min-w-0 flex-1 pr-0 md:pr-4">
                                                <p className="text-sm font-medium text-foreground overflow-hidden" style={{
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical'
                                                }}>
                                                    {task.title}
                                                    {isSubtask && (
                                                        <span className="ml-2 text-xs text-muted-foreground">
                                                            (subtask)
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Original: {formatDurationWithSeconds(originalTimeMs)}
                                                    {task.isEdited && (
                                                        <span className="status-info-text-strong ml-2">(Modified)</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className={taskControlsClassName}>
                                            <div className={taskOptionsClassName}>
                                                {/* Merge subtasks checkbox - only show for parent tasks with subtasks */}
                                                {hasSubtasksInInvoice && (
                                                    <div className="flex items-center rounded bg-muted px-2 py-2">
                                                        <CustomCheckbox
                                                            checked={mergedSubtasks[task.id] || false}
                                                            onChange={(checked) => handleToggleMergeSubtasks(task.id, checked)}
                                                            title="Merge subtasks with this parent task"
                                                            label="Merge subtasks"
                                                            labelClassName="text-xs text-foreground font-medium"
                                                        />
                                                    </div>
                                                )}

                                                {/* Add flat rate toggle */}
                                                <div className="flex items-center">
                                                    <CustomCheckbox
                                                        checked={isUsingFlatRate}
                                                        onChange={(checked) => handleToggleAdditionalTaskFlatRate(task.id, checked)}
                                                        label="Flat rate"
                                                        labelClassName="text-xs text-foreground"
                                                        id={`flat-rate-${task.id}`}
                                                    />
                                                </div>
                                            </div>

                                            {isUsingFlatRate ? (
                                                // Flat rate input with quantity
                                                <div className={taskFieldsClassName}>
                                                    <div className="min-w-0 text-left md:text-right">
                                                        <div className="text-xs text-muted-foreground mb-1 text-left">Quantity</div>
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            min="1"
                                                            value={taskQuantities[task.id] || 1}
                                                            onChange={(e) => handleQuantityChange(task.id, e.target.value)}
                                                            className={quantityInputClassName}
                                                            placeholder="1"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 text-left md:text-right">
                                                        <div className="text-xs text-muted-foreground mb-1 text-left">Rate ({getInvoiceCurrency()})</div>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={currentFlatRate}
                                                            onChange={(e) => handleFlatRateChange(task.id, e.target.value)}
                                                            className={`${amountInputClassName} sensitive-data`}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                // Hours input with custom hourly rate
                                                <div className={taskFieldsClassName}>
                                                    <div className="min-w-0 text-left md:text-right">
                                                        <div className="text-xs text-muted-foreground mb-1 text-left">
                                                            Hours ({displayMinutes}min)
                                                        </div>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={currentHours === '' ? '' : (mergedSubtasks[task.id] ? displayHours : currentHours)}
                                                            onChange={(e) => {
                                                                if (!mergedSubtasks[task.id]) {
                                                                    handleHoursChange(task.id, e.target.value);
                                                                    return;
                                                                }

                                                                if (e.target.value === '') {
                                                                    handleHoursChange(task.id, '');
                                                                    return;
                                                                }

                                                                const updatedMergedHours = parseFloat(e.target.value);
                                                                if (!Number.isFinite(updatedMergedHours)) {
                                                                    handleHoursChange(task.id, e.target.value);
                                                                    return;
                                                                }

                                                                const updatedParentHours = Math.max(0, updatedMergedHours - mergedSubtaskHours);
                                                                handleHoursChange(task.id, String(updatedParentHours));
                                                            }}
                                                            className={amountInputClassName}
                                                            title={mergedSubtasks[task.id] ? "This shows the combined hours of parent and subtasks. Editing adjusts the parent task hours so the merged total matches your input." : ""}
                                                        />
                                                    </div>
                                                    <div className="min-w-0 text-left md:text-right">
                                                        <div className="text-xs text-muted-foreground mb-1 text-left">Hourly rate</div>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={taskHourlyRates[task.id] !== undefined ? taskHourlyRates[task.id] : (selectedProject?.hourlyRate !== null && selectedProject?.hourlyRate !== undefined ? selectedProject.hourlyRate : (selectedClient?.hourlyRate !== null && selectedClient?.hourlyRate !== undefined ? selectedClient.hourlyRate : ''))}
                                                            onChange={(e) => handleTaskHourlyRateChange(task.id, e.target.value)}
                                                            className={`${amountInputClassName} sensitive-data`}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Additional Tasks */}
                            {additionalTasks.length > 0 && (
                                <div className="pt-2 space-y-2">
                                    <div className="text-xs text-muted-foreground">
                                        Invoice-only tasks
                                    </div>
                                    <div className="space-y-2">
                                        {additionalTasks.map((task) => {
                                            const currentMinutes = hoursToMinutes(task.hours || 0);
                                            const currentFlatRate = task.flatRate !== undefined ? task.flatRate : '';

                                            // Check if this task uses flat rate (from task object or state)
                                            const isUsingFlatRate = task.useFlatRate || useFlatRate[task.id] || false;

                                            return (
                                                <div key={task.id} className={taskRowClassName}>
                                                    <div className={taskMetaClassName}>
                                                        {/* Task remove button */}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveAdditionalTask(task.id)}
                                                            className="text-destructive-strong hover-text-destructive-strong"
                                                            title="Remove task"
                                                            aria-label="Remove task"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </Button>
                                                        <div className="min-w-0 flex-1 pr-0 md:pr-4">
                                                            <p className="text-sm font-medium text-foreground overflow-hidden" style={{
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: 'vertical'
                                                            }}>{task.title}</p>
                                                        </div>
                                                    </div>
                                                    <div className={taskControlsClassName}>
                                                        <div className={taskOptionsClassName}>
                                                            <CustomCheckbox
                                                                checked={isUsingFlatRate}
                                                                onChange={(checked) => handleToggleAdditionalTaskFlatRate(task.id, checked)}
                                                                label="Flat rate"
                                                                labelClassName="text-xs text-foreground"
                                                                id={`flat-rate-${task.id}`}
                                                            />
                                                        </div>

                                                        {isUsingFlatRate ? (
                                                            // Flat rate input with quantity
                                                            <div className={taskFieldsClassName}>
                                                                <div className="min-w-0 text-left md:text-right">
                                                                    <div className="text-xs text-muted-foreground mb-1 text-left">Quantity</div>
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        min="1"
                                                                        value={task.quantity || 1}
                                                                        onChange={(e) => handleAdditionalTaskQuantityChange(task.id, e.target.value)}
                                                                        className={quantityInputClassName}
                                                                        placeholder="1"
                                                                    />
                                                                </div>
                                                                <div className="min-w-0 text-left md:text-right">
                                                                    <div className="text-xs text-muted-foreground mb-1 text-left">Rate ({getInvoiceCurrency()})</div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={currentFlatRate}
                                                                        onChange={(e) => handleAdditionalTaskFlatRateChange(task.id, e.target.value)}
                                                                        className={`${amountInputClassName} sensitive-data`}
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // Hours input with custom hourly rate
                                                            <div className={taskFieldsClassName}>
                                                                <div className="min-w-0 text-left md:text-right">
                                                                    <div className="text-xs text-muted-foreground mb-1 text-left">Hours ({currentMinutes}min)</div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={task.hours}
                                                                        onChange={(e) => handleAdditionalTaskHoursChange(task.id, e.target.value)}
                                                                        className={amountInputClassName}
                                                                    />
                                                                </div>
                                                                <div className="min-w-0 text-left md:text-right">
                                                                    <div className="text-xs text-muted-foreground mb-1 text-left">Hourly rate</div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={task.hourlyRate !== undefined ? task.hourlyRate : (selectedProject?.hourlyRate !== null && selectedProject?.hourlyRate !== undefined ? selectedProject.hourlyRate : (selectedClient?.hourlyRate !== null && selectedClient?.hourlyRate !== undefined ? selectedClient.hourlyRate : ''))}
                                                                        onChange={(e) => handleAdditionalTaskHourlyRateChange(task.id, e.target.value)}
                                                                        className={`${amountInputClassName} sensitive-data`}
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Add Task Form */}
                        {showAddTaskForm && (
                            <div className="mt-2 mb-2 p-3 bg-card border border-border rounded-md">
                                <div className="space-y-3">
                                    <div>
                                        <Input
                                            ref={taskInputRef}
                                            type="text"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            placeholder="Task description"
                                            required
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleAddAdditionalTask();
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                        {/* Checkbox + Inputs */}
                                        <div className="flex w-full flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
                                            <div className="flex items-center">
                                                <CustomCheckbox
                                                    checked={newTaskUseFlatRate}
                                                    onChange={handleToggleNewTaskFlatRate}
                                                    label="Flat rate"
                                                    labelClassName="text-xs text-foreground"
                                                    id="new-task-flat-rate"
                                                />
                                            </div>

                                            <div className="grid w-full grid-cols-2 gap-2 md:flex md:flex-wrap md:items-end">
                                                {newTaskUseFlatRate && (
                                                    <div className="w-full text-left md:w-24 md:text-right">
                                                        <div className="text-xs text-muted-foreground mb-1 text-left">Quantity</div>
                                                        <Input
                                                            type="number"
                                                            step="1"
                                                            min="1"
                                                            value={newTaskQuantity}
                                                            onChange={(e) => setNewTaskQuantity(e.target.value)}
                                                            className="h-9 w-full md:w-24"
                                                            placeholder="1"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleAddAdditionalTask();
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                <div className="w-full text-left md:w-32 md:text-right">
                                                    <div className="text-xs text-muted-foreground mb-1 text-left">
                                                        {newTaskUseFlatRate ? `Rate (${getInvoiceCurrency()})` : `Hours ${newTaskHours ? `(${hoursToMinutes(parseFloat(newTaskHours) || 0)}min)` : ''}`}
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={newTaskHours}
                                                        onChange={(e) => setNewTaskHours(e.target.value)}
                                                        placeholder={newTaskUseFlatRate ? "0.00" : "Hours"}
                                                        className={`h-9 w-full md:w-32 ${newTaskUseFlatRate ? 'sensitive-data' : ''}`}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleAddAdditionalTask();
                                                            }
                                                        }}
                                                    />
                                                </div>

                                                {!newTaskUseFlatRate && (
                                                    <div className="w-full text-left md:w-32 md:text-right">
                                                        <div className="text-xs text-muted-foreground mb-1 text-left">Hourly rate</div>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={newTaskHourlyRate !== '' ? newTaskHourlyRate : (selectedProject?.hourlyRate !== null && selectedProject?.hourlyRate !== undefined ? selectedProject.hourlyRate : (selectedClient?.hourlyRate !== null && selectedClient?.hourlyRate !== undefined ? selectedClient.hourlyRate : ''))}
                                                            onChange={(e) => setNewTaskHourlyRate(e.target.value)}
                                                            placeholder="0.00"
                                                            className="h-9 w-full md:w-32 sensitive-data"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleAddAdditionalTask();
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Buttons */}
                                        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end md:w-auto">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => {
                                                    setShowAddTaskForm(false);
                                                    setNewTaskTitle('');
                                                    setNewTaskHours('');
                                                    setNewTaskHourlyRate('');
                                                    setNewTaskUseFlatRate(selectedProject?.flatRate || false);
                                                }}
                                            >
                                                Cancel
                                            </Button>

                                            <Button
                                                type="button"
                                                onClick={handleAddAdditionalTask}
                                            >
                                                Add Task
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Warning message for no tasks or no selected tasks */}
                        {(() => {
                            const selectedTasksCount = Object.values(selectedTasksForBilling).filter(Boolean).length;
                            const totalAvailableTasks = invoiceTasks.length + additionalTasks.length;

                            if (totalAvailableTasks === 0) {
                                return (
                                    <Notice
                                        title="Please add a task to continue."
                                    />
                                );
                            } else if (selectedTasksCount === 0 && additionalTasks.length === 0) {
                                return (
                                    <Notice
                                        title="Please select or create at least one task to bill."
                                        className="mt-2"
                                    />
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceTaskSelector;
