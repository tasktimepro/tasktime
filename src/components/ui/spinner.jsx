import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils.ts"

const spinnerSizeClasses = {
    xs: "h-3 w-3",
    sm: "h-3.5 w-3.5",
    default: "h-4 w-4",
    lg: "h-5 w-5",
    xl: "h-8 w-8",
}

const Spinner = React.forwardRef(({
    className,
    size = "default",
    ...props
}, ref) => {

    return (
        <Loader2
            ref={ref}
            aria-hidden="true"
            className={cn("animate-spin", spinnerSizeClasses[size] || spinnerSizeClasses.default, className)}
            {...props}
        />
    )
})

Spinner.displayName = "Spinner"

export { Spinner }