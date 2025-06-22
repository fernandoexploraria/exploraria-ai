
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PersonStanding, Car, MapPin, X, Heart, Share2 } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

interface ProximityAlert {
  landmark: any;
  distance: number;
  timestamp: number;
}

interface ProximityAlertDrawerProps {
  alert: ProximityAlert | null;
  transportationMode: 'walking' | 'driving';
  units: 'metric' | 'imperial';
  onLearnMore: (alert: ProximityAlert) => void;
  onDismiss: () => void;
  onLocationClick?: (coordinates: [number, number]) => void;
}

const ProximityAlertDrawer: React.FC<ProximityAlertDrawerProps> = ({
  alert,
  transportationMode,
  units,
  onLearnMore,
  onDismiss,
  onLocationClick
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!alert) return null;

  const { landmark, distance } = alert;

  // Format distance based on units
  const formatDistance = (meters: number) => {
    if (units === 'imperial') {
      const feet = Math.round(meters * 3.28084);
      if (feet > 1000) {
        const miles = (feet / 5280).toFixed(1);
        return `${miles} mi`;
      }
      return `${feet} ft`;
    }
    
    if (meters >= 1000) {
      const km = (meters / 1000).toFixed(1);
      return `${km} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const handleLearnMore = () => {
    onLearnMore(alert);
    setIsExpanded(true);
  };

  const handleLocationClick = () => {
    if (onLocationClick && landmark.coordinates) {
      onLocationClick([landmark.coordinates[0], landmark.coordinates[1]]);
    }
  };

  return (
    <Drawer open={!!alert} onOpenChange={(open) => !open && onDismiss()}>
      <DrawerContent className="bg-gray-900 border-gray-700 max-h-[80vh]">
        <DrawerTitle className="sr-only">
          Proximity Discovery: {landmark.name}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          You discovered {landmark.name} while {transportationMode}. Distance: {formatDistance(distance)}.
        </DrawerDescription>

        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/20 p-2 rounded-full">
                {transportationMode === 'walking' ? (
                  <PersonStanding className="h-5 w-5 text-green-400" />
                ) : (
                  <Car className="h-5 w-5 text-green-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Discovery Alert!</h3>
                <p className="text-sm text-gray-400">
                  Found while {transportationMode} • {formatDistance(distance)} away
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Landmark Info */}
          <div className="space-y-3">
            <h4 className="text-xl font-bold text-white">{landmark.name}</h4>
            
            {landmark.image && (
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={landmark.image}
                  alt={landmark.name}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            )}

            {/* Basic Description */}
            <p className="text-gray-300 text-sm leading-relaxed">
              You're near {landmark.name}! This landmark is located {formatDistance(distance)} from your current position.
            </p>

            {/* Quick Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleLearnMore}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Learn More
              </Button>
              <Button
                variant="outline"
                onClick={onDismiss}
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Dismiss
              </Button>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="space-y-4 pt-4 border-t border-gray-700">
                {landmark.description && (
                  <div>
                    <h5 className="font-medium text-white mb-2">About</h5>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {landmark.description}
                    </p>
                  </div>
                )}

                {/* Additional Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLocationClick}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Show on Map
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Favorite
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ProximityAlertDrawer;
