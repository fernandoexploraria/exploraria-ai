
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
  
  // Simple local state - only for distance slider to enable smooth interaction
  const [localDistance, setLocalDistance] = useState<number>(50);
  const [isToggleSaving, setIsToggleSaving] = useState(false);
  const [isDistanceSaving, setIsDistanceSaving] = useState(false);

  // Initialize local distance when proximitySettings loads
  useEffect(() => {
    if (proximitySettings) {
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

    const timeoutId = setTimeout(async () => {
      setIsDistanceSaving(true);
      try {
        await updateDefaultDistance(localDistance);
        console.log('✅ Successfully auto-saved distance:', localDistance);
      } catch (error) {
        console.error('❌ Error auto-saving distance:', error);
        toast({
          title: "Error",
          description: "Failed to save distance setting. Please try again.",
          variant: "destructive",
        });
        // Revert on error
        setLocalDistance(proximitySettings.default_distance);
      } finally {
        setIsDistanceSaving(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localDistance, proximitySettings?.default_distance, updateDefaultDistance, toast]);

  // Simple toggle handler - mirrors the Map component's approach
  const handleEnabledChange = async (enabled: boolean) => {
    console.log('🎯 Toggle proximity alerts to:', enabled);
    
    if (isToggleSaving) {
      console.log('⚠️ Toggle already in progress, ignoring');
      return;
    }
    
    setIsToggleSaving(true);

    try {
      // Direct database call - exactly like Map component does
      await updateProximityEnabled(enabled);
      console.log('✅ Successfully updated proximity enabled to:', enabled);
      
      toast({
        title: enabled ? "Proximity Alerts Enabled" : "Proximity Alerts Disabled",
        description: "Settings saved successfully.",
      });
    } catch (error) {
      console.error('❌ Error updating proximity enabled setting:', error);
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
    const newDistance = value[0];
    console.log('📏 Distance changed to:', newDistance);
    setLocalDistance(newDistance);
  };

  const handlePresetDistance = (distance: number) => {
    console.log('📏 Preset distance selected:', distance);
    setLocalDistance(distance);
  };

  // Get current state directly from proximitySettings (real-time synced)
  const isEnabled = proximitySettings?.is_enabled ?? false;
  const currentDistance = proximitySettings?.default_distance ?? 50;

  console.log('🔍 ProximitySettingsDialog render state:', {
    isEnabled,
    currentDistance,
    localDistance,
    isToggleSaving,
    isDistanceSaving,
    isSaving
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
                {isToggleSaving && (
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
              disabled={isToggleSaving || isSaving}
            />
          </div>

          {/* Distance Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium flex items-center gap-2">
                Default Alert Distance: {formatDistance(localDistance)}
                {isDistanceSaving && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            
            <Slider
              min={25}
              max={2000}
              step={25}
              value={[localDistance]}
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
                  variant={localDistance === distance ? "default" : "outline"}
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
