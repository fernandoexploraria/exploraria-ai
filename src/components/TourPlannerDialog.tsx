
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface TourPlannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => Promise<void>;
  isLoading: boolean;
}

const TourPlannerDialog: React.FC<TourPlannerDialogProps> = ({ open, onOpenChange, onGenerateTour, isLoading }) => {
  const [destination, setDestination] = useState('');

  const handleGenerate = async () => {
    if (destination) {
      await onGenerateTour(destination);
      onOpenChange(false); // Close dialog after generating
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI Tour Planner</DialogTitle>
          <DialogDescription>
            Enter a destination, and we'll suggest some landmarks for your trip. This feature uses Perplexity AI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="destination">Destination (e.g., "Rome")</Label>
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Enter a city or region"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isLoading || !destination}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TourPlannerDialog;
