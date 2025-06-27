
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapPin, Sparkles, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EnhancedDestinationSelector from "@/components/EnhancedDestinationSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DestinationDetails {
  placeId: string;
  mainText: string;
  secondaryText: string;
  types: string[];
  formattedAddress: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

const TourPlannerV2Simple = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [destinationDetails, setDestinationDetails] = useState<DestinationDetails | null>(null);
  const [isStoring, setIsStoring] = useState(false);
  const [isStored, setIsStored] = useState(false);

  const handleDestinationSelect = (destination: string, details: DestinationDetails) => {
    console.log('🎯 Selected destination:', destination, 'with details:', details);
    setSelectedDestination(destination);
    setDestinationDetails(details);
    setIsStored(false);
  };

  const handleStoreTour = async () => {
    if (!destinationDetails || !selectedDestination) {
      toast.error('Please select a destination first');
      return;
    }

    setIsStoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('store-tour-destination', {
        body: {
          destination: selectedDestination,
          destinationDetails: destinationDetails
        }
      });

      if (error) {
        console.error('Error storing tour destination:', error);
        toast.error('Failed to store tour destination');
        return;
      }

      console.log('✅ Tour destination stored successfully:', data);
      setIsStored(true);
      toast.success('Tour destination stored successfully!');
    } catch (err) {
      console.error('Error storing tour destination:', err);
      toast.error('Failed to store tour destination');
    } finally {
      setIsStoring(false);
    }
  };

  const handleReset = () => {
    setSelectedDestination('');
    setDestinationDetails(null);
    setIsStored(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Sparkles className="mr-2 h-5 w-5" />
          Plan Tour V2 (Simple)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <MapPin className="h-6 w-6 text-blue-600" />
            Simple Tour Planner V2
          </DialogTitle>
          <DialogDescription>
            Search for a destination, view its details, and store it in the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!isStored && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Choose Your Destination
                </label>
                <EnhancedDestinationSelector
                  onDestinationSelect={handleDestinationSelect}
                  placeholder="Search for cities, attractions, or landmarks..."
                  className="w-full"
                />
              </div>

              {destinationDetails && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-blue-800">Selected Destination</CardTitle>
                    <CardDescription className="text-blue-700">
                      {destinationDetails.mainText}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{destinationDetails.formattedAddress}</span>
                    </div>
                    
                    {destinationDetails.location && (
                      <div className="text-sm text-gray-600">
                        <strong>Coordinates:</strong> {destinationDetails.location.latitude.toFixed(6)}, {destinationDetails.location.longitude.toFixed(6)}
                      </div>
                    )}
                    
                    {destinationDetails.types && destinationDetails.types.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 block mb-1">Types:</span>
                        <div className="flex gap-1 flex-wrap">
                          {destinationDetails.types.slice(0, 4).map((type, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {type.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {destinationDetails.types.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{destinationDetails.types.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      <strong>Place ID:</strong> {destinationDetails.placeId}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleStoreTour}
                  disabled={!destinationDetails || isStoring}
                  className="flex-1"
                >
                  {isStoring ? 'Storing...' : 'Generate Tour (Store Destination)'}
                </Button>
                {destinationDetails && (
                  <Button 
                    variant="outline" 
                    onClick={handleReset}
                    disabled={isStoring}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          )}

          {isStored && destinationDetails && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  Destination Stored Successfully!
                </CardTitle>
                <CardDescription className="text-green-700">
                  Your destination <strong>{destinationDetails.mainText}</strong> has been stored in the database.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm text-green-700">
                  <div><strong>Address:</strong> {destinationDetails.formattedAddress}</div>
                  <div><strong>Place ID:</strong> {destinationDetails.placeId}</div>
                  {destinationDetails.location && (
                    <div><strong>Location:</strong> {destinationDetails.location.latitude.toFixed(6)}, {destinationDetails.location.longitude.toFixed(6)}</div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={() => setIsOpen(false)} className="flex-1">
                    Close
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleReset}
                  >
                    Plan Another Tour
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TourPlannerV2Simple;
