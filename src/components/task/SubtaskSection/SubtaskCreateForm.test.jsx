import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SubtaskCreateForm from './SubtaskCreateForm';

const hookState = vi.hoisted(() => ({
    isMobileLayout: false,
}));

vi.mock('../../../hooks/useIsMobileLayout', () => ({
    default: () => hookState.isMobileLayout,
}));

const defaultProps = {
    newSubtaskTitle: '',
    setNewSubtaskTitle: vi.fn(),
    newSubtaskNote: '',
    setNewSubtaskNote: vi.fn(),
    newSubtaskStartDate: '',
    setNewSubtaskStartDate: vi.fn(),
    onCreateSubtask: vi.fn((event) => event.preventDefault()),
    onCancel: vi.fn(),
    isDisabled: false,
};

describe('SubtaskCreateForm', () => {
    it('uses the stacked task-style layout on mobile', () => {
        hookState.isMobileLayout = true;

        const { container } = render(<SubtaskCreateForm {...defaultProps} />);

        const form = screen.getByTestId('subtask-create-form');
        const formBody = form.firstElementChild;
        const dateInput = container.querySelector('input[type="date"]');
        const actions = screen.getByRole('button', { name: 'Add' }).parentElement;

        expect(form.className.includes('rounded-lg')).toBe(true);
        expect(form.className.includes('bg-card')).toBe(true);
        expect(form.className.includes('p-3')).toBe(true);
        expect(formBody?.className.includes('space-y-3')).toBe(true);
        expect(formBody?.className.includes('flex')).toBe(false);
        expect(dateInput?.className.includes('w-full')).toBe(true);
        expect(actions?.className.includes('justify-end')).toBe(true);

        hookState.isMobileLayout = false;
    });

    it('keeps the inline desktop layout off mobile', () => {
        hookState.isMobileLayout = false;

        const { container } = render(<SubtaskCreateForm {...defaultProps} />);

        const form = screen.getByTestId('subtask-create-form');
        const formBody = form.firstElementChild;
        const titleInput = screen.getByPlaceholderText('Enter subtask title');
        const noteInput = screen.getByPlaceholderText('Note');
        const dateInput = container.querySelector('input[type="date"]');
        const actions = screen.getByRole('button', { name: 'Add' }).parentElement;

        expect(form.className.includes('rounded-lg')).toBe(false);
        expect(formBody?.className.includes('flex')).toBe(true);
        expect(formBody?.className.includes('items-center')).toBe(true);
        expect(titleInput.className.includes('flex-1')).toBe(true);
        expect(noteInput.className.includes('flex-1')).toBe(true);
        expect(dateInput?.className.includes('w-40')).toBe(true);
        expect(actions?.className.includes('justify-end')).toBe(false);
    });
});