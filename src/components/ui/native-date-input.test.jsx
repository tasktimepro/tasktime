import { fireEvent, render, screen } from '@testing-library/react';

import { NativeDateInput } from './native-date-input';

describe('NativeDateInput', () => {
    it('renders a custom picker trigger alongside the native date input', () => {
        render(<NativeDateInput aria-label="Expense date" value="2026-04-13" onChange={() => {}} />);

        const input = screen.getByLabelText('Expense date');

        expect(input.type).toBe('date');
        expect(screen.getByRole('button', { name: 'Open date picker' })).toBeDefined();
    });

    it('forwards change events through the native input', () => {
        const handleChange = vi.fn();

        render(<NativeDateInput aria-label="Expense date" value="2026-04-13" onChange={handleChange} />);

        const input = screen.getByLabelText('Expense date');

        fireEvent.change(input, { target: { value: '2026-04-20' } });

        expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('opens the native picker when the custom icon is clicked', () => {
        render(<NativeDateInput aria-label="Expense date" value="2026-04-13" onChange={() => {}} />);

        const input = screen.getByLabelText('Expense date');
        const openPickerButton = screen.getByRole('button', { name: 'Open date picker' });
        const showPicker = vi.fn();

        input.showPicker = showPicker;

        fireEvent.click(openPickerButton);

        expect(showPicker).toHaveBeenCalledTimes(1);
    });
});