/**
 * PlannerItem - Individual item card in the planner
 * 
 * Displays a client, project, or task with appropriate styling
 * Shows color tag as left border when color is set
 * Shows progress fill when estimated hours is set
 * Has dropdown menu for actions (remove, etc.)
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { 
    UserIcon, 
    DocumentTextIcon, 
    CheckIcon,
    PlayIcon,
    ArrowPathIcon,
    CalendarDaysIcon,
    HandCoinsIcon,
} from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, ExternalLink, SlidersHorizontal } from 'lucide-react';

/**
 * @param {Object} props
 * @param {'client' | 'project' | 'task' | 'expense'} props.type - Type of item
 * @param {string} props.title - Display title
 * @param {boolean} props.isCompleted - Whether item is completed (tasks only)
 * @param {boolean} props.isStatic - Whether item is pinned (static/weekday mode)
 * @param {'recurring' | 'due' | 'attached' | 'timer' | 'worked'} props.subtype - Task subtype (tasks only)
 * @param {string | null} props.color - Color tag (hex color)
 * @param {number | null} props.estimatedHours - Estimated hours for this item
 * @param {number} props.actualTimeMs - Actual time worked in milliseconds
 * @param {number | null} props.heightPercent - Height percentage (0-1) relative to column
 * @param {boolean} props.isTimerActive - Whether this item has an active timer (tasks only)
 * @param {number} props.amount - Expense amount (expenses only)
 * @param {'fixed' | 'variable'} props.amountType - Expense amount type
 * @param {string} props.currency - Expense currency
 * @param {string | null} props.supplierName - Expense supplier
 * @param {(amount?: number) => void} props.onMarkPaid - Expense quick action
 * @param {boolean} props.hasAttachment - Whether item has a planner attachment (can be removed)
 * @param {() => void} props.onClick - Click handler
 * @param {() => void} props.onEdit - Called when user wants to edit planner options
 * @param {() => void} props.onRemove - Called when user wants to remove from planner
 */
