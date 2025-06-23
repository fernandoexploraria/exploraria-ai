
import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Save, MapPin } from 'lucide-react';
import { formatDistance } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
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
  const { proximitySettings, updateProximityEnabled, updateDefaultDistance, isSaving } = useProximityAlerts();
  
  // Local form state
  const [formEnabled, setFormEnabled] = useState(false);
  const [formDistance, setFormDistance] = useState(50);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form state when settings load or dialog opens
  useEffect(() => {
    if (proximitySettings && open) {
      setFormEnabled(proximitySettings.is_enabled);
      setFormDistance(proximitySettings.default_distance);
      setHasChanges(false);
    }
  }, [proximitySettings, open]);

  // Detect changes
  useEffect(() => {
    if (proximitySettings) {
      const enabledChanged = formEnabled !== proximitySettings.is_enabled;
      const distanceChanged = formDistance !== proximitySettings.default_distance;
      setHasChanges(enabledChanged || distanceChanged);
    }
  }, [formEnabled, formDistance, proximitySettings]);

  const handleEnabledChange = (enabled: boolean) => {
    setFormEnabled(enabled);
  };

  const handleDistanceChange = (value: number[]) => {
    setFormDistance(value[0]);
  };

  const handlePresetDistance = (distance: number) => {
    setFormDistance(distance);
  };

  const handleSave = async () => {
    if (!proximitySettings) return;

    try {
      // Save both settings
      await Promise.all([
        updateProximityEnabled(formEnabled),
        updateDefaultDistance(formDistance)
      ]);

      setHasChanges(false);
      
      if (formEnabled && !proximitySettings.is_enabled) {
        toast({
          title: "Proximity Alerts Enabled",
          description: "Settings saved successfully. Location tracking will begin automatically.",
        });
      } else if (!formEnabled && proximitySettings.is_enabled) {
        toast({
          title: "Proximity Alerts Disabled",
          description: "Settings saved successfully.",
        });
      } else {
        toast({
          title: "Settings Updated",
          description: `Default distance set to ${formatDistance(formDistance)}.`,
        });
      }
    } catch (error) {
      console.error('Error saving proximity settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    if (proximitySettings) {
      setFormEnabled(proximitySettings.is_enabled);
      setFormDistance(proximitySettings.default_distance);
      setHasChanges(false);
    }
  };

  if (!proximitySettings) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[500px]">
          <div className="flex items-center justify-center p-8">
            <span className="text-muted-foreground">Loading settings...</span>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[500px] overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle>Proximity Alert Settings</SheetTitle>
          <SheetDescription>
            Configure proximity alerts to get notified when you're near landmarks.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Master Enable/Disable Toggle */}
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="text-base font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Enable Proximity Alerts
                {hasChanges && (
                  <Badge variant="outline" className="text-xs">
                    {formEnabled !== proximitySettings.is_enabled 
                      ? (formEnabled ? 'Will Enable' : 'Will Disable')
                      : 'Modified'
                    }
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Turn on proximity alerts for landmarks (requires location access)
              </div>
            </div>
            <Switch
              checked={formEnabled}
              onCheckedChange={handleEnabledChange}
              disabled={isSaving}
            />
          </div>

          {/* Distance Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium">
                Default Alert Distance: {formatDistance(formDistance)}
              </div>
              {hasChanges && formDistance !== proximitySettings.default_distance && (
                <Badge variant="outline" className="text-xs">
                  Changed
                </Badge>
              )}
            </div>
            
            <Slider
              min={25}
              max={2000}
              step={25}
              value={[formDistance]}
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
                  variant={formDistance === distance ? "default" : "outline"}
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

          {/* Save/Reset Buttons */}
          {hasChanges && (
            <div className="flex gap-3 p-4 bg-muted/30 rounded-lg border border-dashed">
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button 
                variant="outline" 
                onClick={handleReset}
                disabled={isSaving}
              >
                Reset
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProximitySettingsDialog;
