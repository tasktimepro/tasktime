import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TimePicker } from './time-picker';

describe('TimePicker', () => {
    it.each([0, 1, 2])('preserves an untouched time field %s when focus moves away', (index) => {
        const onChange = vi.fn();
        render(<TimePicker aria-label="Start time" value="23:49:45" onChange={onChange} />);
        fireEvent.click(screen.getByLabelText('Start time'));
        const field = screen.getAllByRole('spinbutton')[index];
        fireEvent.focus(field);
        fireEvent.blur(field);
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Start time')).toHaveValue('23:49:45');
    });

    it('resets only an explicitly cleared field to zero on blur', () => {
        const onChange = vi.fn();
        render(<TimePicker aria-label="Start time" value="23:49:45" onChange={onChange} />);
        fireEvent.click(screen.getByLabelText('Start time'));
        const field = screen.getAllByRole('spinbutton')[1];
        fireEvent.change(field, { target: { value: '' } });
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.blur(field);
        expect(onChange).toHaveBeenCalledWith({ target: { value: '23:00:45' } });
    });

    it('supports keyboard editing with minute precision and clamps fields to their limits', () => {
        const onChange = vi.fn();
        render(<TimePicker aria-label="Start time" value="09:30" onChange={onChange} showSeconds={false} />);
        const input = screen.getByLabelText('Start time');
        fireEvent.keyDown(input, { key: 'Enter' });
        const [hours, minutes] = screen.getAllByRole('spinbutton');
        fireEvent.change(hours, { target: { value: '99' } });
        fireEvent.blur(hours);
        expect(input).toHaveValue('23:30');
        fireEvent.change(minutes, { target: { value: '-1' } });
        fireEvent.blur(minutes);
        expect(onChange).toHaveBeenLastCalledWith({ target: { value: '23:00' } });
        fireEvent.keyDown(input, { key: ' ' });
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('handles an empty value, outside clicks and a disabled picker', () => {
        const { rerender } = render(<TimePicker aria-label="Start time" value="" />);
        const input = screen.getByLabelText('Start time');
        expect(input).toHaveValue('00:00:00');
        fireEvent.click(input);
        fireEvent.change(screen.getAllByRole('spinbutton')[2], { target: { value: '5' } });
        expect(input).toHaveValue('00:00:05');
        fireEvent.mouseDown(input);
        expect(screen.getAllByRole('spinbutton')).toHaveLength(3);
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
        rerender(<TimePicker aria-label="Start time" value="12:30:00" disabled />);
        expect(input).toHaveValue('12:30:00');
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('uses numeric keyboard hints for editable time fields on mobile', () => {
        render(<TimePicker aria-label="Start time" value="09:30:00" onChange={vi.fn()} showSeconds={false} />);

        fireEvent.click(screen.getByLabelText('Start time'));

        const [hoursInput, minuteInput] = screen.getAllByRole('spinbutton');

        expect(hoursInput).toHaveAttribute('inputmode', 'numeric');
        expect(hoursInput).toHaveAttribute('pattern', '[0-9]*');
        expect(hoursInput).toHaveAttribute('enterkeyhint', 'done');
        expect(hoursInput).toHaveAttribute('autocomplete', 'off');
        expect(minuteInput).toHaveAttribute('inputmode', 'numeric');
        expect(minuteInput).toHaveAttribute('pattern', '[0-9]*');
        expect(minuteInput).toHaveAttribute('enterkeyhint', 'done');
        expect(minuteInput).toHaveAttribute('autocomplete', 'off');
    });
});
