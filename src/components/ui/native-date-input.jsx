import * as React from 'react';

import { CalendarDaysIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils.ts';

const NativeDateInput = React.forwardRef(({ className, disabled = false, ...props }, forwardedRef) => {
    return (
        <div className="relative">
            <Input
                {...props}
                ref={forwardedRef}
                type="date"
                disabled={disabled}
                className={cn('native-date-input-field pr-10', className)}
            />
            <span
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground',
                    disabled && 'opacity-50'
                )}
            >
                <CalendarDaysIcon className="h-4 w-4" />
            </span>
        </div>
    );
});

NativeDateInput.displayName = 'NativeDateInput';

export { NativeDateInput };