
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
  const { proximitySettings, updateProximityEnabled, updateDefaultDistance } = useProximityAlerts();
  
  // Simple local state - only for distance slider to enable smooth interaction
  const [localDistance, setLocalDistance] = useState<number>(50);
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize local distance when proximitySettings loads
  useEffect(() => {
    if (proximitySettings) {
      console.log('🎯 [DEBUG-PLAN-1] ProximitySettingsDialog: Settings loaded, initializing local distance:', {
        settingsDistance: proximitySettings.default_distance,
        previousLocalDistance: localDistance
      });
      setLocalDistance(proximitySettings.default_distance);
    }
  }, [proximitySettings]);

  // Auto-save distance with debouncing
  useEffect(() => {
    if (!proximitySettings) return;
    
    // Skip if the distance matches the current database value
    if (localDistance === proximitySettings.default_distance) {
      return;
    }

    console.log('🎯 [DEBUG-PLAN-1] ProximitySettingsDialog: Distance change detected, will save in 500ms:', {
      localDistance,
      currentDatabaseDistance: proximitySettings.default_distance,
      difference: localDistance - proximitySettings.default_distance
    });

    const timeoutId = setTimeout(async () => {
      try {
        console.log('🎯 [DEBUG-PLAN-1] ProximitySettingsDialog: Calling updateDefaultDistance with:', localDistance);
        await updateDefaultDistance(localDistance);
        console.log('✅ [DEBUG-PLAN-1] ProximitySettingsDialog: Successfully auto-saved distance:', localDistance);
      } catch (error) {
        console.error('❌ [DEBUG-PLAN-1] ProximitySettingsDialog: Error auto-saving distance:', error);
        toast({
          title: "Error",
          description: "Failed to save distance setting. Please try again.",
          variant: "destructive",
        });
        // Revert on error
        setLocalDistance(proximitySettings.default_distance);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localDistance, proximitySettings?.default_distance, updateDefaultDistance, toast]);

  // Simple toggle handler - EXACTLY like Map component
  const handleEnabledChange = async (enabled: boolean) => {
    console.log('🎯 [DEBUG-PLAN-1] ProximitySettingsDialog: Toggle called with:', enabled);
    
    if (isUpdating) {
      console.log('⚠️ Already updating, ignoring toggle');
      return;
    }
    
    setIsUpdating(true);

    try {
      console.log('📡 [DEBUG-PLAN-1] ProximitySettingsDialog: Calling updateProximityEnabled with:', enabled);
      // Direct call - exactly like Map component does
      await updateProximityEnabled(enabled);
      console.log('✅ [DEBUG-PLAN-1] ProximitySettingsDialog: Successfully updated proximity to:', enabled);
      
      toast({
        title: enabled ? "Proximity Alerts Enabled" : "Proximity Alerts Disabled",
        description: "Settings saved successfully.",
      });
    } catch (error) {
      console.error('❌ [DEBUG-PLAN-1] ProximitySettingsDialog: Error updating proximity:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDistanceChange = (value: number[]) => {
    const newDistance = value[0];
    console.log('📏 [DEBUG-PLAN-1] ProximitySettingsDialog: Distance slider changed to:', newDistance);
    setLocalDistance(newDistance);
  };

  const handlePresetDistance = (distance: number) => {
    console.log('📏 [DEBUG-PLAN-1] ProximitySettingsDialog: Preset distance selected:', distance);
    setLocalDistance(distance);
  };

  // Get current state directly from proximitySettings (real-time synced)
  const isEnabled = proximitySettings?.is_enabled ?? false;
  const currentDistance = proximitySettings?.default_distance ?? 50;

  console.log('🔍 [DEBUG-PLAN-1] ProximitySettingsDialog render state:', {
    isEnabled,
    currentDistance,
    localDistance,
    isUpdating,
    proximitySettingsExists: !!proximitySettings,
    settingsObject: proximitySettings
  });

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
                {isUpdating && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Turn on proximity alerts for landmarks (requires location access)
              </div>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={handleEnabledChange}
              disabled={isUpdating}
            />
          </div>

          {/* Distance Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium flex items-center gap-2">
                Default Alert Distance: {formatDistance(localDistance)}
              </div>
            </div>
            
            <Slider
              min={25}
              max={2000}
              step={25}
              value={[localDistance]}
              onValueChange={handleDistanceChange}
              className="w-full"
            />
            
            {/* Preset Distance Buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {PRESET_DISTANCES.map((distance) => (
                <Badge
                  key={distance}
                  variant={localDistance === distance ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => handlePresetDistance(distance)}
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
