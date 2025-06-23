
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
import { Loader2 } from 'lucide-react';
import { formatDistance } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';

interface ProximitySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_DISTANCES = [100, 250, 500, 1000, 2000]; // meters

const ProximitySettingsDialog: React.FC<ProximitySettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
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
              <div className="text-base font-medium">
                Enable Proximity Alerts
              </div>
              <div className="text-sm text-muted-foreground">
                Turn on proximity alerts for landmarks
              </div>
            </div>
            <Switch
              checked={proximitySettings.is_enabled}
              onCheckedChange={updateIsEnabled}
              disabled={isSaving}
            />
          </div>

          {/* Distance Selection */}
          <div className="space-y-4">
            <div className="text-base font-medium">
              Default Alert Distance: {formatDistance(proximitySettings.default_distance)}
            </div>
            
            <Slider
              min={50}
              max={5000}
              step={50}
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
              Choose the default distance for proximity alerts (in meters)
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
