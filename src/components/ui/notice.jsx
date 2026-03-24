import * as React from "react"
import { cn } from "@/lib/utils"
import { InformationCircleIcon } from "@/components/ui/icons"

/**
 * Notice component for displaying informational messages, warnings, or tips
 * 
 * @param {Object} props
 * @param {string} props.title - Required title text
 * @param {string} [props.description] - Optional description text
 * @param {React.ReactNode} [props.children] - Optional custom content (alternative to description)
 * @param {React.ComponentType} [props.icon] - Optional icon component (defaults to InformationCircleIcon)
 * @param {boolean} [props.showIcon=true] - Whether to show the icon
 * @param {"default" | "warning" | "destructive" | "success"} [props.variant="default"] - Visual variant
 * @param {boolean} [props.compact=false] - Reduce internal spacing
 * @param {string} [props.className] - Additional CSS classes
 */
const Notice = React.forwardRef(({ 
    title, 
    description,
    children,
    icon: Icon = InformationCircleIcon,
    showIcon = true,
    variant = "default",
    compact = false,
    className,
    ...props 
}, ref) => {
    
    const variantStyles = {
        default: "bg-muted border-border text-foreground",
        warning: "status-warning-surface status-warning-border status-warning-text",
        destructive: "status-danger-surface status-danger-border status-danger-text",
        success: "status-success-surface status-success-border status-success-text",
    }

    const iconStyles = {
        default: "text-muted-foreground",
        warning: "status-warning-text-strong",
        destructive: "status-danger-text-strong",
        success: "status-success-text-strong",
    }

    const descriptionStyles = {
        default: "text-muted-foreground",
        warning: "status-warning-text",
        destructive: "status-danger-text",
        success: "status-success-text",
    }

    return (
        <div 
            ref={ref}
            className={cn(
                compact ? "rounded-md border p-2" : "rounded-md border p-4",
                variantStyles[variant],
                className
            )}
            {...props}
        >
            <div className="flex items-center">
                {showIcon && Icon && (
                    <div className="flex-shrink-0 self-center">
                        <Icon className={cn("h-5 w-5", iconStyles[variant])} />
                    </div>
                )}
                <div className={cn(showIcon && Icon ? "ml-3" : "")}>
                    <p className="text-sm font-medium">
                        {title}
                    </p>
                    {description && (
                        <p className={cn(compact ? "text-sm" : "mt-1 text-sm", descriptionStyles[variant])}>
                            {description}
                        </p>
                    )}
                    {children && (
                        <div className={cn(compact ? "mt-1 text-sm" : "mt-1 text-sm", descriptionStyles[variant])}>
                            {children}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
})
Notice.displayName = "Notice"

export { Notice }
