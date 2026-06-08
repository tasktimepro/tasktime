import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TimePicker } from './time-picker';

describe('TimePicker', () => {
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
