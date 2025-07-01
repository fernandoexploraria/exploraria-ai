
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"

const CleanDialog = DialogPrimitive.Root

const CleanDialogTrigger = DialogPrimitive.Trigger

const CleanDialogPortal = DialogPrimitive.Portal

const CleanDialogClose = DialogPrimitive.Close

const CleanDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[99998] bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    style={{ zIndex: 99998 }}
    {...props}
  />
))
CleanDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const CleanDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <CleanDialogPortal>
    <CleanDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-[99999] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      style={{ zIndex: 99999 }}
      {...props}
    >
      {children}
      {/* NO CLOSE BUTTON - this is the key difference from the original DialogContent */}
    </DialogPrimitive.Content>
  </CleanDialogPortal>
))
CleanDialogContent.displayName = DialogPrimitive.Content.displayName

const CleanDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
CleanDialogHeader.displayName = "CleanDialogHeader"

const CleanDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
CleanDialogFooter.displayName = "CleanDialogFooter"

const CleanDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CleanDialogTitle.displayName = DialogPrimitive.Title.displayName

const CleanDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CleanDialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  CleanDialog,
  CleanDialogPortal,
  CleanDialogOverlay,
  CleanDialogClose,
  CleanDialogTrigger,
  CleanDialogContent,
  CleanDialogHeader,
  CleanDialogFooter,
  CleanDialogTitle,
  CleanDialogDescription,
}
