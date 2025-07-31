import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Compass } from 'lucide-react';

interface LocationPermissionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAllowLocation: () => void;
  isLoading?: boolean;
  feature?: 'tours' | 'navigation' | 'general';
}

export const LocationPermissionDialog: React.FC<LocationPermissionDialogProps> = ({
  isOpen,
  onOpenChange,
  onAllowLocation,
  isLoading = false,
  feature = 'general',
}) => {
  const getFeatureContent = () => {
    switch (feature) {
      case 'tours':
        return {
          icon: <MapPin className="h-12 w-12 text-primary" />,
          title: 'Find Tours Near You',
          description: 'We use your location to show you relevant tours in your area and suggest the best routes to explore nearby landmarks.',
        };
      case 'navigation':
        return {
          icon: <Navigation className="h-12 w-12 text-primary" />,
          title: 'Enable Navigation',
          description: 'We need your location to provide turn-by-turn directions and guide you along optimal routes during your tours.',
        };
      default:
        return {
          icon: <Compass className="h-12 w-12 text-primary" />,
          title: 'Enable Location Services',
          description: 'We use your location to enhance your experience by showing nearby attractions and providing personalized recommendations.',
        };
    }
  };

  const content = getFeatureContent();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            {content.icon}
          </div>
          <DialogTitle className="text-xl font-semibold">
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-base mt-3">
            {content.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted/50 rounded-lg p-4 my-4">
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              Your location data stays private and is only used to improve your tour experience. 
              We never share your location with third parties.
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button 
            onClick={onAllowLocation}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Requesting Permission...' : 'Allow Location Access'}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full"
          >
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};