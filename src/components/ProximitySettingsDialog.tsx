
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
import { MapPin, Loader2, MessageSquare, Route, CreditCard } from 'lucide-react';
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
  const { proximitySettings, updateProximityEnabled, updateDistanceSetting } = useProximityAlerts();
  
  // Local state for smooth slider interactions
  const [localToastDistance, setLocalToastDistance] = useState<number>(100);
  const [localRouteDistance, setLocalRouteDistance] = useState<number>(250);
  const [localCardDistance, setLocalCardDistance] = useState<number>(50);
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize local distances when proximitySettings loads
  useEffect(() => {
    if (proximitySettings) {
      console.log('📏 ProximitySettingsDialog: Settings loaded, setting local distances');
      setLocalToastDistance(proximitySettings.toast_distance);
      setLocalRouteDistance(proximitySettings.route_distance);
      setLocalCardDistance(proximitySettings.card_distance);
    }
  }, [proximitySettings]);

  // Auto-save toast distance with debouncing
  useEffect(() => {
    if (!proximitySettings || localToastDistance === proximitySettings.toast_distance) return;

    const timeoutId = setTimeout(async () => {
      try {
        await updateDistanceSetting('toast_distance', localToastDistance);
        console.log('✅ Auto-saved toast distance:', localToastDistance);
      } catch (error) {
        console.error('❌ Error auto-saving toast distance:', error);
        toast({
          title: "Error",
          description: "Failed to save toast distance. Please try again.",
          variant: "destructive",
        });
        setLocalToastDistance(proximitySettings.toast_distance);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localToastDistance, proximitySettings?.toast_distance, updateDistanceSetting, toast]);

  // Auto-save route distance with debouncing
  useEffect(() => {
    if (!proximitySettings || localRouteDistance === proximitySettings.route_distance) return;

    const timeoutId = setTimeout(async () => {
      try {
        await updateDistanceSetting('route_distance', localRouteDistance);
        console.log('✅ Auto-saved route distance:', localRouteDistance);
      } catch (error) {
        console.error('❌ Error auto-saving route distance:', error);
        toast({
          title: "Error",
          description: "Failed to save route distance. Please try again.",
          variant: "destructive",
        });
        setLocalRouteDistance(proximitySettings.route_distance);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localRouteDistance, proximitySettings?.route_distance, updateDistanceSetting, toast]);

  // Auto-save card distance with debouncing
  useEffect(() => {
    if (!proximitySettings || localCardDistance === proximitySettings.card_distance) return;

    const timeoutId = setTimeout(async () => {
      try {
        await updateDistanceSetting('card_distance', localCardDistance);
        console.log('✅ Auto-saved card distance:', localCardDistance);
      } catch (error) {
        console.error('❌ Error auto-saving card distance:', error);
        toast({
          title: "Error",
          description: "Failed to save card distance. Please try again.",
          variant: "destructive",
        });
        setLocalCardDistance(proximitySettings.card_distance);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localCardDistance, proximitySettings?.card_distance, updateDistanceSetting, toast]);

  const handleEnabledChange = async (enabled: boolean) => {
    console.log('🎯 ProximitySettingsDialog: Toggle called with:', enabled);
    
    if (isUpdating) {
      console.log('⚠️ Already updating, ignoring toggle');
      return;
    }
    
    setIsUpdating(true);

    try {
      await updateProximityEnabled(enabled);
      console.log('✅ ProximitySettingsDialog: Successfully updated proximity to:', enabled);
      
      toast({
        title: enabled ? "Proximity Alerts Enabled" : "Proximity Alerts Disabled",
        description: "Settings saved successfully.",
      });
    } catch (error) {
      console.error('❌ ProximitySettingsDialog: Error updating proximity:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePresetDistance = (distance: number, type: 'toast' | 'route' | 'card') => {
    console.log('📏 ProximitySettingsDialog: Preset distance selected:', distance, 'for', type);
    
    switch (type) {
      case 'toast':
        setLocalToastDistance(distance);
        break;
      case 'route':
        setLocalRouteDistance(distance);
        break;
      case 'card':
        setLocalCardDistance(distance);
        break;
    }
  };

  // Get current state directly from proximitySettings (real-time synced)
  const isEnabled = proximitySettings?.is_enabled ?? false;

  console.log('🔍 ProximitySettingsDialog render state:', {
    isEnabled,
    proximitySettingsExists: !!proximitySettings,
    localToastDistance,
    localRouteDistance,
    localCardDistance,
    isUpdating
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[500px] overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle>Proximity Alert Settings</SheetTitle>
          <SheetDescription>
            Configure proximity alerts to get notified when you're near landmarks. Set different distances for different types of notifications.
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

          {/* Toast Distance Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Toast Notifications: {formatDistance(localToastDistance)}
              </div>
            </div>
            
            <Slider
              min={25}
              max={500}
              step={25}
              value={[localToastDistance]}
              onValueChange={(value) => setLocalToastDistance(value[0])}
              className="w-full"
            />
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {[25, 50, 100, 200, 300].map((distance) => (
                <Badge
                  key={`toast-${distance}`}
                  variant={localToastDistance === distance ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => handlePresetDistance(distance, 'toast')}
                >
                  {formatDistance(distance)}
                </Badge>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              Close-range notifications for immediate awareness (25m - 500m)
            </div>
          </div>

          {/* Route Distance Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium flex items-center gap-2">
                <Route className="h-4 w-4" />
                Route Visualization: {formatDistance(localRouteDistance)}
              </div>
            </div>
            
            <Slider
              min={100}
              max={1000}
              step={50}
              value={[localRouteDistance]}
              onValueChange={(value) => setLocalRouteDistance(value[0])}
              className="w-full"
            />
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {[150, 250, 400, 600, 800].map((distance) => (
                <Badge
                  key={`route-${distance}`}
                  variant={localRouteDistance === distance ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => handlePresetDistance(distance, 'route')}
                >
                  {formatDistance(distance)}
                </Badge>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              Medium-range for route planning and navigation (100m - 1km)
            </div>
          </div>

          {/* Card Distance Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Floating Cards: {formatDistance(localCardDistance)}
              </div>
            </div>
            
            <Slider
              min={25}
              max={300}
              step={25}
              value={[localCardDistance]}
              onValueChange={(value) => setLocalCardDistance(value[0])}
              className="w-full"
            />
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {[25, 50, 100, 150, 200].map((distance) => (
                <Badge
                  key={`card-${distance}`}
                  variant={localCardDistance === distance ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => handlePresetDistance(distance, 'card')}
                >
                  {formatDistance(distance)}
                </Badge>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              Very close range for detailed information cards (25m - 300m)
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            <strong>Note:</strong> All changes save automatically. Make sure location permissions are enabled for proximity alerts to work.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProximitySettingsDialog;