const PlannerItem = ({
    type,
    title,
    isCompleted = false,
    isStatic = false,
    subtype,
    color,
    estimatedHours,
    actualTimeMs = 0,
    heightPercent,
    isTimerActive = false,
    amount,
    amountType,
    currency,
    supplierName,
    onMarkPaid,
    hasAttachment = false,
    onClick,
    onEdit,
    onRemove,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const isExpense = type === 'expense';
    const needsAmount = isExpense && amountType === 'variable' && (!amount || amount <= 0);
    const [expenseAmount, setExpenseAmount] = useState(needsAmount ? '' : String(amount || ''));
    const [showAmountError, setShowAmountError] = useState(false);

    useEffect(() => {
        if (!needsAmount) {
            setExpenseAmount(String(amount || ''));
        }
    }, [amount, needsAmount]);

    // Icon based on type and subtype
    const getIcon = () => {
        if (type === 'task' && subtype === 'timer') {
            return PlayIcon;
        }
        if (type === 'task' && subtype === 'recurring') {
            return ArrowPathIcon;
        }
        if (type === 'task' && subtype === 'due') {
            return CalendarDaysIcon;
        }
        if (type === 'expense') {
            return HandCoinsIcon;
        }
        return {
            client: UserIcon,
            project: DocumentTextIcon,
            task: CheckIcon,
        }[type];
    };

    const Icon = getIcon();
    const iconClasses = 'text-muted-foreground';
    const hasColor = !!color;

    // Calculate progress percentage if we have estimated hours
    // For tasks, progress is actual time vs estimated hours
    // For projects/clients, progress comes from passed props (likely child tasks sum vs target)
    // Note: User requested that items with target hours should show progress even if actualTimeMs is 0 (0% progress)
    const hasTarget = estimatedHours && estimatedHours > 0;
    const estimatedMs = (estimatedHours || 0) * 60 * 60 * 1000;
    const progressPercent = hasTarget && actualTimeMs > 0
        ? Math.min(100, Math.round((actualTimeMs / estimatedMs) * 100))
        : 0;

    // Format time for tooltip
    const formatTime = (ms) => {
        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h`;
        return `${minutes}m`;
    };

    const progressTooltip = hasTarget 
        ? `${formatTime(actualTimeMs)} / ${estimatedHours}h (${progressPercent}%)`
        : undefined;

    const safeHeightPercent = typeof heightPercent === 'number' && heightPercent > 0
        ? heightPercent
        : 0;

    const dynamicHeight = `max(42px, ${Math.round(safeHeightPercent * 10000) / 100}% )`;
    
    const handleClick = (e) => {
        // Don't trigger click if menu is open
        if (menuOpen) {
            if (!canShowMenu) {
                setMenuOpen(false);
            }
            return;
        }
        onClick?.();
    };

    const handleContextMenu = (e) => {
        if (type === 'task') {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // Only show context menu if there are actions available
        if (!canShowMenu) {
            return;
        }

        e.preventDefault();
        setMenuOpen(true);
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        setMenuOpen(false);
        onRemove?.();
    };

    const handleEdit = (e) => {
        e.stopPropagation();
        setMenuOpen(false);
        onEdit?.();
    };

    const handleOpenItem = (e) => {
        e.stopPropagation();
        setMenuOpen(false);
        onClick?.();
    };

    const typeLabel = type === 'client' ? 'Client' : type === 'project' ? 'Project' : type === 'task' ? 'Task' : 'Expense';
    const canShowMenu = hasAttachment && type !== 'task' && type !== 'expense';

    const expenseAmountDisplay = useMemo(() => {
        if (!isExpense) return null;
        if (needsAmount) return 'Enter amount';
        return `${formatCurrency(amount || 0, currency)} ${currency}`;
    }, [isExpense, needsAmount, amount, currency]);

    const handleMarkPaid = (event) => {
        event.stopPropagation();
        setShowAmountError(false);

        if (needsAmount) {
            const parsed = Number(expenseAmount);
            if (!parsed || parsed <= 0) {
                setShowAmountError(true);
                return;
            }
            onMarkPaid?.(parsed);
            return;
        }

        onMarkPaid?.();
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick?.();
                }
            }}
            title={progressTooltip}
            className={cn(
                "group/item p-2 rounded-md border cursor-pointer transition-all relative overflow-hidden",
                "flex items-center",
                "hover:shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                "bg-card border-border",
                hasColor && "border-l-4",
                isCompleted && "opacity-60"
            )}
            style={{
                ...(hasColor ? { borderLeftColor: color } : {}),
                height: dynamicHeight,
                minHeight: '42px',
            }}
        >
            {/* Progress fill background - Removed in favor of bottom border progress as requested */}
            {/* {hasTarget && actualTimeMs > 0 && (
                <div 
                    className="absolute inset-0 transition-all bg-primary/10 dark:bg-primary/20"
                    style={{ 
                        width: `${progressPercent}%`,
                    }}
                />
            )} */}

            <div className="flex items-center gap-2 min-w-0 relative z-10 w-full mb-0.5">
                <Icon className={cn("h-4 w-4 flex-shrink-0", iconClasses)} />
                
                <div className="flex-1 min-w-0">
                    <div className={cn(
                        "text-sm truncate",
                        isCompleted && "line-through text-muted-foreground"
                    )}>
                        {title}
                    </div>
                    {isExpense && supplierName && (
                        <div className="text-xs text-muted-foreground truncate">
                            {supplierName}
                        </div>
                    )}
                </div>

                {type === 'task' && isTimerActive && (
                    <span className="text-xs text-green-600 dark:text-green-400 animate-pulse flex-shrink-0">●</span>
                )}

                {isExpense && (
                    <div className="flex items-center gap-2">
                        {needsAmount ? (
                            <div className="w-24">
                                <Input
                                    value={expenseAmount}
                                    onChange={(event) => setExpenseAmount(event.target.value)}
                                    placeholder="Amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    onClick={(event) => event.stopPropagation()}
                                    className="h-7 px-2 text-xs"
                                />
                                {showAmountError && (
                                    <div className="text-[10px] text-red-600">Required</div>
                                )}
                            </div>
                        ) : (
                            <span className="text-xs font-medium text-foreground sensitive-data">
                                {expenseAmountDisplay}
                            </span>
                        )}
                        <Button size="xs" onClick={handleMarkPaid} type="button">
                            {needsAmount ? 'Pay' : 'Mark Paid'}
                        </Button>
                    </div>
                )}

                {/* Three-dot menu button - appears on hover */}
                {canShowMenu && (
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                    "ml-auto p-1 rounded",
                                    "hidden group-hover/item:block",
                                    "hover:bg-muted focus:outline-none focus:opacity-100 cursor-pointer",
                                    menuOpen && "block"
                                )}
                                aria-label="Item options"
                            >
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={handleOpenItem}>
                                <ExternalLink className="h-4 w-4" />
                                Open {typeLabel}
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={handleEdit}>
                                <SlidersHorizontal className="h-4 w-4" />
                                Edit planner options
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                                onClick={handleRemove}
                                className="text-destructive-strong focus-text-destructive-strong"
                            >
                                <Trash2 className="h-4 w-4" />
                                Remove from Planner
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );
};

export default PlannerItem;
