
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
import { MapPin, Loader2 } from 'lucide-react';
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
  
  // Local form state - initialize with database value if available, otherwise use defaults
  const [formEnabled, setFormEnabled] = useState(false);
  const [formDistance, setFormDistance] = useState(50);
  const [isDistanceSaving, setIsDistanceSaving] = useState(false);
  const [isToggleSaving, setIsToggleSaving] = useState(false);

  // Initialize form state when settings become available for the first time
  useEffect(() => {
    if (proximitySettings) {
      setFormEnabled(proximitySettings.is_enabled);
      setFormDistance(proximitySettings.default_distance);
    }
  }, [proximitySettings]);

  // Re-initialize form state when dialog opens (if settings are already loaded)
  useEffect(() => {
    if (proximitySettings && open) {
      setFormEnabled(proximitySettings.is_enabled);
      setFormDistance(proximitySettings.default_distance);
    }
  }, [proximitySettings, open]);

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

  const handleEnabledChange = async (enabled: boolean) => {
    // Remove the guard condition - allow the function to work regardless of proximitySettings
    setFormEnabled(enabled);
    setIsToggleSaving(true);

    try {
      await updateProximityEnabled(enabled);
      
      // Update toast messages to handle cases where settings might not exist yet
      if (enabled) {
        toast({
          title: "Proximity Alerts Enabled",
          description: "Settings saved successfully. Location tracking will begin automatically.",
        });
      } else {
        toast({
          title: "Proximity Alerts Disabled",
          description: "Settings saved successfully.",
        });
      }
    } catch (error) {
      console.error('Error saving proximity enabled setting:', error);
      // Revert the local state on error - use current proximitySettings value or false as fallback
      setFormEnabled(proximitySettings?.is_enabled ?? false);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsToggleSaving(false);
    }
  };

  const handleDistanceChange = (value: number[]) => {
    setFormDistance(value[0]);
  };

  const handlePresetDistance = (distance: number) => {
    setFormDistance(distance);
  };

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
                {isToggleSaving && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Turn on proximity alerts for landmarks (requires location access)
              </div>
            </div>
            <Switch
              checked={formEnabled}
              onCheckedChange={handleEnabledChange}
              disabled={isToggleSaving || isSaving}
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
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProximitySettingsDialog;
