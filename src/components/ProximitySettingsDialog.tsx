
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Save, RotateCcw } from 'lucide-react';
import { formatDistance, requestGeolocationPermission } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useToast } from '@/hooks/use-toast';
import { ProximitySettings } from '@/types/proximityAlerts';

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
    saveProximitySettings,
  } = useProximityAlerts();

  // Local state for pending changes
  const [localSettings, setLocalSettings] = useState<ProximitySettings | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize local state when dialog opens or settings change
  useEffect(() => {
    if (proximitySettings) {
      setLocalSettings({ ...proximitySettings });
      setHasUnsavedChanges(false);
    }
  }, [proximitySettings, open]);

  // Check if there are unsaved changes
  useEffect(() => {
    if (!proximitySettings || !localSettings) {
      setHasUnsavedChanges(false);
      return;
    }

    const hasChanges = 
      localSettings.is_enabled !== proximitySettings.is_enabled ||
      localSettings.default_distance !== proximitySettings.default_distance ||
      localSettings.notification_enabled !== proximitySettings.notification_enabled ||
      localSettings.sound_enabled !== proximitySettings.sound_enabled;

    setHasUnsavedChanges(hasChanges);
  }, [localSettings, proximitySettings]);

  if (!proximitySettings || !localSettings) {
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

  const handleLocalSettingChange = (key: keyof ProximitySettings, value: any) => {
    if (!localSettings) return;

    setLocalSettings(prev => ({
      ...prev!,
      [key]: value,
    }));
  };

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
    }

    // Update local state
    const updatedSettings = { ...localSettings };
    updatedSettings.is_enabled = enabled;

    // When disabling proximity alerts, also disable notifications and sound
    if (!enabled) {
      updatedSettings.notification_enabled = false;
      updatedSettings.sound_enabled = false;
    }

    setLocalSettings(updatedSettings);
  };

  const handlePresetDistance = (distance: number) => {
    handleLocalSettingChange('default_distance', distance);
  };

  const handleSaveSettings = async () => {
    if (!localSettings) return;

    try {
      await saveProximitySettings(localSettings);
      
      if (localSettings.is_enabled && !proximitySettings.is_enabled) {
        toast({
          title: "Location Access Granted",
          description: "Proximity alerts are now enabled. You'll be notified when you're near landmarks.",
        });
      } else {
        toast({
          title: "Settings saved",
          description: "Your proximity alert settings have been updated.",
        });
      }
      
      // Close dialog after successful save
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleResetSettings = () => {
    if (proximitySettings) {
      setLocalSettings({ ...proximitySettings });
      setHasUnsavedChanges(false);
    }
  };

  const handleCloseDialog = () => {
    if (hasUnsavedChanges) {
      // Reset to original settings when closing with unsaved changes
      handleResetSettings();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Proximity Alert Settings
            {hasUnsavedChanges && (
              <span className="ml-2 text-sm font-normal text-orange-600">
                (Unsaved changes)
              </span>
            )}
          </DialogTitle>
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
              checked={localSettings.is_enabled}
              onCheckedChange={handleEnableProximityAlerts}
              disabled={isSaving}
            />
          </div>

          {/* Distance Selection */}
          <div className="space-y-4">
            <div className="text-base font-medium">
              Default Alert Distance: {formatDistance(localSettings.default_distance)}
            </div>
            
            <Slider
              min={25}
              max={2000}
              step={25}
              value={[localSettings.default_distance]}
              onValueChange={(value) => handleLocalSettingChange('default_distance', value[0])}
              className="w-full"
              disabled={isSaving}
            />
            
            {/* Preset Distance Buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {PRESET_DISTANCES.map((distance) => (
                <Badge
                  key={distance}
                  variant={localSettings.default_distance === distance ? "default" : "outline"}
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
                checked={localSettings.notification_enabled}
                onCheckedChange={(checked) => handleLocalSettingChange('notification_enabled', checked)}
                disabled={isSaving || !localSettings.is_enabled}
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
                checked={localSettings.sound_enabled}
                onCheckedChange={(checked) => handleLocalSettingChange('sound_enabled', checked)}
                disabled={isSaving || !localSettings.is_enabled}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleResetSettings}
            disabled={isSaving || !hasUnsavedChanges}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving || !hasUnsavedChanges}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProximitySettingsDialog;
