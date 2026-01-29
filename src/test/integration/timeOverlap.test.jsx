/**
 * Integration test for time overlap detection
 * Tests that users cannot create overlapping time entries
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TimeEntriesModal from '../../components/TimeEntriesModal';
import { ToastContext } from '../../contexts/ToastContext';

// Mock hooks with hoisted mocks
const mockCreateEntry = vi.fn();
const mockUpdateEntry = vi.fn();
const mockDeleteEntry = vi.fn();

const mockEntries = [
    {
        id: 'entry-1',
        taskId: 'task-1',
        start: new Date('2026-01-19T10:00:00').getTime(),
        end: new Date('2026-01-19T11:00:00').getTime()
    }
];

vi.mock('../../hooks/useTimeEntries.ts', () => ({
    useTimeEntries: () => ({
        entries: mockEntries,
        createEntry: mockCreateEntry,
        updateEntry: mockUpdateEntry,
        deleteEntry: mockDeleteEntry
    })
}));

vi.mock('../../hooks/useTasks.ts', () => ({
    useTasks: () => ({
        tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Test Task' }],
        activeTasks: [{ id: 'task-1', projectId: 'project-1', title: 'Test Task' }]
    })
}));

describe('Time Overlap Detection', () => {

    const toastContextValue = {
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showWarning: vi.fn(),
        showInfo: vi.fn()
    };

    const mockTask = {
        id: 'task-1',
        projectId: 'project-1',
        title: 'Test Task'
    };

    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        task: mockTask
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('prevents creating an overlapping time entry', async () => {

        render(
            <ToastContext.Provider value={toastContextValue}>
                <TimeEntriesModal {...defaultProps} />
            </ToastContext.Provider>
        );

        // Click the Add Entry button to show the form
        const addButton = screen.getByText('Add Entry');
        fireEvent.click(addButton);

        // Wait for form to appear
        await waitFor(() => {
            expect(screen.getByLabelText('Start time')).toBeInTheDocument();
        });

        // Fill in overlapping times (10:30 - 10:45 overlaps with existing 10:00 - 11:00)
        fireEvent.change(screen.getByLabelText('Time spent'), { target: { value: '15m' } });
        fireEvent.change(screen.getByLabelText('Date started'), { target: { value: '2026-01-19' } });

        const startTimeInput = screen.getByLabelText('Start time');
        fireEvent.click(startTimeInput);

        const timeInputs = screen.getAllByRole('spinbutton');
        fireEvent.change(timeInputs[0], { target: { value: '10' } });
        fireEvent.change(timeInputs[1], { target: { value: '30' } });

        // Submit the form - the second "Add Entry" button submits the form
        const saveButtons = screen.getAllByText('Add Entry');
        fireEvent.click(saveButtons[1]); // The form submit button

        // Should show error toast and NOT call createEntry
        await waitFor(() => {
            expect(toastContextValue.showError).toHaveBeenCalled();
        });

        expect(mockCreateEntry).not.toHaveBeenCalled();
    });
});
