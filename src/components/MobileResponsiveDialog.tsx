
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MobileResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const MobileResponsiveDialog: React.FC<MobileResponsiveDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  className
}) => {
  const isMobile = useIsMobile();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-2xl overflow-y-auto",
          // Mobile-specific positioning to avoid keyboard issues with reduced height
          isMobile 
            ? "fixed left-[50%] top-[5%] translate-x-[-50%] translate-y-0 max-h-[70vh] w-[95vw]" 
            : "fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] max-h-[80vh]",
          className
        )}
        style={{ 
          zIndex: 99999,
          // Use reduced dynamic viewport height on mobile for better keyboard handling
          ...(isMobile && {
            maxHeight: 'min(70vh, calc(100vh - 150px))',
            marginBottom: '20px'
          })
        }}
        aria-describedby={description ? "mobile-dialog-description" : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription id="mobile-dialog-description">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};

export default MobileResponsiveDialog;
