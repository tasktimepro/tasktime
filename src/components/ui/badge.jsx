import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils.ts"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        muted:
          "border-transparent bg-muted text-muted-foreground",
        outline:
          "border-border text-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
        // Status badges - subtle with slate base (semantic meaning)
        success:
          "border-border bg-muted text-foreground",
        warning:
          "border-yellow-200 bg-yellow-100 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100",
        error:
          "border-border bg-muted text-foreground",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
