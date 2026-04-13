import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './input';
import { Textarea } from './textarea';
import { TimePicker } from './time-picker';

describe('mobile form font size', () => {
    it('keeps shared text inputs at text-base on mobile', () => {
        render(<Input aria-label="Title" />);

        const input = screen.getByLabelText('Title');

        expect(input.className.includes('text-base')).toBe(true);
        expect(input.className.includes('md:text-sm')).toBe(true);
    });

    it('keeps shared textareas at text-base on mobile', () => {
        render(<Textarea aria-label="Note" />);

        const textarea = screen.getByLabelText('Note');

        expect(textarea.className.includes('text-base')).toBe(true);
        expect(textarea.className.includes('md:text-sm')).toBe(true);
    });

    it('keeps time picker inputs at text-base on mobile', () => {
        render(<TimePicker aria-label="Start time" value="09:30:00" onChange={() => {}} />);

        const input = screen.getByLabelText('Start time');

        expect(input.className.includes('text-base')).toBe(true);
        expect(input.className.includes('md:text-sm')).toBe(true);
    });
});