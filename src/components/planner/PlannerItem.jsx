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
} from '@/components/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, ExternalLink } from 'lucide-react';

/**
 * @param {Object} props
 * @param {'client' | 'project' | 'task'} props.type - Type of item
 * @param {string} props.title - Display title
 * @param {boolean} props.isCompleted - Whether item is completed (tasks only)
 * @param {boolean} props.isStatic - Whether item is pinned (static/weekday mode)
 * @param {'recurring' | 'due' | 'attached' | 'timer' | 'worked'} props.subtype - Task subtype (tasks only)
 * @param {string | null} props.color - Color tag (hex color)
 * @param {number | null} props.estimatedHours - Estimated hours for this item
 * @param {number} props.actualTimeMs - Actual time worked in milliseconds
 * @param {boolean} props.isTimerActive - Whether this item has an active timer (tasks only)
 * @param {boolean} props.hasAttachment - Whether item has a planner attachment (can be removed)
 * @param {() => void} props.onClick - Click handler
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
    isTimerActive = false,
    hasAttachment = false,
    onClick,
    onRemove,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);

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
    const hasProgress = estimatedHours && estimatedHours > 0 && actualTimeMs > 0;
    const estimatedMs = (estimatedHours || 0) * 60 * 60 * 1000;
    const progressPercent = hasProgress 
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

    const progressTooltip = hasProgress 
        ? `${formatTime(actualTimeMs)} / ${estimatedHours}h (${progressPercent}%)`
        : undefined;

    const handleClick = (e) => {
        // Don't trigger click if menu is open
        if (menuOpen) return;
        onClick?.();
    };

    const handleContextMenu = (e) => {
        // Only show context menu if there are actions available
        if (hasAttachment) {
            e.preventDefault();
            setMenuOpen(true);
        }
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        setMenuOpen(false);
        onRemove?.();
    };

    const handleOpenItem = (e) => {
        e.stopPropagation();
        setMenuOpen(false);
        onClick?.();
    };

    const typeLabel = type === 'client' ? 'Client' : type === 'project' ? 'Project' : 'Task';
    const canShowMenu = hasAttachment && type !== 'task';

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
                "hover:shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                "bg-card border-border",
                hasColor && "border-l-4",
                isCompleted && "opacity-60"
            )}
            style={hasColor ? { borderLeftColor: color } : undefined}
        >
            {/* Progress fill background */}
            {hasProgress && (
                <div 
                    className="absolute inset-0 transition-all bg-primary/10 dark:bg-primary/20"
                    style={{ 
                        width: `${progressPercent}%`,
                    }}
                />
            )}

            <div className="flex items-center gap-2 min-w-0 relative z-10">
                <Icon className={cn("h-4 w-4 flex-shrink-0", iconClasses)} />
                
                <span className={cn(
                    "text-sm flex-1 min-w-0 truncate",
                    isCompleted && "line-through text-muted-foreground"
                )}>
                    {title}
                </span>

                {hasProgress && (
                    <span className="text-[10px] font-medium px-1 rounded text-muted-foreground flex-shrink-0">
                        {progressPercent}%
                    </span>
                )}

                {type === 'task' && isTimerActive && (
                    <span className="text-xs text-green-600 dark:text-green-400 animate-pulse flex-shrink-0">●</span>
                )}

                {/* Three-dot menu button - appears on hover */}
                {canShowMenu && (
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                    "absolute right-0.5 top-1/2 -translate-y-1/2 p-1 rounded",
                                    "opacity-0 group-hover/item:opacity-100 transition-opacity",
                                    "hover:bg-muted focus:outline-none focus:opacity-100 cursor-pointer",
                                    menuOpen && "opacity-100"
                                )}
                                aria-label="Item options"
                            >
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={handleOpenItem}>
                                <ExternalLink className="h-4 w-4" />
                                Open {typeLabel}
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
