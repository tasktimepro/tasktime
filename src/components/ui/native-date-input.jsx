import * as React from 'react';

import { CalendarDaysIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils.ts';

const NativeDateInput = React.forwardRef(({ className, disabled = false, ...props }, forwardedRef) => {
    const inputRef = React.useRef(null);

    const setInputRef = React.useCallback(
        (node) => {
            inputRef.current = node;

            if (typeof forwardedRef === 'function') {
                forwardedRef(node);
                return;
            }

            if (forwardedRef) {
                forwardedRef.current = node;
            }
        },
        [forwardedRef]
    );

    const handleOpenPicker = React.useCallback(
        (event) => {
            event.preventDefault();

            if (disabled) {
                return;
            }

            const input = inputRef.current;

            if (!input) {
                return;
            }

            input.focus({ preventScroll: true });

            if (typeof input.showPicker === 'function') {
                input.showPicker();
                return;
            }

            input.click();
        },
        [disabled]
    );

    return (
        <div className="relative">
            <Input
                {...props}
                ref={setInputRef}
                type="date"
                disabled={disabled}
                className={cn('native-date-input-field pr-10', className)}
            />
            <button
                type="button"
                aria-label="Open date picker"
                disabled={disabled}
                onClick={handleOpenPicker}
                className={cn(
                    'absolute inset-y-0 right-3 flex items-center text-muted-foreground',
                    disabled && 'opacity-50'
                )}
            >
                <CalendarDaysIcon className="h-4 w-4" />
            </button>
        </div>
    );
});

NativeDateInput.displayName = 'NativeDateInput';

export { NativeDateInput };