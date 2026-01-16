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
        blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
        green: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
        amber: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
        red: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
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
            title: 'text-blue-900 dark:text-blue-100',
            value: 'text-blue-900 dark:text-blue-100',
            subtitle: 'text-blue-700 dark:text-blue-300',
            icon: 'text-blue-600 dark:text-blue-400',
        },
        green: {
            title: 'text-green-900 dark:text-green-100',
            value: 'text-green-900 dark:text-green-100',
            subtitle: 'text-green-700 dark:text-green-300',
            icon: 'text-green-600 dark:text-green-400',
        },
        amber: {
            title: 'text-amber-900 dark:text-amber-100',
            value: 'text-amber-900 dark:text-amber-100',
            subtitle: 'text-amber-700 dark:text-amber-300',
            icon: 'text-amber-600 dark:text-amber-400',
        },
        red: {
            title: 'text-red-900 dark:text-red-100',
            value: 'text-red-900 dark:text-red-100',
            subtitle: 'text-red-700 dark:text-red-300',
            icon: 'text-red-600 dark:text-red-400',
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
