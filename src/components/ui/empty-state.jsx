import PropTypes from 'prop-types';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/button';

/**
 * EmptyState component for displaying "no items" states
 * 
 * @param {Object} props - Component props
 * @param {React.ElementType} props.icon - Icon component to display
 * @param {'default'|'sm'} props.iconSize - Icon size (sm matches compact dashboard states)
 * @param {string} props.title - Title text
 * @param {string} props.description - Description text
 * @param {string} props.actionLabel - Button label (optional)
 * @param {Function} props.onAction - Button click handler (optional)
 * @param {React.ElementType} props.actionIcon - Icon for the button (optional)
 * @param {string} props.actionVariant - Button variant (optional, defaults to 'default')
 * @param {string} props.className - Additional CSS classes
 */
const EmptyState = ({
    icon: Icon,
    iconSize = 'default',
    title,
    description,
    actionLabel,
    onAction,
    actionIcon: ActionIcon,
    actionVariant = 'default',
    className,
}) => {

    const iconSizeClass = iconSize === 'sm' ? 'h-8 w-8' : 'h-12 w-12';

    return (
        <div className={cn("text-center py-12", className)}>
            {Icon && (
                <div className={cn("mx-auto text-muted-foreground", iconSizeClass)}>
                    <Icon className={iconSizeClass} />
                </div>
            )}

            {title && (
                <h3 className="mt-2 text-sm font-medium text-foreground">
                    {title}
                </h3>
            )}

            {description && (
                <p className={cn("text-sm text-muted-foreground", title ? "mt-1" : "mt-2")}>
                    {description}
                </p>
            )}

            {actionLabel && onAction && (
                <div className="mt-6">
                    <Button
                        onClick={onAction}
                        variant={actionVariant}
                        leadingIcon={ActionIcon}
                    >
                        {actionLabel}
                    </Button>
                </div>
            )}
        </div>
    );
};

EmptyState.propTypes = {
    icon: PropTypes.elementType,
    iconSize: PropTypes.oneOf(['default', 'sm']),
    title: PropTypes.string,
    description: PropTypes.string,
    actionLabel: PropTypes.string,
    onAction: PropTypes.func,
    actionIcon: PropTypes.elementType,
    actionVariant: PropTypes.string,
    className: PropTypes.string,
};

export { EmptyState };
