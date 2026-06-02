import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InvoiceTaskSelector from './InvoiceTaskSelector';

const findAncestorWithClass = (element, className) => {
    let current = element;

    while (current) {
        if (typeof current.className === 'string' && current.className.includes(className)) {
            return current;
        }

        current = current.parentElement;
    }

    return null;
};

const createBaseProps = (overrides = {}) => ({
    activeSection: 'tasksTime',
    toggleSection: vi.fn(),
    invoiceTasks: [],
    selectedTasksForBilling: {},
    setSelectedTasksForBilling: vi.fn(),
    setShowAddTaskForm: vi.fn(),
    showAddTaskForm: false,
    taskInputRef: { current: null },
    newTaskTitle: '',
    setNewTaskTitle: vi.fn(),
    newTaskUseFlatRate: false,
    handleToggleNewTaskFlatRate: vi.fn(),
    newTaskQuantity: 1,
    setNewTaskQuantity: vi.fn(),
    newTaskHours: '',
    setNewTaskHours: vi.fn(),
    newTaskHourlyRate: '',
    setNewTaskHourlyRate: vi.fn(),
    additionalTasks: [],
    handleAddAdditionalTask: vi.fn(),
    handleRemoveAdditionalTask: vi.fn(),
    handleTaskSelectionForBilling: vi.fn(),
    handleHoursChange: vi.fn(),
    handleToggleFlatRate: vi.fn(),
    handleFlatRateChange: vi.fn(),
    handleQuantityChange: vi.fn(),
    handleTaskHourlyRateChange: vi.fn(),
    handleAdditionalTaskHoursChange: vi.fn(),
    handleAdditionalTaskFlatRateChange: vi.fn(),
    handleAdditionalTaskQuantityChange: vi.fn(),
    handleAdditionalTaskHourlyRateChange: vi.fn(),
    handleToggleAdditionalTaskFlatRate: vi.fn(),
    editableHours: {},
    taskFlatRates: {},
    useFlatRate: {},
    taskHourlyRates: {},
    taskQuantities: {},
    mergedSubtasks: {},
    handleToggleMergeSubtasks: vi.fn(),
    selectedProject: { hourlyRate: 100, flatRate: false },
    selectedClient: null,
    getInvoiceCurrency: () => 'USD',
    setNewTaskUseFlatRate: vi.fn(),
    ...overrides
});

