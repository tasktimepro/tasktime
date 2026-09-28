/**
 * RecurringPicker - Shared task and expense repeat schedule picker
 */

import { useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, parseISO } from 'date-fns';
import { ArrowPathIcon, CalendarDaysIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatRecurringLabel } from '@/utils/recurringUtils.ts';
import { cn } from '@/lib/utils';

const WEEKDAY_OPTIONS = [
    { label: 'Mo', value: 1 },
    { label: 'Tu', value: 2 },
    { label: 'We', value: 3 },
    { label: 'Th', value: 4 },
    { label: 'Fr', value: 5 },
    { label: 'Sa', value: 6 },
    { label: 'Su', value: 0 }
];

const DEFAULT_ALLOWED_TYPES = ['weekly', 'monthly', 'yearly'];
const YEARLY_BASE_YEAR = 2023;
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const getMaxDayForMonth = (month) => {
    const safeMonth = Math.min(12, Math.max(1, Number(month) || 1));
    return endOfMonth(new Date(YEARLY_BASE_YEAR, safeMonth - 1, 1)).getDate();
};

const toYearlyDate = (month, day) => {
    const safeMonth = Math.min(12, Math.max(1, Number(month) || 1));
    const maxDay = getMaxDayForMonth(safeMonth);
    const safeDay = Math.min(maxDay, Math.max(1, Number(day) || 1));
    return format(new Date(YEARLY_BASE_YEAR, safeMonth - 1, safeDay), 'yyyy-MM-dd');
};

const getYearlyParts = (yearlyDate) => {
    if (!yearlyDate) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const maxDay = getMaxDayForMonth(month);
        const day = Math.min(maxDay, now.getDate());
        return { month, day };
    }

    const parsed = parseISO(yearlyDate);
    if (Number.isNaN(parsed.getTime())) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const maxDay = getMaxDayForMonth(month);
        const day = Math.min(maxDay, now.getDate());
        return { month, day };
    }

    const month = parsed.getMonth() + 1;
    const maxDay = getMaxDayForMonth(month);
    const day = Math.min(maxDay, parsed.getDate());
    return { month, day };
};

const getDefaultConfig = (allowedTypes, monthlyMode) => {
    const types = Array.isArray(allowedTypes) && allowedTypes.length > 0
        ? allowedTypes
        : DEFAULT_ALLOWED_TYPES;
    const initialType = types[0];

    if (initialType === 'monthly') {
        return {
            type: 'monthly',
            monthlyType: monthlyMode === 'specific-only' ? 'specific' : 'first',
            monthlyDay: 1
        };
    }

    if (initialType === 'yearly') {
        const { month, day } = getYearlyParts(null);
        return {
            type: 'yearly',
            yearlyDate: toYearlyDate(month, day)
        };
    }

    return {
        type: 'weekly',
        weeklyDays: [1]
    };
};

/**
 * @param {Object} props
 * @param {Object|null} props.value
 * @param {(config: Object) => void} props.onChange
 * @param {() => void} props.onClear
 * @param {boolean} [props.disabled]
 * @param {string} [props.buttonClassName]
 * @param {'outline' | 'ghost' | 'secondary'} [props.inactiveVariant]
 * @param {string} [props.inactiveClassName]
 * @param {Array<'weekly' | 'monthly' | 'yearly'>} [props.allowedTypes]
 * @param {'full' | 'specific-only'} [props.monthlyMode]
 */
