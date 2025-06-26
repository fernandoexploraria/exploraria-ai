
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface TourPlannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => Promise<void>;
  onAuthRequired: (destination: string) => void;
  isLoading: boolean;
}

const TourPlannerDialog: React.FC<TourPlannerDialogProps> = ({ 
  open, 
  onOpenChange, 
  onGenerateTour, 
  onAuthRequired,
  isLoading 
}) => {
  const [destination, setDestination] = useState('');
  const { user } = useAuth();

  const handleGenerate = async () => {
    if (!destination) return;
    
    if (!user) {
      // Pass the destination to the auth handler
      onAuthRequired(destination);
      onOpenChange(false);
      return;
    }

    await onGenerateTour(destination);
    onOpenChange(false); // Close dialog after generating
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Enhanced AI Tour Planner
          </DialogTitle>
          <DialogDescription>
            Enter a destination, and we'll create a comprehensive tour with precisely located landmarks using our enhanced coordinate system powered by Google Places API and Gemini AI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="destination" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Destination (e.g., "Rome", "Tokyo", "Paris")
            </Label>
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Enter a city or region"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          {isLoading && (
            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">Generating enhanced tour...</span>
              </div>
              <div className="text-xs space-y-1 text-blue-600">
                <div>• Getting landmark suggestions from Gemini AI</div>
                <div>• Refining coordinates with Google Places API</div>
                <div>• Validating locations and gathering place data</div>
                <div>• Optimizing tour quality and accuracy</div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isLoading || !destination}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!user ? 'Sign In to Generate Tour' : 'Generate Enhanced Tour'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TourPlannerDialog;
