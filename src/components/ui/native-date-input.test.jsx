import { fireEvent, render, screen } from '@testing-library/react';

import { NativeDateInput } from './native-date-input';

describe('NativeDateInput', () => {
    it('renders as a plain date input without a separate picker button', () => {
        render(<NativeDateInput aria-label="Expense date" value="2026-04-13" onChange={() => {}} />);

        const input = screen.getByLabelText('Expense date');

        expect(input.type).toBe('date');
        expect(screen.queryByRole('button', { name: 'Open date picker' })).toBeNull();
    });

    it('forwards change events through the native input', () => {
        const handleChange = vi.fn();

        render(<NativeDateInput aria-label="Expense date" value="2026-04-13" onChange={handleChange} />);

        const input = screen.getByLabelText('Expense date');

        fireEvent.change(input, { target: { value: '2026-04-20' } });

        expect(handleChange).toHaveBeenCalledTimes(1);
    });
});