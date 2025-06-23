import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Navigation, AlertTriangle } from 'lucide-react';
import { formatDistance, requestGeolocationPermission } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useToast } from '@/hooks/use-toast';

interface ProximitySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_DISTANCES = [50, 100, 250, 500, 1000];

const ProximitySettingsDialog: React.FC<ProximitySettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { 
    proximitySettings, 
    isSaving,
    updateProximityEnabled,
    updateDefaultDistance,
  } = useProximityAlerts();
  
  const { locationState, userLocation, startTrackingWithPermission } = useLocationTracking();

  if (!proximitySettings) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading settings...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleEnableProximityAlerts = async (enabled: boolean) => {
    if (enabled) {
      console.log('Requesting geolocation permission for proximity alerts...');
      
      // Request geolocation permission when enabling proximity alerts
      const hasPermission = await requestGeolocationPermission();
      
      if (!hasPermission) {
        console.log('Permission denied, showing error toast');
        toast({
          title: "Location Permission Required",
          description: "Please allow location access to use proximity alerts. You can enable it in your browser settings.",
          variant: "destructive",
        });
        return;
      }

      console.log('Permission granted, enabling proximity alerts...');
      
      try {
        // Update the proximity settings first
        await updateProximityEnabled(enabled);
        
        // Small delay to allow state to propagate
        setTimeout(async () => {
          // Start location tracking with permission already granted
          console.log('Starting location tracking after permission grant...');
          await startTrackingWithPermission();
        }, 100);
        
        toast({
          title: "Proximity Alerts Enabled",
          description: "You'll now receive notifications and sound alerts when you're near landmarks. Location tracking has started automatically.",
        });
      } catch (error) {
        console.error('Error enabling proximity alerts:', error);
        toast({
          title: "Error",
          description: "Failed to enable proximity alerts. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      try {
        await updateProximityEnabled(enabled);
        
        toast({
          title: "Proximity Alerts Disabled",
          description: "You won't receive any proximity notifications. Location tracking has stopped.",
        });
      } catch (error) {
        console.error('Error disabling proximity alerts:', error);
      }
    }
  };

  const handlePresetDistance = async (distance: number) => {
    try {
      await updateDefaultDistance(distance);
    } catch (error) {
      console.error('Error updating preset distance:', error);
    }
  };

  const handleDistanceChange = async (value: number[]) => {
    try {
      await updateDefaultDistance(value[0]);
    } catch (error) {
      console.error('Error updating distance:', error);
    }
  };

  const getLocationStatusInfo = () => {
    if (!proximitySettings.is_enabled) {
      return {
        icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
        text: "Location tracking disabled",
        variant: "outline" as const
      };
    }
    
    if (locationState.error) {
      return {
        icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
        text: "Location error",
        variant: "destructive" as const
      };
    }
    
    if (locationState.isTracking && !userLocation) {
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: "Getting location...",
        variant: "secondary" as const
      };
    }
    
    if (locationState.isTracking && userLocation) {
      const accuracy = userLocation.accuracy ? `±${Math.round(userLocation.accuracy)}m` : '';
      return {
        icon: <Navigation className="h-4 w-4 text-primary" />,
        text: `Active ${accuracy}`,
        variant: "default" as const
      };
    }
    
    return {
      icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
      text: "Inactive",
      variant: "outline" as const
    };
  };

  const locationStatus = getLocationStatusInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Proximity Alert Settings</DialogTitle>
          <DialogDescription>
            Configure proximity alerts to get notified when you're near landmarks.
            {isSaving && (
              <span className="flex items-center mt-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Saving changes...
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Master Enable/Disable Toggle */}
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="text-base font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Enable Proximity Alerts
              </div>
              <div className="text-sm text-muted-foreground">
                Turn on proximity alerts for landmarks (includes notifications and automatic location tracking)
              </div>
            </div>
            <Switch
              checked={proximitySettings.is_enabled}
              onCheckedChange={handleEnableProximityAlerts}
              disabled={isSaving}
            />
          </div>

          {/* Location Tracking Status */}
          {proximitySettings.is_enabled && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Location Tracking Status
                </div>
                <Badge variant={locationStatus.variant} className="flex items-center gap-1">
                  {locationStatus.icon}
                  {locationStatus.text}
                </Badge>
              </div>
              
              {locationState.lastUpdate && (
                <div className="text-xs text-muted-foreground">
                  Last updated: {locationState.lastUpdate.toLocaleTimeString()}
                </div>
              )}
              
              {locationState.error && (
                <div className="text-xs text-destructive mt-1">
                  {locationState.error}
                </div>
              )}
            </div>
          )}

          {/* Distance Selection */}
          <div className="space-y-4">
            <div className="text-base font-medium">
              Default Alert Distance: {formatDistance(proximitySettings.default_distance)}
            </div>
            
            <Slider
              min={25}
              max={2000}
              step={25}
              value={[proximitySettings.default_distance]}
              onValueChange={handleDistanceChange}
              className="w-full"
              disabled={isSaving}
            />
            
            {/* Preset Distance Buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {PRESET_DISTANCES.map((distance) => (
                <Badge
                  key={distance}
                  variant={proximitySettings.default_distance === distance ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => !isSaving && handlePresetDistance(distance)}
                >
                  {formatDistance(distance)}
                </Badge>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              Choose the default distance for proximity alerts (25m - 2km range)
            </div>
          </div>

          {proximitySettings.is_enabled && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                When proximity alerts are enabled, the system will:
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Automatically track your location in the background</li>
                <li>• Send browser notifications when near landmarks</li>
                <li>• Play sound alerts for proximity events</li>
                <li>• Adjust tracking frequency based on your proximity to landmarks</li>
                <li>• Respect battery life with smart polling intervals</li>
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProximitySettingsDialog;
