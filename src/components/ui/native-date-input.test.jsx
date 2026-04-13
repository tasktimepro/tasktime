import { fireEvent, render, screen } from '@testing-library/react';

import { NativeDateInput } from './native-date-input';

describe('NativeDateInput', () => {
    it('opens the native picker through showPicker when available', () => {
        const showPicker = vi.fn();

        render(<NativeDateInput aria-label="Expense date" value="2026-04-13" onChange={() => {}} />);

        const input = screen.getByLabelText('Expense date');
        input.showPicker = showPicker;

        fireEvent.click(screen.getByRole('button', { name: 'Open date picker' }));

        expect(showPicker).toHaveBeenCalledTimes(1);
    });

    it('falls back to focus and click when showPicker is unavailable', () => {
        render(<NativeDateInput aria-label="Expense date" value="2026-04-13" onChange={() => {}} />);

        const input = screen.getByLabelText('Expense date');
        const focusSpy = vi.spyOn(input, 'focus');
        const clickSpy = vi.spyOn(input, 'click');

        fireEvent.click(screen.getByRole('button', { name: 'Open date picker' }));

        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });
});