import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Route, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TourLandmark } from '@/data/tourLandmarks';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { convertToDestinationTime } from '@/utils/timezoneUtils';

interface TransitRoutePlannerProps {
  isOpen: boolean;
  onClose: () => void;
  landmarks: TourLandmark[];
  onPlanRoute: (origin: [number, number], destination: [number, number], departureTime: string, originName: string, destinationName: string) => void;
  isLoading: boolean;
}

interface LocationOption {
  id: string;
  name: string;
  coordinates: [number, number];
  isUserLocation?: boolean;
}

const TransitRoutePlanner: React.FC<TransitRoutePlannerProps> = ({
  isOpen,
  onClose,
  landmarks,
  onPlanRoute,
  isLoading
}) => {
  const { userLocation } = useLocationTracking();
  const [selectedOrigin, setSelectedOrigin] = useState<string>('');
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [departureTime, setDepartureTime] = useState<string>('');
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);

  // Initialize location options and smart defaults
  useEffect(() => {
    if (!isOpen) return;

    const options: LocationOption[] = [];
    
    // Add user's current location if available
    if (userLocation) {
      options.push({
        id: 'user-location',
        name: 'Your Current Location',
        coordinates: [userLocation.longitude, userLocation.latitude],
        isUserLocation: true
      });
    }

    // Add all landmarks
    landmarks.forEach((landmark, index) => {
      options.push({
        id: landmark.placeId || `landmark-${index}`,
        name: landmark.name,
        coordinates: landmark.coordinates
      });
    });

    setLocationOptions(options);

    // Smart defaults
    if (userLocation && !selectedOrigin) {
      setSelectedOrigin('user-location');
    }

    // Default departure time to current time + 15 minutes
    if (!departureTime) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      const timeString = now.toTimeString().slice(0, 5); // HH:MM format
      setDepartureTime(timeString);
    }
  }, [isOpen, landmarks, userLocation, selectedOrigin, departureTime]);

  // Get available destination options (exclude selected origin)
  const getDestinationOptions = () => {
    return locationOptions.filter(option => option.id !== selectedOrigin);
  };

  // Clear destination if it becomes invalid
  useEffect(() => {
    const destinationOptions = getDestinationOptions();
    if (selectedDestination && !destinationOptions.find(option => option.id === selectedDestination)) {
      setSelectedDestination('');
    }
  }, [selectedOrigin, selectedDestination]);

  const handlePlanRoute = async () => {
    const originOption = locationOptions.find(option => option.id === selectedOrigin);
    const destinationOption = locationOptions.find(option => option.id === selectedDestination);

    if (!originOption || !destinationOption || !departureTime) {
      return;
    }

    try {
      // Convert the departure time to the destination's local timezone
      const destinationTime = await convertToDestinationTime(
        departureTime,
        destinationOption.coordinates
      );
      
      console.log('🕐 Converted departure time:', {
        inputTime: departureTime,
        destinationCoordinates: destinationOption.coordinates,
        convertedTime: destinationTime
      });

      onPlanRoute(
        originOption.coordinates,
        destinationOption.coordinates,
        destinationTime,
        originOption.name,
        destinationOption.name
      );
    } catch (error) {
      console.error('❌ Failed to convert timezone:', error);
      // Fallback to current timezone if conversion fails
      const today = new Date();
      const [hours, minutes] = departureTime.split(':').map(Number);
      today.setHours(hours, minutes, 0, 0);
      
      onPlanRoute(
        originOption.coordinates,
        destinationOption.coordinates,
        today.toISOString(),
        originOption.name,
        destinationOption.name
      );
    }
  };

  const isFormValid = selectedOrigin && selectedDestination && departureTime;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Transit Route Planner</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Origin Selection */}
          <div className="space-y-2">
            <Label htmlFor="origin" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              Origin
            </Label>
            <Select value={selectedOrigin} onValueChange={setSelectedOrigin}>
              <SelectTrigger>
                <SelectValue placeholder="Select starting point" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-[60]">
                {locationOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <div className="flex items-center gap-2">
                      {option.isUserLocation ? (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      )}
                      {option.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Selection */}
          <div className="space-y-2">
            <Label htmlFor="destination" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-red-600" />
              Destination
            </Label>
            <Select value={selectedDestination} onValueChange={setSelectedDestination}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-[60]">
                {getDestinationOptions().map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <div className="flex items-center gap-2">
                      {option.isUserLocation ? (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      )}
                      {option.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Departure Time */}
          <div className="space-y-2">
            <Label htmlFor="departure-time" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Departure Time
            </Label>
            <Input
              id="departure-time"
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePlanRoute}
              disabled={!isFormValid || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Planning...
                </div>
              ) : (
                'Plan Transit Route'
              )}
            </Button>
          </div>
        </div>

        {/* Info Text */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Transit routes will show public transportation options including buses, trains, and walking connections.
            <br />
            <span className="text-xs mt-1 block font-medium">
              ⏰ Departure time will be interpreted as local time at your destination.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TransitRoutePlanner;