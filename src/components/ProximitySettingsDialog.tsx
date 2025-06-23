
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
import { Loader2, MapPin } from 'lucide-react';
import { formatDistance, requestGeolocationPermission } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useToast } from '@/hooks/use-toast';

interface ProximitySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_DISTANCES = [50, 100, 250, 500, 1000]; // Updated presets starting with 50m

const ProximitySettingsDialog: React.FC<ProximitySettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { 
    proximitySettings, 
    isSaving,
    updateIsEnabled,
    updateDefaultDistance,
    updateNotificationEnabled,
    updateSoundEnabled,
  } = useProximityAlerts();

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
      // Request geolocation permission when enabling proximity alerts
      const hasPermission = await requestGeolocationPermission();
      
      if (!hasPermission) {
        toast({
          title: "Location Permission Required",
          description: "Please allow location access to use proximity alerts. You can enable it in your browser settings.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Location Access Granted",
        description: "Proximity alerts are now enabled. You'll be notified when you're near landmarks.",
      });
    }

    updateIsEnabled(enabled);
  };

  const handlePresetDistance = (distance: number) => {
    updateDefaultDistance(distance);
  };

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
                Turn on proximity alerts for landmarks (requires location access)
              </div>
            </div>
            <Switch
              checked={proximitySettings.is_enabled}
              onCheckedChange={handleEnableProximityAlerts}
              disabled={isSaving}
            />
          </div>

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
              onValueChange={(value) => updateDefaultDistance(value[0])}
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

          {/* Notification Settings */}
          <div className="space-y-4">
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="text-base font-medium">
                  Browser Notifications
                </div>
                <div className="text-sm text-muted-foreground">
                  Show notifications in your browser
                </div>
              </div>
              <Switch
                checked={proximitySettings.notification_enabled}
                onCheckedChange={updateNotificationEnabled}
                disabled={isSaving}
              />
            </div>

            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="text-base font-medium">
                  Sound Alerts
                </div>
                <div className="text-sm text-muted-foreground">
                  Play sound when alerts are triggered
                </div>
              </div>
              <Switch
                checked={proximitySettings.sound_enabled}
                onCheckedChange={updateSoundEnabled}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProximitySettingsDialog;
