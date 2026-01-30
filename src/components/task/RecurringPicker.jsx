/**
 * RecurringPicker - Popup for selecting recurring task patterns
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, CalendarDaysIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatRecurringLabel } from '@/utils/recurringUtils.ts';

const WEEKDAY_OPTIONS = [
    { label: 'Mo', value: 1 },
    { label: 'Tu', value: 2 },
    { label: 'We', value: 3 },
    { label: 'Th', value: 4 },
    { label: 'Fr', value: 5 },
    { label: 'Sa', value: 6 },
    { label: 'Su', value: 0 }
];

const DEFAULT_CONFIG = {
    type: 'weekly',
    weeklyDays: [1]
};

/**
 * @param {Object} props
 * @param {Object|null} props.value
 * @param {(config: Object) => void} props.onChange
 * @param {() => void} props.onClear
 * @param {boolean} [props.disabled]
 * @param {string} [props.buttonClassName]
 */
const RecurringPicker = ({
    value,
    onChange,
    onClear,
    disabled = false,
    buttonClassName = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [draftConfig, setDraftConfig] = useState(value || DEFAULT_CONFIG);

    useEffect(() => {
        if (!isOpen) {
            setDraftConfig(value || DEFAULT_CONFIG);
        }
    }, [isOpen, value]);

    const displayLabel = useMemo(() => {
        return value ? formatRecurringLabel(value) : 'Repeat';
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
        setDraftConfig((prev) => {
            if (nextType === 'weekly') {
                return {
                    type: 'weekly',
                    weeklyDays: prev.weeklyDays?.length ? prev.weeklyDays : [1]
                };
            }

            return {
                type: 'monthly',
                monthlyType: prev.monthlyType || 'first',
                monthlyDay: prev.monthlyDay || 1
            };
        });
    };

    const handleMonthlyTypeChange = (nextType) => {
        setDraftConfig((prev) => ({
            ...prev,
            type: 'monthly',
            monthlyType: nextType,
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

    return (
        <>
            <Button
                type="button"
                variant={value ? 'secondary' : 'outline'}
                className={`h-9 ${buttonClassName}`}
                onClick={() => setIsOpen(true)}
                disabled={disabled}
                title="Set recurring schedule"
                leadingIcon={ArrowPathIcon}
            >
                {displayLabel}
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarDaysIcon className="h-5 w-5" />
                            Repeat
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={draftConfig.type === 'weekly' ? 'secondary' : 'outline'}
                                className="flex-1"
                                onClick={() => handleTypeChange('weekly')}
                            >
                                Every Week
                            </Button>
                            <Button
                                type="button"
                                variant={draftConfig.type === 'monthly' ? 'secondary' : 'outline'}
                                className="flex-1"
                                onClick={() => handleTypeChange('monthly')}
                            >
                                Every Month
                            </Button>
                        </div>

                        {draftConfig.type === 'weekly' && (
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAY_OPTIONS.map((option) => {
                                    const isSelected = draftConfig.weeklyDays?.includes(option.value);

                                    return (
                                        <Button
                                            key={option.value}
                                            type="button"
                                            variant={isSelected ? 'secondary' : 'outline'}
                                            className="h-8 w-10 p-0"
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
                                <div className="flex flex-col gap-2">
                                    <Button
                                        type="button"
                                        variant={draftConfig.monthlyType === 'first' ? 'secondary' : 'outline'}
                                        onClick={() => handleMonthlyTypeChange('first')}
                                    >
                                        First day of month
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={draftConfig.monthlyType === 'last' ? 'secondary' : 'outline'}
                                        onClick={() => handleMonthlyTypeChange('last')}
                                    >
                                        Last day of month
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Button
                                        type="button"
                                        variant={draftConfig.monthlyType === 'specific' ? 'secondary' : 'outline'}
                                        className="w-full"
                                        onClick={() => handleMonthlyTypeChange('specific')}
                                    >
                                        On day
                                    </Button>
                                    {draftConfig.monthlyType === 'specific' && (
                                        <Input
                                            type="number"
                                            min={1}
                                            max={28}
                                            placeholder="Day (1-28)"
                                            value={draftConfig.monthlyDay ?? ''}
                                            onChange={handleMonthlyDayChange}
                                        />
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Days 29-31 are not available to ensure consistency across all months.
                                    </p>
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
