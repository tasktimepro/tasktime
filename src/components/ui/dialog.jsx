import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XMarkIcon } from "@/components/ui/icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const TEXT_ENTRY_SELECTOR = [
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[contenteditable="true"]',
  '[contenteditable=""]',
].join(', ')

function focusPreferredDialogTarget(container) {
  if (!(container instanceof HTMLElement)) {
    return false
  }

  const explicitTarget = container.querySelector('[autofocus], [data-autofocus]')

  if (explicitTarget instanceof HTMLElement && !explicitTarget.hasAttribute('disabled')) {
    explicitTarget.focus()
    return document.activeElement === explicitTarget
  }

  const firstField = container.querySelector(TEXT_ENTRY_SELECTOR)

  if (firstField instanceof HTMLElement) {
    firstField.focus()
    return document.activeElement === firstField
  }

  return false
}

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(({
  className,
  children,
  hideCloseButton = false,
  overlayClassName,
  onOpenAutoFocus,
  ...props
}, ref) => {
  const contentRef = React.useRef(null)

  React.useImperativeHandle(ref, () => contentRef.current)

  const handleOpenAutoFocus = React.useCallback((event) => {
    onOpenAutoFocus?.(event)

    if (event.defaultPrevented) {
      return
    }

    if (focusPreferredDialogTarget(contentRef.current)) {
      event.preventDefault()
    }
  }, [onOpenAutoFocus])

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={contentRef}
        aria-describedby={undefined}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-card p-6 shadow-lg outline-none duration-200 focus:outline-none focus-visible:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        onOpenAutoFocus={handleOpenAutoFocus}
        {...props}>
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close asChild>
            <Button
              variant="outline"
              size="icon-sm"
              className="absolute right-4 top-4 rounded-full bg-card shadow-sm"
              aria-label="Close dialog"
            >
              <XMarkIcon className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-left", className)}
    {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-row flex-wrap justify-end gap-2", className)}
    {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
