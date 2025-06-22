
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { PersonStanding, Car, Settings, MapPin } from 'lucide-react';

interface ProximityControlsProps {
  proximityDistance: number;
  onProximityDistanceChange: (distance: number) => void;
  transportationMode: 'walking' | 'driving';
  onTransportationModeChange: (mode: 'walking' | 'driving') => void;
  units: 'metric' | 'imperial';
  onUnitsChange: (units: 'metric' | 'imperial') => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  isTracking: boolean;
  nearbyCount: number;
}

const ProximityControls: React.FC<ProximityControlsProps> = ({
  proximityDistance,
  onProximityDistanceChange,
  transportationMode,
  onTransportationModeChange,
  units,
  onUnitsChange,
  enabled,
  onEnabledChange,
  isTracking,
  nearbyCount
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Convert meters to feet for imperial display
  const getDisplayDistance = (meters: number) => {
    if (units === 'imperial') {
      return Math.round(meters * 3.28084);
    }
    return meters;
  };

  // Convert display distance back to meters
  const convertToMeters = (distance: number) => {
    if (units === 'imperial') {
      return Math.round(distance / 3.28084);
    }
    return distance;
  };

  const getDistanceOptions = () => {
    if (units === 'imperial') {
      return [
        { value: 160, label: '160 ft' },
        { value: 320, label: '320 ft' },
        { value: 650, label: '650 ft' },
        { value: 1000, label: '1,000 ft' }
      ];
    }
    return [
      { value: 50, label: '50m' },
      { value: 100, label: '100m' },
      { value: 200, label: '200m' },
      { value: 500, label: '500m' }
    ];
  };

  const handleDistanceChange = (value: string) => {
    const displayDistance = parseInt(value);
    const metersDistance = convertToMeters(displayDistance);
    onProximityDistanceChange(metersDistance);
  };

  // Get the current display value for the SelectValue component
  const getCurrentDisplayValue = () => {
    const displayDistance = getDisplayDistance(proximityDistance);
    const option = getDistanceOptions().find(opt => opt.value === displayDistance);
    return option ? option.label : `${displayDistance}${units === 'imperial' ? ' ft' : 'm'}`;
  };

  return (
    <div className="fixed bottom-20 left-4 z-40">
      <Card className="bg-gray-900/95 border-gray-700 backdrop-blur-sm">
        {/* Compact View */}
        {!isExpanded && (
          <div className="p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="text-white hover:bg-gray-800 p-2"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <div className="flex flex-col items-start text-xs">
                  <span className={enabled ? 'text-green-400' : 'text-gray-400'}>
                    Proximity {enabled ? 'ON' : 'OFF'}
                  </span>
                  {enabled && isTracking && nearbyCount > 0 && (
                    <span className="text-yellow-400">{nearbyCount} nearby</span>
                  )}
                </div>
                <Settings className="h-3 w-3 opacity-50" />
              </div>
            </Button>
          </div>
        )}

        {/* Expanded View */}
        {isExpanded && (
          <div className="p-4 space-y-4 min-w-[280px]">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-white" />
                <span className="text-white font-medium">Proximity Alerts</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Enable Alerts</span>
              <Toggle
                pressed={enabled}
                onPressedChange={onEnabledChange}
                className="data-[state=on]:bg-green-600 data-[state=on]:text-white"
              >
                {enabled ? 'ON' : 'OFF'}
              </Toggle>
            </div>

            {enabled && (
              <>
                {/* Transportation Mode */}
                <div className="space-y-2">
                  <span className="text-sm text-gray-300">Mode</span>
                  <div className="flex gap-2">
                    <Button
                      variant={transportationMode === 'walking' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onTransportationModeChange('walking')}
                      className="flex-1"
                    >
                      <PersonStanding className="h-4 w-4 mr-1" />
                      Walking
                    </Button>
                    <Button
                      variant={transportationMode === 'driving' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onTransportationModeChange('driving')}
                      className="flex-1"
                    >
                      <Car className="h-4 w-4 mr-1" />
                      Driving
                    </Button>
                  </div>
                </div>

                {/* Distance Selection */}
                <div className="space-y-2">
                  <span className="text-sm text-gray-300">Alert Distance</span>
                  <Select
                    value={getDisplayDistance(proximityDistance).toString()}
                    onValueChange={handleDistanceChange}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue placeholder={getCurrentDisplayValue()}>
                        {getCurrentDisplayValue()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 z-50">
                      {getDistanceOptions().map((option) => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value.toString()}
                          className="text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Units Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Units</span>
                  <div className="flex gap-2">
                    <Button
                      variant={units === 'metric' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onUnitsChange('metric')}
                      className="text-xs px-2"
                    >
                      Metric
                    </Button>
                    <Button
                      variant={units === 'imperial' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onUnitsChange('imperial')}
                      className="text-xs px-2"
                    >
                      Imperial
                    </Button>
                  </div>
                </div>

                {/* Status */}
                <div className="pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Status:</span>
                    <span className={isTracking ? 'text-green-400' : 'text-yellow-400'}>
                      {isTracking ? 'Tracking' : 'Starting...'}
                    </span>
                  </div>
                  {nearbyCount > 0 && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-gray-400">Nearby:</span>
                      <span className="text-yellow-400">{nearbyCount} landmarks</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProximityControls;
