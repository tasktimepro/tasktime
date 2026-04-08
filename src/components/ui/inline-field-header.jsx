import { cn } from "@/lib/utils.ts"

function InlineFieldHeader({ children, action, className }) {
    return (
        <div className={cn("mb-1 flex items-baseline justify-between gap-3", className)}>
            <div className="min-w-0 flex-1">
                {children}
            </div>
            {action ? (
                <div className="shrink-0">
                    {action}
                </div>
            ) : null}
        </div>
    )
}

export { InlineFieldHeader }