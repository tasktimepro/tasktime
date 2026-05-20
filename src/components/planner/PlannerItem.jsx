/**
 * PlannerItem - Individual item card in the planner
 * 
 * Displays a client, project, or task with appropriate styling
 * Shows color tag as left border when color is set
 * Shows progress fill when estimated hours is set
 * Has dropdown menu for actions (remove, etc.)
 */

import { useState } from 'react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, ExternalLink, SlidersHorizontal } from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils.ts';

/**
 * @param {Object} props
 * @param {'client' | 'project' | 'task' | 'expense'} props.type - Type of item
 * @param {string} props.title - Display title
 * @param {boolean} props.isCompleted - Whether item is completed (tasks only)
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
 * @param {boolean} props.hasAttachment - Whether item has a planner attachment (can be removed)
 * @param {boolean} props.isPreview - Whether item is a non-interactive preview
 * @param {() => void} props.onClick - Click handler
 * @param {() => void} props.onEdit - Called when user wants to edit planner options
 * @param {() => void} props.onRemove - Called when user wants to remove from planner
 * @param {'default' | 'mobile'} props.layout
 */
const PlannerItem = ({
    type,
    title,
    isCompleted = false,
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
    hasAttachment = false,
    isPreview = false,
    onClick,
    onEdit,
    onRemove,
    layout = 'default',
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const isExpense = type === 'expense';
    const isClickable = typeof onClick === 'function' && (!isPreview || isExpense);
    const isMobileLayout = layout === 'mobile';

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
    const amountLabel = isExpense && typeof amount === 'number'
        ? `${amountType === 'variable' ? '~' : ''}${formatCurrency(amount || 0, currency)} ${currency}`
        : null;
    const taskSubtypeLabel = subtype === 'recurring'
        ? 'Recurring'
        : subtype === 'due'
            ? 'Due'
            : subtype === 'timer'
                ? 'Timer'
                : subtype === 'worked'
                    ? 'Worked'
                    : subtype === 'attached'
                        ? 'Attached'
                        : null;
    const metaParts = isMobileLayout
        ? (isExpense
            ? [amountLabel, supplierName].filter(Boolean)
            : [taskSubtypeLabel, hasTarget ? `${estimatedHours}h plan` : null, actualTimeMs > 0 ? `${formatTime(actualTimeMs)} worked` : null].filter(Boolean))
        : [];
    
    const handleClick = () => {
        // Don't trigger click if menu is open
        if (menuOpen) {
            if (!canShowMenu) {
                setMenuOpen(false);
            }
            return;
        }
        if (!isClickable) {
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


    return (
        <div
            role={isClickable ? 'button' : 'presentation'}
            tabIndex={isClickable ? 0 : -1}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isClickable) {
                        onClick?.();
                    }
                }
            }}
            title={progressTooltip}
            className={cn(
                'group/item relative overflow-hidden rounded-md border p-2 transition-shadow',
                isClickable ? "cursor-pointer" : "cursor-default",
                isMobileLayout ? 'flex items-start' : 'flex items-center',
                "hover:shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                "bg-card border-border",
                hasColor && "border-l-4",
                isCompleted && "opacity-60",
                isMobileLayout && 'rounded-xl px-3 py-3'
            )}
            style={{
                ...(hasColor ? { borderLeftColor: color } : {}),
                height: isMobileLayout ? 'auto' : dynamicHeight,
                minHeight: isMobileLayout ? '56px' : '42px',
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

            <div className={cn('relative z-10 mb-0.5 flex w-full min-w-0 gap-2', isMobileLayout ? 'items-start' : 'items-center')}>
                <Icon className={cn('h-4 w-4 flex-shrink-0', isMobileLayout && 'mt-0.5', iconClasses)} />
                
                <div className={cn('min-w-0 flex-1', isMobileLayout && 'space-y-0.5')}>
                    <div className={cn(
                        isMobileLayout ? 'text-sm font-medium whitespace-normal break-words' : 'text-sm truncate',
                        isCompleted && "line-through text-muted-foreground"
                    )}>
                        {title}
                    </div>
                    {metaParts.length > 0 && (
                        <div className={cn(
                            'text-xs text-muted-foreground',
                            isMobileLayout ? 'space-y-0.5' : 'truncate'
                        )}>
                            {isMobileLayout ? metaParts.map((part) => (
                                <div key={part} className="whitespace-normal break-words">
                                    {part}
                                </div>
                            )) : metaParts.join(' • ')}
                        </div>
                    )}
                </div>

                {type === 'task' && isTimerActive && (
                    <span className="status-success-text-strong animate-pulse flex-shrink-0 text-xs">●</span>
                )}

                {/* Three-dot menu button - appears on hover */}
                {canShowMenu && (
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                    'ml-auto rounded p-1',
                                    'hover:bg-muted focus:outline-none focus:opacity-100 cursor-pointer',
                                    'opacity-100 md:opacity-0 md:group-hover/item:opacity-100',
                                    menuOpen && 'opacity-100'
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
