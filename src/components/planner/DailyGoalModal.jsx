/**
 * DailyGoalModal - Modal for setting weekday-based goals
 */

import { useMemo, useState } from 'react';
import { getDay } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDailyGoals } from '@/hooks/useDailyGoals';
import { usePreferences } from '@/hooks/usePreferences';
import { getCurrencySymbol, normalizeCurrencyCode } from '@/utils/currencyUtils';
import { ClockIcon } from '@/components/ui/icons';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const createInitialGoalValues = (goal) => ({
    targetHours: goal?.targetHours ? String(goal.targetHours) : '',
    targetEarnings: goal?.targetEarnings ? String(goal.targetEarnings) : ''
});

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.dateStr - ISO date string (YYYY-MM-DD)
 */
const DailyGoalModal = ({ isOpen, onClose, dateStr }) => {
    const { setGoal, removeGoal, getGoalForDate } = useDailyGoals();
    const { preferences } = usePreferences();

    const weekday = useMemo(() => {
        if (!dateStr) return 0;
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return getDay(date);
    }, [dateStr]);

    const weekdayName = WEEKDAY_NAMES[weekday];
    const weekdayNamePlural = `${weekdayName}s`;

    const goal = useMemo(() => getGoalForDate(dateStr), [getGoalForDate, dateStr]);
    const [{ targetHours, targetEarnings }, setGoalValues] = useState(() => createInitialGoalValues(goal));

    const currencyCode = normalizeCurrencyCode(preferences.currency);
    const currencySymbol = getCurrencySymbol(currencyCode);

    const handleSave = () => {
        const hoursValue = targetHours === '' ? null : Number(targetHours);
        const earningsValue = targetEarnings === '' ? null : Number(targetEarnings);
        const hasHours = targetHours !== '';
        const hasEarnings = targetEarnings !== '';

        if (!hasHours && !hasEarnings) {
            removeGoal(weekday);
            onClose();
            return;
        }

        const safeHours = Number.isFinite(hoursValue)
            ? Math.min(Math.max(hoursValue, 0.5), 24)
            : null;

        setGoal(weekday, {
            targetHours: safeHours,
            targetEarnings: Number.isFinite(earningsValue) ? earningsValue : null,
        });
        onClose();
    };


    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Daily goals for {weekdayNamePlural}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <Label htmlFor="daily-goal-hours">Target working hours</Label>
                        <div className="relative">
                            <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="daily-goal-hours"
                                type="number"
                                min="0.5"
                                max="24"
                                step="0.5"
                                placeholder="e.g., 8"
                                value={targetHours}
                                onChange={(e) => {
                                    if (e.target.value === '') {
                                        setGoalValues((prev) => ({ ...prev, targetHours: '' }));
                                        return;
                                    }

                                    const parsed = Number(e.target.value);
                                    if (!Number.isFinite(parsed)) return;

                                    const clamped = Math.min(Math.max(parsed, 0.5), 24);
                                    setGoalValues((prev) => ({ ...prev, targetHours: String(clamped) }));
                                }}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="daily-goal-earnings">Target earnings</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                {currencySymbol}
                            </span>
                            <Input
                                id="daily-goal-earnings"
                                type="number"
                                min="0"
                                step="1"
                                placeholder="e.g., 500"
                                value={targetEarnings}
                                onChange={(e) => setGoalValues((prev) => ({ ...prev, targetEarnings: e.target.value }))}
                                className="pl-7"
                            />
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        These goals apply every {weekdayName}.
                    </p>

                    <div className="flex items-center gap-2 pt-2">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button className="flex-1" onClick={handleSave}>
                            Save goals
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DailyGoalModal;
