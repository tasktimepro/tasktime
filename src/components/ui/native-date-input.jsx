import * as React from 'react';

import { CalendarDaysIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils.ts';

const NativeDateInput = React.forwardRef(({ className, disabled = false, ...props }, forwardedRef) => {
    const inputRef = React.useRef(null);

    React.useImperativeHandle(forwardedRef, () => inputRef.current);

    const openPicker = React.useCallback(() => {
        const input = inputRef.current;

        if (!input || disabled) {
            return;
        }

        if (typeof input.showPicker === 'function') {
            input.showPicker();
            return;
        }

        input.focus();
        input.click();
    }, [disabled]);

    const handleMouseDown = React.useCallback((event) => {
        event.preventDefault();
    }, []);

    return (
        <div className="relative">
            <Input
                {...props}
                ref={inputRef}
                type="date"
                disabled={disabled}
                className={cn('pr-10 native-date-input-field', className)}
            />
            <button
                type="button"
                aria-label="Open date picker"
                className={cn(
                    'absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors',
                    disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-foreground'
                )}
                onMouseDown={handleMouseDown}
                onClick={openPicker}
                disabled={disabled}
                tabIndex={disabled ? -1 : 0}
            >
                <CalendarDaysIcon className="h-4 w-4" />
            </button>
        </div>
    );
});

NativeDateInput.displayName = 'NativeDateInput';

export { NativeDateInput };