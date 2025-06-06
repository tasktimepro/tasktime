import { TrashIcon } from '@heroicons/react/24/outline';
import { formatDurationWithSeconds, hoursToMinutes } from '../../utils/dateUtils';
import CustomCheckbox from '../CustomCheckbox';
import Modal from '../Modal';

const InvoiceModal = ({
    showInvoiceForm,
    editingInvoice,
    handleCancel,
    handleSaveInvoice,
    onNavigateToProjects,
    isProjectContextFixed,
    projects,
    selectedProject,
    handleProjectSelection,
    clientInfos,
    selectedClientInfo,
    handleClientInfoSelection,
    onNavigateToClientInfo,
    invoiceTasks,
    setShowAddTaskForm,
    showAddTaskForm,
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
    handleToggleFlatRate,
    handleAdditionalTaskHoursChange,
    handleAdditionalTaskFlatRateChange,
    handleAdditionalTaskQuantityChange,
    handleAdditionalTaskHourlyRateChange,
    pricingCollapsed,
    setPricingCollapsed,
    calculatePricing,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    shippingAmount,
    setShippingAmount,
    taxOverride,
    setTaxOverride,
    getCurrencySymbol,
    businessInfos,
    selectedBusinessInfo,
    onNavigateToBusinessInfo,
    paymentMethods,
    selectedPaymentMethod,
    onNavigateToPaymentMethods,
    invoiceNote,
    setInvoiceNote,
    invoiceNoteCollapsed,
    setInvoiceNoteCollapsed,
    editableHours,
    taskFlatRates,
    useFlatRate,
    taskHourlyRates,
    taskQuantities,
    setNewTaskUseFlatRate,
    selectedTasksForBilling,
    setSelectedTasksForBilling,
    setSelectedPaymentMethod,
    setSelectedBusinessInfo,
    mergedSubtasks,
    handleToggleMergeSubtasks,
    taskInputRef
}) => {
    if (!showInvoiceForm) return null;
    return (
        <Modal 
            isOpen={showInvoiceForm}
            onClose={handleCancel}
            title={editingInvoice ? 'Edit Invoice' : 'New Invoice'}
            size="2xl"
        >
            <div className="space-y-4">
                    <form onSubmit={handleSaveInvoice} className="space-y-5">

                        {/* Project Selection */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                    Project <span className="text-red-500">*</span>
                                </h4>
                                {onNavigateToProjects && !isProjectContextFixed && !editingInvoice && (
                                    <button
                                        type="button"
                                        onClick={onNavigateToProjects}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        + New Project
                                    </button>
                                )}
                            </div>

                            {projects.length === 0 ? (
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-sm text-yellow-800 mb-3">
                                        No projects found. Create a project to continue with invoice generation.
                                    </p>
                                    {onNavigateToProjects && !isProjectContextFixed && !editingInvoice && (
                                        <button
                                            type="button"
                                            onClick={onNavigateToProjects}
                                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200"
                                        >
                                            Create Project
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <select
                                        value={selectedProject?.id || ''}
                                        onChange={(e) => handleProjectSelection(e.target.value)}
                                        className={`block w-full border ${(isProjectContextFixed || editingInvoice) ? 'bg-gray-100' : 'bg-white'} border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2`}
                                        required
                                        disabled={isProjectContextFixed || editingInvoice}
                                    >
                                        <option value="" disabled>Select project</option>
                                        {projects.map(proj => (
                                            <option key={proj.id} value={proj.id}>
                                                {proj.title}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedProject && (
                                        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                                            <div className="text-sm text-blue-800">
                                                {selectedProject.hourlyRate ? (
                                                    <div className="text-sm text-blue-800">
                                                        <strong>{selectedProject.title}</strong><br />
                                                        Rate: {getCurrencySymbol(selectedProject.currency)}{selectedProject.hourlyRate}/hour
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-blue-800">
                                                        <strong>{selectedProject.title}</strong><br />
                                                        You can create invoices with custom rates
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Client Info Selection */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                    Client <span className="text-red-500">*</span>
                                </h4>
                                <button
                                    type="button"
                                    onClick={onNavigateToClientInfo}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    + New Client Info
                                </button>
                            </div>

                            {clientInfos.length === 0 ? (
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-sm text-yellow-800 mb-3">
                                        No client information found. Create one to include client details in the invoice.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={onNavigateToClientInfo}
                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200"
                                    >
                                        Create Client Info
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <select
                                        value={selectedClientInfo?.id || ''}
                                        onChange={(e) => handleClientInfoSelection(e.target.value)}
                                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2"
                                        required
                                    >
                                        {/* Make this placeholder not disabled to allow clearing the selection if needed */}
                                        <option value="">Select client info</option>
                                        {clientInfos.map(clientInfo => (
                                            <option key={clientInfo.id} value={clientInfo.id}>
                                                {clientInfo.title.trim()}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedClientInfo && (
                                        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                                            <p className="text-sm text-blue-800">
                                                <strong>{selectedClientInfo.title}</strong> will be included as "Invoice To" in the invoice.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tasks with Editable Hours */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center space-x-2">
                                    <h4 className="text-sm font-medium text-gray-900">
                                        Tasks & Time <span className="text-red-500">*</span>
                                    </h4>
                                    {invoiceTasks.length > 0 && (
                                        <div className="relative group flex">
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            <div className="absolute left-0 top-6 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
                                                ✓ Select or create the tasks you want to bill. Unchecked tasks will remain unbilled and appear in future invoices.
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddTaskForm(true)}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        + Add Task
                                    </button>
                                </div>
                            </div>
                            {invoiceTasks.length > 0 && (
                                <div className="mb-3">
                                    <div className="flex space-x-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allSelected = {};
                                                invoiceTasks.forEach(task => {
                                                    allSelected[task.id] = true;
                                                });
                                                setSelectedTasksForBilling(allSelected);
                                            }}
                                            className="text-xs text-blue-600 hover:text-blue-800"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-xs text-gray-400">|</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedTasksForBilling({});
                                            }}
                                            className="text-xs text-gray-600 hover:text-gray-800"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {/* Removed debug log */}
                                {invoiceTasks.map((task) => {
                                    const currentHours = editableHours[task.id] !== undefined ? editableHours[task.id] : task.hours;
                                    const currentMinutes = hoursToMinutes(currentHours);
                                    const currentFlatRate = taskFlatRates[task.id] || 0;
                                    // For existing invoices, calculate originalTimeMs from originalHours if not present
                                    const originalTimeMs = task.originalTimeMs || (task.originalHours * 60 * 60 * 1000);

                                    // Check if this task uses flat rate
                                    const isUsingFlatRate = useFlatRate[task.id] || false;
                                    
                                    // Check if this is a parent task with subtasks in the invoice
                                    // Make sure to check all subtasks, not just selected ones
                                    const hasSubtasksInInvoice = invoiceTasks.some(subtask => subtask.parentTaskId === task.id);
                                    const isSubtask = Boolean(task.parentTaskId);
                                    const isParentMerged = task.parentTaskId && mergedSubtasks[task.parentTaskId];
                                    
                                    // Skip rendering subtasks if their parent is merged
                                    if (isSubtask && isParentMerged) {
                                        return null;
                                    }

                                    return (
                                        <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                            <div className="flex items-center space-x-3 flex-1">
                                                {/* Task selection checkbox */}
                                                <CustomCheckbox
                                                    checked={selectedTasksForBilling[task.id] || false}
                                                    onChange={() => handleTaskSelectionForBilling(task.id, !selectedTasksForBilling[task.id])}
                                                />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {task.title}
                                                        {isSubtask && (
                                                            <span className="ml-2 text-xs text-gray-500">
                                                                (subtask)
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Original: {formatDurationWithSeconds(originalTimeMs)}
                                                        {task.isEdited && (
                                                            <span className="text-blue-600 ml-2">(Modified)</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-4">
                                                {/* Merge subtasks checkbox - only show for parent tasks with subtasks */}
                                                {hasSubtasksInInvoice && (
                                                    <div className="flex items-center bg-blue-50 px-2 py-2 rounded">
                                                        <CustomCheckbox
                                                            checked={mergedSubtasks[task.id] || false}
                                                            onChange={() => handleToggleMergeSubtasks(task.id, !mergedSubtasks[task.id])}
                                                            title="Merge subtasks with this parent task"
                                                        />
                                                        <label className="ml-2 text-xs text-blue-700 font-medium">
                                                            Merge subtasks
                                                        </label>
                                                    </div>
                                                )}
                                                
                                                {/* Add flat rate toggle */}
                                                <div className="flex items-center">
                                                    <CustomCheckbox
                                                        checked={isUsingFlatRate}
                                                        onChange={() => handleToggleFlatRate(task.id, !isUsingFlatRate)}
                                                    />
                                                    <label htmlFor={`flat-rate-${task.id}`} className="ml-2 text-xs text-gray-700">
                                                        Flat rate
                                                    </label>
                                                </div>

                                                {isUsingFlatRate ? (
                                                    // Flat rate input with quantity
                                                    <div className="flex items-center space-x-2">
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">Quantity</div>
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="1"
                                                                value={taskQuantities[task.id] || 1}
                                                                onChange={(e) => handleQuantityChange(task.id, e.target.value)}
                                                                className="w-16 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                placeholder="1"
                                                            />
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">Rate ({selectedProject?.currency || "USD"})</div>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={currentFlatRate === '' ? '' : currentFlatRate.toFixed(2)}
                                                                onChange={(e) => handleFlatRateChange(task.id, e.target.value)}
                                                                className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Hours input with custom hourly rate
                                                    <div className="flex items-center space-x-2">
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">
                                                                Hours {(() => {
                                                                    let displayHours = currentHours;
                                                                    let displayMinutes = currentMinutes;
                                                                    
                                                                    // If this task has merged subtasks, calculate total hours
                                                                    if (mergedSubtasks[task.id]) {
                                                                        const subtaskHours = invoiceTasks
                                                                            .filter(subtask => subtask.parentTaskId === task.id)
                                                                            .reduce((total, subtask) => {
                                                                                const hours = editableHours[subtask.id] !== undefined ? editableHours[subtask.id] : subtask.hours;
                                                                                return total + hours;
                                                                            }, 0);
                                                                        displayHours = currentHours + subtaskHours;
                                                                        displayMinutes = hoursToMinutes(displayHours);
                                                                    }
                                                                    
                                                                    return `(${displayMinutes}min)`;
                                                                })()}
                                                            </div>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={(() => {
                                                                    if (currentHours === '') return '';
                                                                    
                                                                    if (mergedSubtasks[task.id]) {
                                                                        // Calculate combined hours for display purposes
                                                                        const subtaskHours = invoiceTasks
                                                                            .filter(subtask => subtask.parentTaskId === task.id)
                                                                            .reduce((total, subtask) => {
                                                                                const hours = editableHours[subtask.id] !== undefined ? editableHours[subtask.id] : subtask.hours;
                                                                                return total + hours;
                                                                            }, 0);
                                                                        const totalHours = currentHours + subtaskHours;
                                                                        return totalHours.toFixed(2);
                                                                    }
                                                                    
                                                                    return currentHours.toFixed(2);
                                                                })()}
                                                                onChange={(e) => handleHoursChange(task.id, e.target.value)}
                                                                className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                title={mergedSubtasks[task.id] ? "This shows the combined hours of parent and subtasks. Editing changes the parent task hours." : ""}
                                                            />
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">Hourly rate</div>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={taskHourlyRates[task.id] === '' ? '' : (taskHourlyRates[task.id] || selectedProject?.hourlyRate || 0).toFixed(2)}
                                                                onChange={(e) => handleTaskHourlyRateChange(task.id, e.target.value)}
                                                                className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
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
                                {additionalTasks.map((task) => {
                                    const currentMinutes = hoursToMinutes(task.hours || 0);
                                    const currentFlatRate = task.flatRate || 0;

                                    // Check if this task uses flat rate (from task object or state)
                                    const isUsingFlatRate = task.useFlatRate || useFlatRate[task.id] || false;

                                    return (
                                        <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                            <div className="flex items-center space-x-3 flex-1">
                                                {/* Task remove button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAdditionalTask(task.id)}
                                                    className="text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded"
                                                    title="Remove task"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                                    <p className="text-xs text-gray-500">
                                                        Custom task
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                {/* Add flat rate toggle */}
                                                <div className="flex items-center ">
                                                    <CustomCheckbox
                                                        checked={isUsingFlatRate}
                                                        onChange={() => handleToggleFlatRate(task.id, !isUsingFlatRate)}
                                                    />
                                                    <label htmlFor={`flat-rate-${task.id}`} className="ml-2 text-xs text-gray-700">
                                                        Flat rate
                                                    </label>
                                                </div>

                                                {isUsingFlatRate ? (
                                                    // Flat rate input with quantity
                                                    <div className="flex items-center space-x-2">
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">Quantity</div>
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="1"
                                                                value={task.quantity || 1}
                                                                onChange={(e) => handleAdditionalTaskQuantityChange(task.id, e.target.value)}
                                                                className="w-16 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                placeholder="1"
                                                            />
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">Rate ({selectedProject?.currency || "USD"})</div>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={currentFlatRate === '' ? '' : currentFlatRate.toFixed(2)}
                                                                onChange={(e) => handleAdditionalTaskFlatRateChange(task.id, e.target.value)}
                                                                className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Hours input with custom hourly rate
                                                    <div className="flex items-center space-x-2">
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">Hours ({currentMinutes}min)</div>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={task.hours === '' ? '' : (task.hours || 0).toFixed(2)}
                                                                onChange={(e) => handleAdditionalTaskHoursChange(task.id, e.target.value)}
                                                                className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                            />
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">Hourly rate</div>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={task.hourlyRate === '' ? '' : (task.hourlyRate || selectedProject?.hourlyRate || 0).toFixed(2)}
                                                                onChange={(e) => handleAdditionalTaskHourlyRateChange(task.id, e.target.value)}
                                                                className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
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

                            {/* Add Task Form */}
                            {showAddTaskForm && (
                                <div className="mt-2 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <div className="space-y-3">
                                        <div>
                                            <input
                                                ref={taskInputRef}
                                                type="text"
                                                value={newTaskTitle}
                                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                                placeholder="Task description"
                                                className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
                                                required
                                            />
                                        </div>

                                        <div className="flex justify-between items-end">
                                            {/* Checkbox + Inputs */}
                                            <div className="flex items-center space-x-2">
                                                <div className="flex items-center space-x-2 mr-1">
                                                    <CustomCheckbox
                                                        checked={newTaskUseFlatRate}
                                                        onChange={handleToggleNewTaskFlatRate}
                                                    />
                                                    <label htmlFor="new-task-flat-rate" className="text-xs text-gray-700">
                                                        Flat rate
                                                    </label>
                                                </div>

                                                {newTaskUseFlatRate && (
                                                    <div className="text-right">
                                                        <div className="text-xs text-gray-500 mb-1 text-left">Quantity</div>
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            min="1"
                                                            value={newTaskQuantity}
                                                            onChange={(e) => setNewTaskQuantity(Math.max(1, parseFloat(e.target.value) || 1))}
                                                            className="w-16 text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
                                                            placeholder="1"
                                                        />
                                                    </div>
                                                )}

                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500 mb-1 text-left">
                                                        {newTaskUseFlatRate ? `Rate (${selectedProject?.currency || "USD"})` : `Hours ${newTaskHours ? `(${hoursToMinutes(parseFloat(newTaskHours) || 0)}min)` : ''}`}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={newTaskHours}
                                                        onChange={(e) => setNewTaskHours(e.target.value)}
                                                        placeholder={newTaskUseFlatRate ? "0.00" : "Hours"}
                                                        className="w-24 text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
                                                    />
                                                </div>

                                                {!newTaskUseFlatRate && (
                                                    <div className="text-right">
                                                        <div className="text-xs text-gray-500 mb-1 text-left">Hourly rate</div>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={newTaskHourlyRate || selectedProject?.hourlyRate || 0}
                                                            onChange={(e) => setNewTaskHourlyRate(e.target.value)}
                                                            placeholder="0.00"
                                                            className="w-20 text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Buttons */}
                                            <div className="flex space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowAddTaskForm(false);
                                                        setNewTaskTitle('');
                                                        setNewTaskHours('');
                                                        setNewTaskHourlyRate('');
                                                        setNewTaskUseFlatRate(false);
                                                    }}
                                                    className="h-[36px] px-3 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
                                                >
                                                    Cancel
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={handleAddAdditionalTask}
                                                    className="h-[36px] px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                                                >
                                                    Add Task
                                                </button>
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
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                            <p className="text-sm text-yellow-800">
                                                Please add a task to continue...
                                            </p>
                                        </div>
                                    );
                                } else if (selectedTasksCount === 0 && additionalTasks.length === 0) {
                                    return (
                                        <div className="mt-2 bg-orange-50 border border-orange-200 rounded-md p-3">
                                            <p className="text-sm text-orange-800">
                                                Please select or create at least one task to bill...
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Comprehensive Pricing & Totals Section */}
                            <div className="mt-4">
                                <div className="border border-gray-200 rounded-t-lg">
                                    <button
                                        type="button"
                                        onClick={() => setPricingCollapsed(!pricingCollapsed)}
                                        className="w-full px-4 py-3 text-left border-b border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-t-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-gray-900">Pricing & Totals</h4>
                                            <div className="flex items-center space-x-3">
                                                <span className="text-sm font-medium text-blue-600">
                                                    {selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.total.toFixed(2)}
                                                </span>
                                                <svg
                                                    className={`w-5 h-5 text-gray-500 transform transition-transform ${pricingCollapsed ? '' : 'rotate-180'}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </button>

                                    {!pricingCollapsed && (
                                        <div className="p-4 space-y-4">
                                            {/* Discount Settings */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Discount</label>
                                                <div className="flex space-x-2">
                                                    <select
                                                        value={discountType}
                                                        onChange={(e) => setDiscountType(e.target.value)}
                                                        className="w-24 text-sm border border-gray-300 rounded-md px-2 py-1"
                                                    >
                                                        <option value="percentage">%</option>
                                                        <option value="fixed">{selectedProject ? getCurrencySymbol(selectedProject.currency) : '$'}</option>
                                                    </select>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={discountValue === '' ? '' : discountValue}
                                                        onChange={(e) => {
                                                            const newValue = e.target.value;
                                                            if (newValue === '') {
                                                                setDiscountValue('');
                                                            } else {
                                                                setDiscountValue(parseFloat(newValue) || 0);
                                                            }
                                                        }}
                                                        className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1"
                                                        placeholder={discountType === 'percentage' ? '0.00' : '0.00'}
                                                    />
                                                </div>
                                            </div>

                                            {/* Shipping */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Shipping</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={shippingAmount === '' ? '' : shippingAmount}
                                                    onChange={(e) => {
                                                        const newValue = e.target.value;
                                                        if (newValue === '') {
                                                            setShippingAmount('');
                                                        } else {
                                                            setShippingAmount(parseFloat(newValue) || 0);
                                                        }
                                                    }}
                                                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            {/* Tax Override */}
                                            <div>
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <CustomCheckbox
                                                        checked={taxOverride.enabled}
                                                        onChange={() => setTaxOverride(prev => ({ ...prev, enabled: !prev.enabled }))}
                                                    />
                                                    <label htmlFor="taxOverrideEnabled" className="text-sm font-medium text-gray-700">
                                                        Override tax settings
                                                    </label>
                                                </div>

                                                {taxOverride.enabled && (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <input
                                                                type="text"
                                                                value={taxOverride.label}
                                                                onChange={(e) => setTaxOverride(prev => ({ ...prev, label: e.target.value }))}
                                                                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                                                                placeholder="Tax label"
                                                            />
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="100"
                                                                value={taxOverride.rate === '' ? '' : taxOverride.rate}
                                                                onChange={(e) => {
                                                                    const newValue = e.target.value;
                                                                    if (newValue === '') {
                                                                        setTaxOverride(prev => ({ ...prev, rate: '' }));
                                                                    } else {
                                                                        setTaxOverride(prev => ({ ...prev, rate: parseFloat(newValue) || 0 }));
                                                                    }
                                                                }}
                                                                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                                                                placeholder="Rate %"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {!taxOverride.enabled && selectedProject?.taxEnabled && (
                                                    <div className="text-xs text-gray-500">
                                                        Using project tax: {selectedProject.taxLabel} {selectedProject.taxRate}%
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pricing Breakdown */}
                                            <div className="border-t pt-3 space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Subtotal:</span>
                                                    <span>{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.subtotal.toFixed(2)}</span>
                                                </div>

                                                {calculatePricing.discount > 0 && (
                                                    <div className="flex justify-between text-sm text-red-600">
                                                        <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : getCurrencySymbol(selectedProject?.currency || 'USD') + discountValue}):</span>
                                                        <span>-{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.discount.toFixed(2)}</span>
                                                    </div>
                                                )}

                                                {calculatePricing.shipping > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span>Shipping:</span>
                                                        <span>{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.shipping.toFixed(2)}</span>
                                                    </div>
                                                )}

                                                {calculatePricing.tax > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span>{calculatePricing.taxLabel} ({calculatePricing.taxRate}%):</span>
                                                        <span>{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.tax.toFixed(2)}</span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between text-base font-medium border-t pt-2">
                                                    <span>Total:</span>
                                                    <span>{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.total.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Business Info Selection */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                    Invoice From
                                </h4>
                                <button
                                    type="button"
                                    onClick={onNavigateToBusinessInfo}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    + New Business Info
                                </button>
                            </div>

                            {businessInfos.length === 0 ? (
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-sm text-yellow-800 mb-3">
                                        No business information found. Create one to include your business details in the invoice.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={onNavigateToBusinessInfo}
                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200"
                                    >
                                        Create Business Info
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <select
                                        value={selectedBusinessInfo?.id || ''}
                                        onChange={(e) => {
                                            if (e.target.value === "") {
                                                setSelectedBusinessInfo(null);
                                            } else {
                                                const businessInfo = businessInfos.find(bi => bi.id === e.target.value);
                                                if (businessInfo) {
                                                    setSelectedBusinessInfo(businessInfo);
                                                }
                                            }
                                        }}
                                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2"
                                    >
                                        <option value="">Select business info (optional)</option>
                                        {businessInfos.map(info => (
                                            <option key={info.id} value={info.id}>
                                                {info.title}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedBusinessInfo && (
                                        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                                            <p className="text-sm text-blue-800">
                                                <strong>{selectedBusinessInfo.title}</strong> will be included as "Invoice From" in the invoice.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Payment Method Selection */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                    Payment Method
                                </h4>
                                <button
                                    type="button"
                                    onClick={onNavigateToPaymentMethods}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    + New Payment Method
                                </button>
                            </div>

                            {paymentMethods.length === 0 ? (
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-sm text-yellow-800 mb-3">
                                        No payment methods found. Create one to include payment details in your invoice.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={onNavigateToPaymentMethods}
                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200"
                                    >
                                        Create Payment Method
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <select
                                        value={selectedPaymentMethod?.id || ''}
                                        onChange={(e) => {
                                            if (e.target.value === "") {
                                                setSelectedPaymentMethod(null);
                                            } else {
                                                const paymentMethod = paymentMethods.find(pm => pm.id === e.target.value);
                                                if (paymentMethod) {
                                                    setSelectedPaymentMethod(paymentMethod);
                                                }
                                            }
                                        }}
                                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2"
                                    >
                                        <option value="">Select payment method (optional)</option>
                                        {paymentMethods.map(method => (
                                            <option key={method.id} value={method.id}>
                                                {method.title}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedPaymentMethod && (
                                        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                                            <p className="text-sm text-blue-800">
                                                <strong>{selectedPaymentMethod.title}</strong> will be included as "Payment Details" in the invoice.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Invoice Note */}
                        <div className="mb-6">
                            <button
                                type="button"
                                onClick={() => setInvoiceNoteCollapsed(!invoiceNoteCollapsed)}
                                className="flex items-center flex-start w-full text-left space-x-2"
                            >
                                <label className="block text-sm font-medium text-gray-900">
                                    Invoice Note <span className="text-gray-500 font-normal">(optional)</span>
                                </label>
                                <svg
                                    className={`w-4 h-4 transition-transform ${invoiceNoteCollapsed ? 'rotate-0' : 'rotate-180'}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {!invoiceNoteCollapsed && (
                                <div className="mt-2">
                                    <textarea
                                        value={invoiceNote}
                                        onChange={(e) => setInvoiceNote(e.target.value)}
                                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2"
                                        rows="3"
                                        placeholder="Add any additional notes for the invoice here..."
                                    ></textarea>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                            >
                                {editingInvoice ? 'Update Invoice' : 'Generate New Invoice'}
                            </button>
                        </div>
                    </form>
                </div>
        </Modal>
    );
};

export default InvoiceModal;
