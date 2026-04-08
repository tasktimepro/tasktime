import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
/* eslint-disable react-refresh/only-export-components */
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils.ts"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
                outline:
                    "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-2",
                xs: "h-7 rounded-md px-2 text-xs",
                sm: "h-8 rounded-md px-3 text-xs",
                lg: "h-10 rounded-md px-6",
                xl: "h-12 rounded-md px-8 text-base",
                icon: "h-9 w-9 p-0",
                "icon-sm": "h-8 w-8 p-0",
                "icon-xs": "h-6 w-6 p-0",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

/**
 * Flexible Button component with full customization options
 * 
 * @param {Object} props - Component props
 * @param {string} props.variant - Visual style: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success'
 * @param {string} props.size - Size: 'default' | 'xs' | 'sm' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-xs'
 * @param {React.ElementType} props.leadingIcon - Icon component to show before label
 * @param {React.ElementType} props.trailingIcon - Icon component to show after label
 * @param {boolean} props.loading - Shows loading spinner and disables button
 * @param {string} props.loadingText - Text to show while loading (optional)
 * @param {boolean} props.iconOnly - Forces icon-only styling even with children
 * @param {boolean} props.fullWidth - Makes button full width
 * @param {string} props.iconClassName - Additional classes for icons
 * @param {boolean} props.asChild - Render as child element (Radix Slot)
 */
const Button = React.forwardRef(({
    className,
    variant,
    size,
    asChild = false,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    loading = false,
    loadingText,
    iconOnly = false,
    fullWidth = false,
    iconClassName = "",
    disabled,
    children,
    type = "button",
    ...props
}, ref) => {

    const isDisabled = disabled || loading
    const hasLoadingText = !!(loading && loadingText)
    const hasLabel = Boolean(children) || hasLoadingText
    const isIconOnly = iconOnly || (!hasLabel && (LeadingIcon || TrailingIcon))

    // Determine icon size based on button size
    const iconSizeClass = cn(
        "shrink-0",
        {
            "h-3 w-3": size === "xs",
            "h-3.5 w-3.5": size === "sm",
            "h-4 w-4": !size || size === "default" || size === "icon",
            "h-5 w-5": size === "lg" || size === "xl",
        },
        iconClassName
    )

    // Use Slot for asChild pattern
    if (asChild) {
        return (
            <Slot
                ref={ref}
                className={cn(
                    buttonVariants({ variant, size }),
                    fullWidth && "w-full",
                    className
                )}
                {...props}
            />
        )
    }

    return (
        <button
            ref={ref}
            type={type}
            disabled={isDisabled}
            className={cn(
                buttonVariants({ variant, size: isIconOnly ? (size?.includes("icon") ? size : "icon") : size }),
                fullWidth && "w-full",
                loading && "cursor-wait",
                className
            )}
            {...props}
        >
            {/* Loading spinner */}
            {loading && (
                <Loader2 className={cn(iconSizeClass, "animate-spin")} />
            )}

            {/* Leading icon (hidden when loading) */}
            {LeadingIcon && !loading && (
                <LeadingIcon className={iconSizeClass} />
            )}

            {/* Label */}
            {hasLabel && (
                <span className={cn(loading && !loadingText && "opacity-0")}>
                    {loading && loadingText ? loadingText : children}
                </span>
            )}

            {/* Trailing icon (hidden when loading) */}
            {TrailingIcon && !loading && (
                <TrailingIcon className={iconSizeClass} />
            )}
        </button>
    )
})
Button.displayName = "Button"

export { Button, buttonVariants }
