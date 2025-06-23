
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
import { Save, MapPin, Loader2 } from 'lucide-react';
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
  
  // Local form state - initialize with database value if available
  const [formEnabled, setFormEnabled] = useState(false);
  const [formDistance, setFormDistance] = useState(proximitySettings?.default_distance ?? 50);
  const [hasEnabledChanges, setHasEnabledChanges] = useState(false);
  const [isDistanceSaving, setIsDistanceSaving] = useState(false);

  // Initialize form state when settings become available for the first time
  useEffect(() => {
    if (proximitySettings) {
      setFormEnabled(proximitySettings.is_enabled);
      setFormDistance(proximitySettings.default_distance);
      setHasEnabledChanges(false);
    }
  }, [proximitySettings]);

  // Re-initialize form state when dialog opens (if settings are already loaded)
  useEffect(() => {
    if (proximitySettings && open) {
      setFormEnabled(proximitySettings.is_enabled);
      setFormDistance(proximitySettings.default_distance);
      setHasEnabledChanges(false);
    }
  }, [proximitySettings, open]);

  // Detect enabled changes (only track toggle changes now)
  useEffect(() => {
    if (proximitySettings) {
      const enabledChanged = formEnabled !== proximitySettings.is_enabled;
      setHasEnabledChanges(enabledChanged);
    }
  }, [formEnabled, proximitySettings]);

  // Auto-save distance with debouncing
  useEffect(() => {
    if (!proximitySettings || formDistance === proximitySettings.default_distance) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsDistanceSaving(true);
      try {
        await updateDefaultDistance(formDistance);
      } catch (error) {
        console.error('Error auto-saving distance:', error);
        toast({
          title: "Error",
          description: "Failed to save distance setting. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsDistanceSaving(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formDistance, proximitySettings, updateDefaultDistance, toast]);

  const handleEnabledChange = (enabled: boolean) => {
    setFormEnabled(enabled);
  };

  const handleDistanceChange = (value: number[]) => {
    setFormDistance(value[0]);
  };

  const handlePresetDistance = (distance: number) => {
    setFormDistance(distance);
  };

  const handleSaveEnabled = async () => {
    if (!proximitySettings) return;

    try {
      await updateProximityEnabled(formEnabled);
      setHasEnabledChanges(false);
      
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
      }
    } catch (error) {
      console.error('Error saving proximity enabled setting:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResetEnabled = () => {
    if (proximitySettings) {
      setFormEnabled(proximitySettings.is_enabled);
      setHasEnabledChanges(false);
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
                {hasEnabledChanges && (
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
              <div className="text-base font-medium flex items-center gap-2">
                Default Alert Distance: {formatDistance(formDistance)}
                {isDistanceSaving && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            
            <Slider
              min={25}
              max={2000}
              step={25}
              value={[formDistance]}
              onValueChange={handleDistanceChange}
              className="w-full"
              disabled={isDistanceSaving}
            />
            
            {/* Preset Distance Buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {PRESET_DISTANCES.map((distance) => (
                <Badge
                  key={distance}
                  variant={formDistance === distance ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => !isDistanceSaving && handlePresetDistance(distance)}
                >
                  {formatDistance(distance)}
                </Badge>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              Choose the default distance for proximity alerts (25m - 2km range). 
              <span className="text-xs block mt-1 text-muted-foreground/70">
                Changes save automatically
              </span>
            </div>
          </div>

          {/* Save/Reset Buttons for Enable Toggle Only */}
          {hasEnabledChanges && (
            <div className="flex gap-3 p-4 bg-muted/30 rounded-lg border border-dashed">
              <Button 
                onClick={handleSaveEnabled} 
                disabled={isSaving}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Enable/Disable
              </Button>
              <Button 
                variant="outline" 
                onClick={handleResetEnabled}
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
