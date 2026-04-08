/**
 * WeeklyGoalModal - Modal for setting weekly goals
 */

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWeeklyGoals } from '@/hooks/useWeeklyGoals';
import { usePreferences } from '@/hooks/usePreferences';
import { getCurrencySymbol, normalizeCurrencyCode } from '@/utils/currencyUtils';
import { ClockIcon } from '@/components/ui/icons';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 */
const WeeklyGoalModal = ({ isOpen, onClose }) => {
    const { weeklyGoals, setWeeklyGoals, clearWeeklyGoals } = useWeeklyGoals();
    const { preferences } = usePreferences();

    const [targetHours, setTargetHours] = useState('');
    const [targetEarnings, setTargetEarnings] = useState('');

    const currencyCode = normalizeCurrencyCode(preferences.currency);
    const currencySymbol = getCurrencySymbol(currencyCode);

    useEffect(() => {
        if (!isOpen) return;

        setTargetHours(weeklyGoals.targetHours !== null && weeklyGoals.targetHours !== undefined
            ? String(weeklyGoals.targetHours)
            : ''
        );
        setTargetEarnings(weeklyGoals.targetEarnings !== null && weeklyGoals.targetEarnings !== undefined
            ? String(weeklyGoals.targetEarnings)
            : ''
        );
    }, [isOpen, weeklyGoals]);

    const handleSave = () => {
        const hoursValue = targetHours === '' ? null : Number(targetHours);
        const earningsValue = targetEarnings === '' ? null : Number(targetEarnings);
        const hasHours = targetHours !== '';
        const hasEarnings = targetEarnings !== '';

        if (!hasHours && !hasEarnings) {
            clearWeeklyGoals();
            onClose();
            return;
        }

        const safeHours = Number.isFinite(hoursValue)
            ? Math.min(Math.max(hoursValue, 0.5), 168)
            : null;

        setWeeklyGoals({
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
                        Weekly goals
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <Label htmlFor="weekly-goal-hours">
                            Target working hours
                        </Label>
                        <div className="relative">
                            <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="weekly-goal-hours"
                                type="number"
                                min="0.5"
                                max="168"
                                step="0.5"
                                placeholder="e.g., 40"
                                value={targetHours}
                                onChange={(e) => {
                                    if (e.target.value === '') {
                                        setTargetHours('');
                                        return;
                                    }

                                    const parsed = Number(e.target.value);
                                    if (!Number.isFinite(parsed)) return;

                                    const clamped = Math.min(Math.max(parsed, 0.5), 168);
                                    setTargetHours(String(clamped));
                                }}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="weekly-goal-earnings">Target earnings</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                {currencySymbol}
                            </span>
                            <Input
                                id="weekly-goal-earnings"
                                type="number"
                                min="0"
                                step="1"
                                placeholder="e.g., 2500"
                                value={targetEarnings}
                                onChange={(e) => setTargetEarnings(e.target.value)}
                                className="pl-7"
                            />
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        These goals apply every week.
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

export default WeeklyGoalModal;
