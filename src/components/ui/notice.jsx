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
 * @param {string} [props.className] - Additional CSS classes
 */
const Notice = React.forwardRef(({ 
    title, 
    description,
    children,
    icon: Icon = InformationCircleIcon,
    showIcon = true,
    variant = "default",
    className,
    ...props 
}, ref) => {
    
    const variantStyles = {
        default: "bg-muted border-border text-foreground",
        warning: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100",
        destructive: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100",
        success: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100",
    }

    const iconStyles = {
        default: "text-muted-foreground",
        warning: "text-yellow-600 dark:text-yellow-400",
        destructive: "text-red-600 dark:text-red-400",
        success: "text-green-600 dark:text-green-400",
    }

    const descriptionStyles = {
        default: "text-muted-foreground",
        warning: "text-yellow-700 dark:text-yellow-300",
        destructive: "text-red-700 dark:text-red-300",
        success: "text-green-700 dark:text-green-300",
    }

    return (
        <div 
            ref={ref}
            className={cn(
                "rounded-md border p-4",
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
                        <p className={cn("mt-1 text-sm", descriptionStyles[variant])}>
                            {description}
                        </p>
                    )}
                    {children && (
                        <div className={cn("mt-2 text-sm", descriptionStyles[variant])}>
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
