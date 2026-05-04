import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDaysIcon, CheckIcon, ChevronDownIcon } from '@/components/ui/icons';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { cn } from '@/lib/utils';

function PeriodRangePicker({
    value,
    onValueChange,
    options,
    customStart,
    customEnd,
    onCustomStartChange,
    onCustomEndChange,
    placeholder = 'Period',
    triggerClassName,
    panelClassName,
    className,
    ariaLabel = 'Period',
    contentAlign = 'start',
}) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef(null);

    const selectedOption = useMemo(() => {
        return options.find((option) => option.value === value) || null;
    }, [options, value]);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            const target = event.target;

            if (rootRef.current?.contains(target)) {
                return;
            }

            setIsOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [isOpen]);

    const handleValueChange = (nextValue) => {
        onValueChange(nextValue);
        setIsOpen(nextValue === 'custom');
    };

    const handleTriggerClick = () => {
        setIsOpen((currentOpen) => !currentOpen);
    };

    return (
        <div ref={rootRef} className={cn('relative inline-flex max-w-full', className)}>
            <button
                type="button"
                className={cn(
                    'inline-flex h-9 max-w-full w-auto items-center gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-0 focus:border-ring',
                    triggerClassName
                )}
                aria-label={ariaLabel}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                onClick={handleTriggerClick}
            >
                <CalendarDaysIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedOption?.label || placeholder}</span>
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            {isOpen && (
                <div
                    className={cn(
                        'absolute top-full z-50 mt-2 min-w-full w-max max-w-[calc(100vw-2rem)] rounded-md border bg-card p-1 text-card-foreground shadow-md',
                        contentAlign === 'end' ? 'right-0' : 'left-0',
                        panelClassName
                    )}
                    role="dialog"
                    aria-label={`${ariaLabel} options`}
                >
                    <div className="space-y-1">
                        {options.map((option) => {
                            const isSelected = option.value === value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    className="relative flex w-full items-center rounded-sm py-1.5 pl-8 pr-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                                    onClick={() => handleValueChange(option.value)}
                                >
                                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                        {isSelected && <CheckIcon className="h-4 w-4" />}
                                    </span>
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>

                    {value === 'custom' && (
                        <>
                            <div className="-mx-1 my-1 h-px bg-muted" />
                            <div className="space-y-3 p-2">
                                <label className="block space-y-1">
                                    <span className="text-xs font-medium text-muted-foreground">From</span>
                                    <NativeDateInput
                                        value={customStart}
                                        onChange={(event) => onCustomStartChange(event.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    />
                                </label>
                                <label className="block space-y-1">
                                    <span className="text-xs font-medium text-muted-foreground">To</span>
                                    <NativeDateInput
                                        value={customEnd}
                                        onChange={(event) => onCustomEndChange(event.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    />
                                </label>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default PeriodRangePicker;