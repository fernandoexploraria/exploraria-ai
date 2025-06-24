
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Smartphone, AlertTriangle } from 'lucide-react';

interface ProximityOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const ProximityOnboardingDialog: React.FC<ProximityOnboardingDialogProps> = ({
  open,
  onOpenChange,
  onComplete,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Enable Proximity Alerts
          </DialogTitle>
          <DialogDescription>
            Get notified when you're near interesting landmarks during your travels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
              How Proximity Alerts Work:
            </div>
            <ul className="text-sm space-y-2">
              <li className="flex items-start gap-2">
                <Navigation className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Track your location in the background</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Send notifications when you're near landmarks</span>
              </li>
              <li className="flex items-start gap-2">
                <Smartphone className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Adjust tracking frequency to save battery</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-amber-800 mb-1">
                  Location Permission Required
                </div>
                <div className="text-amber-700">
                  Your browser will ask for location access. Please select "Allow" to enable proximity alerts.
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium">Important Notes:</div>
            <ul className="space-y-1 ml-2">
              <li>• If you accidentally deny permission, you'll need to reset it in your browser settings</li>
              <li>• On mobile Safari, you may need to clear website data if permission was previously denied</li>
              <li>• You can disable proximity alerts anytime in settings</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button onClick={onComplete}>
            Continue & Enable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProximityOnboardingDialog;
