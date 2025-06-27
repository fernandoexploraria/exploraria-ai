
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { MapPin, Sparkles } from 'lucide-react';
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete';
import { PlacePrediction } from '@/hooks/usePlacesAutocomplete';

interface TourPlannerV2DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TourPlannerV2Dialog: React.FC<TourPlannerV2DialogProps> = ({ 
  open, 
  onOpenChange
}) => {
  const [selectedPlace, setSelectedPlace] = useState<PlacePrediction | null>(null);

  const handlePlaceSelect = (place: PlacePrediction) => {
    setSelectedPlace(place);
    console.log('Selected place:', place);
  };

  const handleGenerateTour = () => {
    if (!selectedPlace) return;
    
    console.log('Generating tour for:', selectedPlace);
    // TODO: Implement tour generation logic
    // This will be implemented in the next phase
    
    // For now, just close the dialog
    onOpenChange(false);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedPlace(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Tour Planner v2
          </DialogTitle>
          <DialogDescription>
            Search for any destination using Google Places. We'll find verified landmarks and create a personalized tour for you.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <GooglePlacesAutocomplete
            onPlaceSelect={handlePlaceSelect}
            placeholder="Search for a city, landmark, or attraction..."
            label="Where would you like to explore?"
          />
          
          {selectedPlace && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Selected Destination
                  </p>
                  <p className="text-sm text-blue-700">
                    {selectedPlace.text}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGenerateTour} 
            disabled={!selectedPlace}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TourPlannerV2Dialog;