const RecurringPicker = ({
    value,
    onChange,
    onClear,
    disabled = false,
    buttonClassName = '',
    inactiveVariant = 'outline',
    inactiveClassName = '',
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    monthlyMode = 'full'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [draftConfig, setDraftConfig] = useState(() => (
        value && allowedTypes.includes(value.type)
            ? value
            : getDefaultConfig(allowedTypes, monthlyMode)
    ));
    const [yearlyDayInput, setYearlyDayInput] = useState(() => String(getYearlyParts(value?.yearlyDate).day));

    useEffect(() => {
        if (!isOpen) {
            const nextConfig = value && allowedTypes.includes(value.type)
                ? value
                : getDefaultConfig(allowedTypes, monthlyMode);
            setDraftConfig(nextConfig);
            setYearlyDayInput(String(getYearlyParts(nextConfig.yearlyDate).day));
        }
    }, [isOpen, value, allowedTypes, monthlyMode]);

    const yearlyMonth = getYearlyParts(draftConfig.yearlyDate).month;
    const yearlyDay = Number(yearlyDayInput);
    const isYearlyDayValid = /^\d{1,2}$/.test(yearlyDayInput)
        && yearlyDay >= 1
        && yearlyDay <= getMaxDayForMonth(yearlyMonth);

    const displayLabel = useMemo(() => {
        return value ? formatRecurringLabel(value) : 'Set repeat';
    }, [value]);

    const handleToggleDay = (dayValue) => {
        setDraftConfig((prev) => {
            if (prev.type !== 'weekly') {
                return prev;
            }

            const current = prev.weeklyDays || [];
            const exists = current.includes(dayValue);
            const nextDays = exists
                ? current.filter((d) => d !== dayValue)
                : [...current, dayValue];

            return {
                ...prev,
                weeklyDays: nextDays.length > 0 ? nextDays : [dayValue]
            };
        });
    };

    const handleApply = () => {
        onChange(draftConfig);
        setIsOpen(false);
    };

    const handleClear = () => {
        onClear();
        setIsOpen(false);
    };

    const handleTypeChange = (nextType) => {
        if (nextType === 'yearly') {
            setYearlyDayInput(String(getYearlyParts(draftConfig.yearlyDate).day));
        }

        setDraftConfig((prev) => {
            if (nextType === 'weekly') {
                return {
                    type: 'weekly',
                    weeklyDays: prev.weeklyDays?.length ? prev.weeklyDays : [1]
                };
            }

            if (nextType === 'yearly') {
                const { month, day } = getYearlyParts(prev.yearlyDate);
                return {
                    type: 'yearly',
                    yearlyDate: toYearlyDate(month, day)
                };
            }

            return {
                type: 'monthly',
                monthlyType: monthlyMode === 'specific-only'
                    ? 'specific'
                    : (prev.monthlyType || 'first'),
                monthlyDay: prev.monthlyDay || 1
            };
        });
    };

    const handleMonthlyTypeChange = (nextType) => {
        setDraftConfig((prev) => ({
            ...prev,
            type: 'monthly',
            monthlyType: monthlyMode === 'specific-only' ? 'specific' : nextType,
            monthlyDay: prev.monthlyDay || 1
        }));
    };

    const handleMonthlyDayChange = (event) => {
        const value = event.target.value;
        const day = value ? Math.min(28, Math.max(1, Number(value))) : null;

        setDraftConfig((prev) => ({
            ...prev,
            type: 'monthly',
            monthlyType: 'specific',
            monthlyDay: day
        }));
    };

    const handleYearlyMonthChange = (value) => {
        const month = Number(value);
        const previousDay = /^\d{1,2}$/.test(yearlyDayInput)
            ? Number(yearlyDayInput)
            : getYearlyParts(draftConfig.yearlyDate).day;
        const day = Math.min(getMaxDayForMonth(month), Math.max(1, previousDay));
        setDraftConfig((prev) => ({
            ...prev,
            type: 'yearly',
            yearlyDate: toYearlyDate(month, day)
        }));
        setYearlyDayInput(String(day));
    };

    const handleYearlyDayChange = (event) => {
        const input = event.target.value;
        setYearlyDayInput(input);

        const day = Number(input);
        if (/^\d{1,2}$/.test(input) && day >= 1 && day <= getMaxDayForMonth(yearlyMonth)) {
            setDraftConfig((prev) => ({
                ...prev,
                type: 'yearly',
                yearlyDate: toYearlyDate(yearlyMonth, day)
            }));
        }
    };

    const typeOptions = useMemo(() => {
        const options = [
            { type: 'weekly', label: 'Every Week' },
            { type: 'monthly', label: 'Every Month' },
            { type: 'yearly', label: 'Every Year' }
        ];
        return options.filter((option) => allowedTypes.includes(option.type));
    }, [allowedTypes]);

    return (
        <>
            <Button
                type="button"
                variant={value ? 'secondary' : inactiveVariant}
                className={cn(`h-9 overflow-hidden ${buttonClassName}`, !value && inactiveClassName)}
                onClick={() => setIsOpen(true)}
                disabled={disabled}
                title="Set repeat schedule"
                leadingIcon={ArrowPathIcon}
            >
                <span className="truncate text-center flex-1 min-w-0">
                    {displayLabel}
                </span>
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarDaysIcon className="h-5 w-5" />
                            Repeat
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {typeOptions.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                                {typeOptions.map((option) => (
                                    <Button
                                        key={option.type}
                                        type="button"
                                        variant={draftConfig.type === option.type ? 'secondary' : inactiveVariant}
                                        className={cn(typeOptions.length % 2 === 1 && option === typeOptions.at(-1) && 'col-span-2')}
                                        aria-pressed={draftConfig.type === option.type}
                                        onClick={() => handleTypeChange(option.type)}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        )}

                        {draftConfig.type === 'weekly' && (
                            <div className="grid grid-cols-7 gap-2">
                                {WEEKDAY_OPTIONS.map((option) => {
                                    const isSelected = draftConfig.weeklyDays?.includes(option.value);

                                    return (
                                        <Button
                                            key={option.value}
                                            type="button"
                                            variant={isSelected ? 'secondary' : inactiveVariant}
                                            className="h-8 w-full p-0"
                                            onClick={() => handleToggleDay(option.value)}
                                        >
                                            {option.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}

                        {draftConfig.type === 'monthly' && (
                            <div className="space-y-3">
                                {monthlyMode !== 'specific-only' && (
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            type="button"
                                            variant={draftConfig.monthlyType === 'first' ? 'secondary' : inactiveVariant}
                                            onClick={() => handleMonthlyTypeChange('first')}
                                        >
                                            First day of month
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={draftConfig.monthlyType === 'last' ? 'secondary' : inactiveVariant}
                                            onClick={() => handleMonthlyTypeChange('last')}
                                        >
                                            Last day of month
                                        </Button>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {monthlyMode !== 'specific-only' && (
                                        <Button
                                            type="button"
                                            variant={draftConfig.monthlyType === 'specific' ? 'secondary' : inactiveVariant}
                                            className="w-full"
                                            onClick={() => handleMonthlyTypeChange('specific')}
                                        >
                                            On day
                                        </Button>
                                    )}
                                    {(monthlyMode === 'specific-only' || draftConfig.monthlyType === 'specific') && (
                                        <Input
                                            type="number"
                                            min={1}
                                            max={28}
                                            placeholder="Day (1-28)"
                                            value={draftConfig.monthlyDay ?? ''}
                                            onChange={handleMonthlyDayChange}
                                        />
                                    )}
                                    {(monthlyMode === 'specific-only' || draftConfig.monthlyType === 'specific') && (
                                        <p className="text-xs text-muted-foreground">
                                            Days 29-31 are not available to ensure consistency across all months.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {draftConfig.type === 'yearly' && (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">Month</div>
                                    <div role="group" aria-label="Yearly month" className="grid grid-cols-4 gap-2">
                                        {MONTH_NAMES.map((name, index) => (
                                            <Button
                                                key={name}
                                                type="button"
                                                variant={yearlyMonth === index + 1 ? 'secondary' : 'outline'}
                                                className="h-9 px-2"
                                                aria-label={name}
                                                aria-pressed={yearlyMonth === index + 1}
                                                onClick={() => handleYearlyMonthChange(index + 1)}
                                            >
                                                {name.slice(0, 3)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">Day</div>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={getMaxDayForMonth(yearlyMonth)}
                                        step={1}
                                        inputMode="numeric"
                                        aria-label="Yearly day"
                                        aria-invalid={!isYearlyDayValid}
                                        value={yearlyDayInput}
                                        onChange={handleYearlyDayChange}
                                    />
                                    {!isYearlyDayValid && (
                                        <p className="text-xs text-destructive-strong" role="alert">
                                            Enter a day from 1 to {getMaxDayForMonth(yearlyMonth)}.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleClear}
                            >
                                Clear
                            </Button>
                            <Button
                                type="button"
                                onClick={handleApply}
                                disabled={draftConfig.type === 'yearly' && !isYearlyDayValid}
                            >
                                Apply
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default RecurringPicker;
