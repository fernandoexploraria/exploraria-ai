
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
import { MapPin, Loader2, MessageSquare, Eye, CreditCard, AlertTriangle } from 'lucide-react';
import { formatDistance } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useToast } from '@/hooks/use-toast';

interface ProximitySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidationError {
  field: 'notification' | 'outer' | 'card';
  message: string;
}

const MINIMUM_GAP = 25; // minimum gap in meters between card and notification
const NOTIFICATION_OUTER_GAP = 50; // minimum gap between notification and outer distance

const ProximitySettingsDialog: React.FC<ProximitySettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { proximitySettings, updateDistanceSetting } = useProximityAlerts();
  
  // Local state for smooth slider interactions - initialize with null to wait for settings
  const [localNotificationDistance, setLocalNotificationDistance] = useState<number | null>(null);
  const [localOuterDistance, setLocalOuterDistance] = useState<number | null>(null);
  const [localCardDistance, setLocalCardDistance] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Initialize local distances when proximitySettings loads
  useEffect(() => {
    if (proximitySettings) {
      console.log('📏 ProximitySettingsDialog: Settings loaded, setting local distances');
      setLocalNotificationDistance(proximitySettings.notification_distance);
      setLocalOuterDistance(proximitySettings.outer_distance);
      setLocalCardDistance(proximitySettings.card_distance);
    }
  }, [proximitySettings]);

  // Enhanced validation function with refined hierarchy: outer_distance ≥ notification_distance + 50m ≥ card_distance + 25m
  const validateDistances = (outer: number, notification: number, card: number): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // Check minimum gaps between tiers with refined hierarchy
    if (outer < notification + NOTIFICATION_OUTER_GAP) {
      errors.push({
        field: 'outer',
        message: `Outer distance must be at least ${NOTIFICATION_OUTER_GAP}m greater than notification distance`
      });
    }
    
    if (notification < card + MINIMUM_GAP) {
      errors.push({
        field: 'notification',
        message: `Notification distance must be at least ${MINIMUM_GAP}m greater than card distance`
      });
    }
    
    return errors;
  };

  // Update validation errors when distances change
  useEffect(() => {
    if (localOuterDistance !== null && localNotificationDistance !== null && localCardDistance !== null) {
      const errors = validateDistances(localOuterDistance, localNotificationDistance, localCardDistance);
      setValidationErrors(errors);
    }
  }, [localOuterDistance, localNotificationDistance, localCardDistance]);

  // Auto-save notification distance with validation
  useEffect(() => {
    if (!proximitySettings || localNotificationDistance === null || localNotificationDistance === proximitySettings.notification_distance) return;
    
    if (localOuterDistance === null || localCardDistance === null) return;
    
    const errors = validateDistances(localOuterDistance, localNotificationDistance, localCardDistance);
    if (errors.length > 0) {
      console.log('⚠️ Validation errors prevent saving notification distance:', errors);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        await updateDistanceSetting('notification_distance', localNotificationDistance);
        console.log('✅ Auto-saved notification distance:', localNotificationDistance);
      } catch (error) {
        console.error('❌ Error auto-saving notification distance:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save notification distance. Please try again.",
          variant: "destructive",
        });
        setLocalNotificationDistance(proximitySettings.notification_distance);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localNotificationDistance, localOuterDistance, localCardDistance, proximitySettings?.notification_distance, updateDistanceSetting, toast]);

  // Auto-save outer distance with validation
  useEffect(() => {
    if (!proximitySettings || localOuterDistance === null || localOuterDistance === proximitySettings.outer_distance) return;
    
    if (localNotificationDistance === null || localCardDistance === null) return;
    
    const errors = validateDistances(localOuterDistance, localNotificationDistance, localCardDistance);
    if (errors.length > 0) {
      console.log('⚠️ Validation errors prevent saving outer distance:', errors);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        await updateDistanceSetting('outer_distance', localOuterDistance);
        console.log('✅ Auto-saved outer distance:', localOuterDistance);
      } catch (error) {
        console.error('❌ Error auto-saving outer distance:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save outer distance. Please try again.",
          variant: "destructive",
        });
        setLocalOuterDistance(proximitySettings.outer_distance);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localNotificationDistance, localOuterDistance, localCardDistance, proximitySettings?.outer_distance, updateDistanceSetting, toast]);

  // Auto-save card distance with validation
  useEffect(() => {
    if (!proximitySettings || localCardDistance === null || localCardDistance === proximitySettings.card_distance) return;
    
    if (localNotificationDistance === null || localOuterDistance === null) return;
    
    const errors = validateDistances(localOuterDistance, localNotificationDistance, localCardDistance);
    if (errors.length > 0) {
      console.log('⚠️ Validation errors prevent saving card distance:', errors);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        await updateDistanceSetting('card_distance', localCardDistance);
        console.log('✅ Auto-saved card distance:', localCardDistance);
      } catch (error) {
        console.error('❌ Error auto-saving card distance:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save card distance. Please try again.",
          variant: "destructive",
        });
        setLocalCardDistance(proximitySettings.card_distance);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localNotificationDistance, localOuterDistance, localCardDistance, proximitySettings?.card_distance, updateDistanceSetting, toast]);

  // Helper to check if a field has validation errors
  const hasError = (field: 'notification' | 'outer' | 'card') => {
    return validationErrors.some(error => error.field === field);
  };

  // Helper to get validation message for a field
  const getErrorMessage = (field: 'notification' | 'outer' | 'card') => {
    const error = validationErrors.find(error => error.field === field);
    return error?.message;
  };

  // Enhanced auto-adjust distances to maintain hierarchy with refined gaps
  const handlePresetDistance = (distance: number, type: 'notification' | 'outer' | 'card') => {
    console.log('📏 ProximitySettingsDialog: Preset distance selected:', distance, 'for', type);
    
    if (localNotificationDistance === null || localOuterDistance === null || localCardDistance === null) return;
    
    switch (type) {
      case 'outer':
        setLocalOuterDistance(distance);
        // Auto-adjust notification and card if they become invalid with minimum gaps
        if (distance <= localNotificationDistance + NOTIFICATION_OUTER_GAP) {
          const newNotificationDistance = Math.max(25, distance - NOTIFICATION_OUTER_GAP);
          setLocalNotificationDistance(newNotificationDistance);
          if (newNotificationDistance <= localCardDistance + MINIMUM_GAP) {
            setLocalCardDistance(Math.max(25, newNotificationDistance - MINIMUM_GAP));
          }
        }
        break;
      case 'notification':
        setLocalNotificationDistance(distance);
        // Auto-adjust outer and card if they become invalid with minimum gaps
        if (distance >= localOuterDistance - NOTIFICATION_OUTER_GAP) {
          setLocalOuterDistance(distance + NOTIFICATION_OUTER_GAP);
        }
        if (distance <= localCardDistance + MINIMUM_GAP) {
          setLocalCardDistance(Math.max(25, distance - MINIMUM_GAP));
        }
        break;
      case 'card':
        setLocalCardDistance(distance);
        // Auto-adjust notification and outer if they become invalid with minimum gaps
        if (distance >= localNotificationDistance - MINIMUM_GAP) {
          const newNotificationDistance = distance + MINIMUM_GAP;
          setLocalNotificationDistance(newNotificationDistance);
          if (newNotificationDistance >= localOuterDistance - NOTIFICATION_OUTER_GAP) {
            setLocalOuterDistance(newNotificationDistance + NOTIFICATION_OUTER_GAP);
          }
        }
        break;
    }
  };

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

  // Proximity is always enabled now
  const isEnabled = true;

  // Don't render until we have loaded the settings and initialized local state
  if (!proximitySettings || localNotificationDistance === null || localOuterDistance === null || localCardDistance === null) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  console.log('🔍 ProximitySettingsDialog render state:', {
    isEnabled,
    proximitySettingsExists: !!proximitySettings,
    localNotificationDistance,
    localOuterDistance,
    localCardDistance,
    isUpdating,
    validationErrors: validationErrors.length
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[500px] overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle>Proximity Alert Settings</SheetTitle>
          <SheetDescription>
            Configure proximity alerts to get notified when you're near landmarks. Set different distances for different types of notifications.
            <br />
            <strong>Rule:</strong> Outer distance must be at least {NOTIFICATION_OUTER_GAP}m greater than notification distance, which must be at least {MINIMUM_GAP}m greater than card distance.
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

          {/* Validation Errors Summary */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                <AlertTriangle className="h-4 w-4" />
                Distance Validation Errors
              </div>
              <div className="space-y-1">
                {validationErrors.map((error, index) => (
                  <div key={index} className="text-sm text-destructive/90">
                    • {error.message}
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Changes will not be saved until all validation errors are resolved.
              </div>
            </div>
          )}

          {/* Distance Hierarchy Visualization */}
          <div className="bg-muted/30 p-3 rounded-lg">
            <div className="text-sm font-medium mb-2">Distance Hierarchy</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Card ({formatDistance(localCardDistance)})</span>
              <span>+{MINIMUM_GAP}m</span>
              <span>Notification ({formatDistance(localNotificationDistance)})</span>
              <span>+{NOTIFICATION_OUTER_GAP}m</span>
              <span>Outer ({formatDistance(localOuterDistance)})</span>
            </div>
          </div>

          {/* Outer Distance Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Outer Zone (Street View Prep): {formatDistance(localOuterDistance)}
                {hasError('outer') && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
            
            <Slider
              min={Math.max(150, localNotificationDistance + NOTIFICATION_OUTER_GAP)}
              max={1000}
              step={25}
              value={[localOuterDistance]}
              onValueChange={(value) => setLocalOuterDistance(value[0])}
              className="w-full"
            />
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {[200, 250, 300, 400, 500].filter(distance => distance >= localNotificationDistance + NOTIFICATION_OUTER_GAP).map((distance) => (
                <Badge
                  key={`outer-${distance}`}
                  variant={localOuterDistance === distance ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => handlePresetDistance(distance, 'outer')}
                >
                  {formatDistance(distance)}
                </Badge>
              ))}
            </div>
            
            {hasError('outer') && (
              <div className="text-sm text-destructive">
                {getErrorMessage('outer')}
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              Far range for Street View pre-loading (minimum {formatDistance(localNotificationDistance + NOTIFICATION_OUTER_GAP)} - 1000m)
            </div>
          </div>

          {/* Notification Distance Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notification Zone (Toasts): {formatDistance(localNotificationDistance)}
                {hasError('notification') && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
            
            <Slider
              min={Math.max(50, localCardDistance + MINIMUM_GAP)}
              max={Math.min(500, localOuterDistance - NOTIFICATION_OUTER_GAP)}
              step={25}
              value={[localNotificationDistance]}
              onValueChange={(value) => setLocalNotificationDistance(value[0])}
              className="w-full"
            />
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {[75, 100, 125, 150, 200].filter(distance => 
                distance >= localCardDistance + MINIMUM_GAP && 
                distance <= localOuterDistance - NOTIFICATION_OUTER_GAP
              ).map((distance) => (
                <Badge
                  key={`notification-${distance}`}
                  variant={localNotificationDistance === distance ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => handlePresetDistance(distance, 'notification')}
                >
                  {formatDistance(distance)}
                </Badge>
              ))}
            </div>
            
            {hasError('notification') && (
              <div className="text-sm text-destructive">
                {getErrorMessage('notification')}
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              Medium range for toast notifications ({formatDistance(localCardDistance + MINIMUM_GAP)} - {formatDistance(localOuterDistance - NOTIFICATION_OUTER_GAP)})
            </div>
          </div>

          {/* Card Distance Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Card Zone (Floating Cards): {formatDistance(localCardDistance)}
                {hasError('card') && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
            
            <Slider
              min={25}
              max={Math.min(200, localNotificationDistance - MINIMUM_GAP)}
              step={25}
              value={[localCardDistance]}
              onValueChange={(value) => setLocalCardDistance(value[0])}
              className="w-full"
            />
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              {[25, 50, 75, 100].filter(distance => distance <= localNotificationDistance - MINIMUM_GAP).map((distance) => (
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
            
            {hasError('card') && (
              <div className="text-sm text-destructive">
                {getErrorMessage('card')}
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              Very close range for detailed information cards (25m - {formatDistance(localNotificationDistance - MINIMUM_GAP)})
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            <strong>Note:</strong> All changes save automatically when validation passes. The refined hierarchy ensures: Street View prep happens first in the outer zone, notifications appear in the middle zone, and detailed cards show up close to landmarks. Make sure location permissions are enabled for proximity alerts to work.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProximitySettingsDialog;
