import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { vi } from 'vitest';
import PeriodRangePicker from '@/components/ui/period-range-picker';

describe('PeriodRangePicker', () => {
    it('sizes the trigger to content and closes the custom overlay on outside click', async () => {
        render(
            <StrictMode>
                <div>
                    <button type="button">Outside</button>
                    <PeriodRangePicker
                        value="custom"
                        onValueChange={() => {}}
                        options={[
                            { value: 'month', label: 'This Month' },
                            { value: 'custom', label: 'Custom Range' },
                        ]}
                        customStart="2026-04-01"
                        customEnd="2026-04-30"
                        onCustomStartChange={() => {}}
                        onCustomEndChange={() => {}}
                        ariaLabel="Test period"
                    />
                </div>
            </StrictMode>
        );

        const trigger = screen.getByRole('button', { name: 'Test period' });
        expect(trigger.className).toContain('w-auto');
        expect(trigger.className).toContain('max-w-full');

        fireEvent.click(trigger);

        const selectedOption = screen.getByRole('button', { name: 'Custom Range' });
        expect(selectedOption.querySelector('.lucide-check')).not.toBeNull();

        const fromLabel = screen.getByText('From').closest('label');
        const toLabel = screen.getByText('To').closest('label');
        const inputsStack = fromLabel.parentElement;

        expect(inputsStack.className).toContain('space-y-3');
        expect(fromLabel).toContainElement(screen.getByDisplayValue('2026-04-01'));
        expect(toLabel).toContainElement(screen.getByDisplayValue('2026-04-30'));

        fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
        fireEvent.click(screen.getByRole('button', { name: 'Outside' }));

        await waitFor(() => {
            expect(screen.queryByText('From')).not.toBeInTheDocument();
        });
    });

    it('forwards custom date input changes', () => {
        const onCustomStartChange = vi.fn();
        const onCustomEndChange = vi.fn();

        render(
            <PeriodRangePicker
                value="custom"
                onValueChange={() => {}}
                options={[
                    { value: 'month', label: 'This Month' },
                    { value: 'custom', label: 'Custom Range' },
                ]}
                customStart="2026-04-01"
                customEnd="2026-04-30"
                onCustomStartChange={onCustomStartChange}
                onCustomEndChange={onCustomEndChange}
                ariaLabel="Test period"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Test period' }));
        fireEvent.change(screen.getByDisplayValue('2026-04-01'), { target: { value: '2026-04-05' } });
        fireEvent.change(screen.getByDisplayValue('2026-04-30'), { target: { value: '2026-04-25' } });

        expect(onCustomStartChange).toHaveBeenCalledWith('2026-04-05');
        expect(onCustomEndChange).toHaveBeenCalledWith('2026-04-25');
    });

    it('can remove the trigger from tab order for modal header actions', () => {
        render(
            <PeriodRangePicker
                value="month"
                onValueChange={() => {}}
                options={[{ value: 'month', label: 'This Month' }]}
                customStart=""
                customEnd=""
                onCustomStartChange={() => {}}
                onCustomEndChange={() => {}}
                ariaLabel="Invoice billing period"
                triggerTabIndex={-1}
            />
        );

        expect(screen.getByRole('button', { name: 'Invoice billing period' })).toHaveAttribute('tabindex', '-1');
    });
});