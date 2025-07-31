import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation } from "lucide-react";

interface LocationPermissionDialogProps {
  open: boolean;
  onAllow: () => void;
  onNotNow: () => void;
}

export const LocationPermissionDialog = ({ open, onAllow, onNotNow }: LocationPermissionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Navigation className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Location Access</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">
            We'd like to show you nearby attractions and provide personalized recommendations based on your location.
          </p>
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm text-left">
              Find amazing places and experiences around you
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <Button 
            onClick={onAllow}
            className="w-full"
            size="lg"
          >
            Allow Location
          </Button>
          
          <Button 
            onClick={onNotNow}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Not Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};