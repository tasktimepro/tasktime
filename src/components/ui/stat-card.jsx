import PropTypes from 'prop-types';
import { cn } from '@/lib/utils';

/**
 * StatCard component for displaying metrics/statistics
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Card title
 * @param {React.ReactNode} props.value - Main value to display
 * @param {React.ReactNode} props.subtitle - Secondary info (optional)
 * @param {React.ElementType} props.icon - Icon component to display (optional)
 * @param {string} props.variant - Color variant: 'default' | 'blue' | 'green' | 'amber' | 'red' | 'gray'
 * @param {Function} props.onClick - Click handler for interactive cards (optional)
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Additional content (optional)
 */
const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    variant = 'default',
    onClick,
    className,
    children,
}) => {

    const variantStyles = {
        default: 'bg-card border-border',
        blue: 'status-info-surface status-info-border',
        green: 'status-success-surface status-success-border',
        amber: 'status-warning-surface status-warning-border',
        red: 'status-danger-surface status-danger-border',
        gray: 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700',
    };

    const textStyles = {
        default: {
            title: 'text-foreground',
            value: 'text-foreground',
            subtitle: 'text-muted-foreground',
            icon: 'text-muted-foreground',
        },
        blue: {
            title: 'status-info-text',
            value: 'status-info-text',
            subtitle: 'status-info-text',
            icon: 'status-info-text-strong',
        },
        green: {
            title: 'status-success-text',
            value: 'status-success-text',
            subtitle: 'status-success-text',
            icon: 'status-success-text-strong',
        },
        amber: {
            title: 'status-warning-text',
            value: 'status-warning-text',
            subtitle: 'status-warning-text',
            icon: 'status-warning-text-strong',
        },
        red: {
            title: 'status-danger-text',
            value: 'status-danger-text',
            subtitle: 'status-danger-text',
            icon: 'status-danger-text-strong',
        },
        gray: {
            title: 'text-gray-900 dark:text-gray-100',
            value: 'text-gray-900 dark:text-gray-100',
            subtitle: 'text-gray-700 dark:text-gray-300',
            icon: 'text-gray-600 dark:text-gray-400',
        },
    };

    const colors = textStyles[variant];
    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            onClick={onClick}
            className={cn(
                'rounded-lg p-4 border',
                variantStyles[variant],
                onClick && 'text-left hover:opacity-90 transition-opacity cursor-pointer',
                className
            )}
        >
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    {title && (
                        <h3 className={cn('text-sm font-medium', colors.title)}>
                            {title}
                        </h3>
                    )}
                    
                    {value && (
                        <div className={cn('mt-2 text-lg font-semibold', colors.value)}>
                            {value}
                        </div>
                    )}
                    
                    {subtitle && (
                        <div className={cn('mt-1 text-sm', colors.subtitle)}>
                            {subtitle}
                        </div>
                    )}
                    
                    {children}
                </div>
                
                {Icon && (
                    <Icon className={cn('h-8 w-8 flex-shrink-0', colors.icon)} />
                )}
            </div>
        </Component>
    );
};

StatCard.propTypes = {
    title: PropTypes.string,
    value: PropTypes.node,
    subtitle: PropTypes.node,
    icon: PropTypes.elementType,
    variant: PropTypes.oneOf(['default', 'blue', 'green', 'amber', 'red', 'gray']),
    onClick: PropTypes.func,
    className: PropTypes.string,
    children: PropTypes.node,
};

export { StatCard };