describe('InvoiceTaskSelector', () => {

    it('renders subtasks directly below their parent task', () => {
        render(
            <InvoiceTaskSelector
                {...createBaseProps({
                    invoiceTasks: [
                        {
                            id: 'child-1',
                            title: 'Child task',
                            parentTaskId: 'parent-1',
                            hours: 1,
                            originalHours: 1,
                            originalTimeMs: 3600000
                        },
                        {
                            id: 'parent-1',
                            title: 'Parent task',
                            parentTaskId: null,
                            hours: 2,
                            originalHours: 2,
                            originalTimeMs: 7200000
                        },
                        {
                            id: 'task-2',
                            title: 'Another root task',
                            parentTaskId: null,
                            hours: 3,
                            originalHours: 3,
                            originalTimeMs: 10800000
                        }
                    ]
                })}
            />
        );

        const parentTask = screen.getByText('Parent task');
        const childTask = screen.getByText('Child task');
        const anotherRootTask = screen.getByText('Another root task');

        expect(parentTask.compareDocumentPosition(childTask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(childTask.compareDocumentPosition(anotherRootTask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows merged total hours for parent tasks and updates parent hours from merged edits', () => {
        const handleHoursChange = vi.fn();

        render(
            <InvoiceTaskSelector
                {...createBaseProps({
                    handleHoursChange,
                    invoiceTasks: [
                        {
                            id: 'parent-1',
                            title: 'Parent task',
                            parentTaskId: null,
                            hours: 2,
                            originalHours: 2,
                            originalTimeMs: 7200000
                        },
                        {
                            id: 'child-1',
                            title: 'Child task',
                            parentTaskId: 'parent-1',
                            hours: 1.5,
                            originalHours: 1.5,
                            originalTimeMs: 5400000
                        }
                    ],
                    mergedSubtasks: { 'parent-1': true },
                    selectedTasksForBilling: { 'parent-1': true, 'child-1': false }
                })}
            />
        );

        expect(screen.getByText('Hours (210min)')).toBeInTheDocument();
        expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
        expect(screen.queryByText('Child task')).not.toBeInTheDocument();

        const mergedHoursInput = screen.getByDisplayValue('3.5');
        fireEvent.change(mergedHoursInput, { target: { value: '4.5' } });

        expect(handleHoursChange).toHaveBeenCalledWith('parent-1', '3');
    });

    it('uses standard foreground text for merge subtasks', () => {
        render(
            <InvoiceTaskSelector
                {...createBaseProps({
                    invoiceTasks: [
                        {
                            id: 'parent-1',
                            title: 'Parent task',
                            parentTaskId: null,
                            hours: 2,
                            originalHours: 2,
                            originalTimeMs: 7200000
                        },
                        {
                            id: 'child-1',
                            title: 'Child task',
                            parentTaskId: 'parent-1',
                            hours: 1,
                            originalHours: 1,
                            originalTimeMs: 3600000
                        }
                    ]
                })}
            />
        );

        const mergeSubtasksLabel = screen.getByText('Merge subtasks');

        expect(mergeSubtasksLabel.className.includes('text-foreground')).toBe(true);
        expect(mergeSubtasksLabel.className.includes('status-info-text')).toBe(false);
    });

    it('keeps task actions inline and uses full-width mobile editors before md', () => {
        render(
            <InvoiceTaskSelector
                {...createBaseProps({
                    invoiceTasks: [
                        {
                            id: 'task-1',
                            title: 'Responsive task',
                            parentTaskId: null,
                            hours: 4.25,
                            originalHours: 4.25,
                            originalTimeMs: 15300000
                        }
                    ],
                    showAddTaskForm: true,
                    selectedProject: { hourlyRate: null, flatRate: false },
                })}
            />
        );

        const taskRow = findAncestorWithClass(screen.getByText('Responsive task'), 'rounded border bg-card p-3');
        const existingHoursInput = screen.getByDisplayValue('4.25');
        const newTaskHoursInput = screen.getByPlaceholderText('Hours');
        const existingHoursGrid = findAncestorWithClass(existingHoursInput, 'grid-cols-2');
        const newTaskHoursGrid = findAncestorWithClass(newTaskHoursInput, 'grid-cols-2');
        const headerActionRow = findAncestorWithClass(screen.getByRole('button', { name: '+ Add Task' }), 'justify-between');

        expect(taskRow?.className.includes('flex-col')).toBe(true);
        expect(taskRow?.className.includes('md:flex-row')).toBe(true);
        expect(existingHoursGrid?.className.includes('grid-cols-2')).toBe(true);
        expect(existingHoursInput.className.includes('w-full')).toBe(true);
        expect(existingHoursInput.className.includes('md:w-20')).toBe(true);
        expect(newTaskHoursGrid?.className.includes('grid-cols-2')).toBe(true);
        expect(newTaskHoursInput.className.includes('w-full')).toBe(true);
        expect(newTaskHoursInput.className.includes('md:w-32')).toBe(true);
        expect(headerActionRow?.className.includes('justify-between')).toBe(true);
        expect(headerActionRow?.className.includes('flex-col')).toBe(false);
    });

    it('shows the original flat-rate summary instead of NaN for flat-rate tasks', () => {
        render(
            <InvoiceTaskSelector
                {...createBaseProps({
                    invoiceTasks: [
                        {
                            id: 'task-1',
                            title: 'Flat task',
                            parentTaskId: null,
                            flatRate: 500,
                            quantity: 1,
                        }
                    ],
                    selectedTasksForBilling: { 'task-1': true },
                    useFlatRate: { 'task-1': true },
                    selectedProject: { hourlyRate: null, flatRate: true },
                    getInvoiceCurrency: () => 'CHF',
                })}
            />
        );

        expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
        expect(screen.getByText('Original: CHF500.00 flat rate')).toBeInTheDocument();
    });

    it('uses the invoice-task flat-rate toggle handler for existing tasks', () => {
        const handleToggleFlatRate = vi.fn();
        const handleToggleAdditionalTaskFlatRate = vi.fn();

        render(
            <InvoiceTaskSelector
                {...createBaseProps({
                    handleToggleFlatRate,
                    handleToggleAdditionalTaskFlatRate,
                    invoiceTasks: [
                        {
                            id: 'task-1',
                            title: 'Existing task',
                            parentTaskId: null,
                            hours: 2,
                            originalHours: 2,
                            originalTimeMs: 7200000
                        }
                    ],
                    selectedTasksForBilling: { 'task-1': true }
                })}
            />
        );

        fireEvent.click(screen.getByLabelText('Flat rate'));

        expect(handleToggleFlatRate).toHaveBeenCalledWith('task-1', true);
        expect(handleToggleAdditionalTaskFlatRate).not.toHaveBeenCalled();
    });

    it('honors task useFlatRate and flatRate values when state overrides are missing', () => {
        render(
            <InvoiceTaskSelector
                {...createBaseProps({
                    invoiceTasks: [
                        {
                            id: 'task-1',
                            title: 'Quoted task',
                            parentTaskId: null,
                            useFlatRate: true,
                            flatRate: 500,
                            quantity: 2,
                        }
                    ],
                    selectedTasksForBilling: { 'task-1': true },
                    getInvoiceCurrency: () => 'CHF',
                })}
            />
        );

        expect(screen.getByDisplayValue('2')).toBeInTheDocument();
        expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    it('lets explicit flat-rate state override task useFlatRate metadata', () => {
        render(
            <InvoiceTaskSelector
                {...createBaseProps({
                    invoiceTasks: [
                        {
                            id: 'task-1',
                            title: 'Quoted task',
                            parentTaskId: null,
                            useFlatRate: true,
                            flatRate: 500,
                            hours: 2,
                        }
                    ],
                    selectedTasksForBilling: { 'task-1': true },
                    useFlatRate: { 'task-1': false },
                })}
            />
        );

        expect(screen.getByText('Hours (120min)')).toBeInTheDocument();
        expect(screen.queryByText('Rate (USD)')).not.toBeInTheDocument();
    });
});
