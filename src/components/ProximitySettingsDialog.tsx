
import React from 'react';
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
import { Loader2, MapPin, Navigation, AlertTriangle, AlertCircle } from 'lucide-react';
import { formatDistance } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { usePermissionMonitor } from '@/hooks/usePermissionMonitor';
import { useProximityOnboarding } from '@/hooks/useProximityOnboarding';
import { useToast } from '@/hooks/use-toast';
import ProximityOnboardingDialog from './ProximityOnboardingDialog';

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
    updateProximityEnabled,
    updateDefaultDistance,
  } = useProximityAlerts();
  
  const { locationState, userLocation, startTrackingWithPermission, stopTracking } = useLocationTracking();
  const { permissionState, requestPermission, startMonitoring, stopMonitoring } = usePermissionMonitor();
  const {
    hasCompletedOnboarding,
    isOnboardingOpen,
    showOnboarding,
    hideOnboarding,
    markOnboardingComplete,
  } = useProximityOnboarding();

  const isRecoveryMode = proximitySettings?.is_enabled && permissionState.state === 'denied';

  // Start/stop permission monitoring based on dialog state and proximity settings
  useEffect(() => {
    if (open && proximitySettings?.is_enabled) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  }, [open, proximitySettings?.is_enabled, startMonitoring, stopMonitoring]);

  if (!proximitySettings) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[500px]">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading settings...</span>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const handleEnableProximityAlerts = async (enabled: boolean) => {
    if (enabled) {
      // Show onboarding for first-time users
      if (!hasCompletedOnboarding) {
        const shouldShowOnboarding = showOnboarding();
        if (shouldShowOnboarding) {
          return; // Don't proceed until onboarding is complete
        }
      }

      console.log('Enabling proximity alerts - checking permission...');
      
      // Always attempt to request permission when enabling
      const hasPermission = await requestPermission();
      
      if (!hasPermission) {
        console.log('Permission not granted');
        toast({
          title: "Location Permission Required",
          description: "Proximity alerts need location access to work. Please allow location access and try again.",
          variant: "destructive",
        });
        return;
      }

      console.log('Permission granted, updating settings and starting tracking...');
      
      try {
        await updateProximityEnabled(enabled);
        await startTrackingWithPermission();
        
        toast({
          title: "Proximity Alerts Enabled",
          description: "You'll now receive notifications when you're near landmarks.",
        });
      } catch (error) {
        console.error('Error enabling proximity alerts:', error);
        toast({
          title: "Error",
          description: "Failed to enable proximity alerts. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      try {
        console.log('Disabling proximity alerts...');
        stopTracking();
        await updateProximityEnabled(enabled);
        
        toast({
          title: "Proximity Alerts Disabled",
          description: "Location tracking has stopped.",
        });
      } catch (error) {
        console.error('Error disabling proximity alerts:', error);
      }
    }
  };

  const handleOnboardingContinue = async () => {
    markOnboardingComplete();
    
    // Proceed with enabling proximity alerts
    console.log('Onboarding complete, enabling proximity alerts...');
    
    const hasPermission = await requestPermission();
    
    if (!hasPermission) {
      console.log('Permission not granted after onboarding');
      toast({
        title: "Location Permission Required",
        description: "Please allow location access to enable proximity alerts.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateProximityEnabled(true);
      await startTrackingWithPermission();
      
      toast({
        title: "Proximity Alerts Enabled",
        description: "You'll now receive notifications when you're near landmarks.",
      });
    } catch (error) {
      console.error('Error enabling proximity alerts after onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to enable proximity alerts. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRetryPermission = async () => {
    if (proximitySettings.is_enabled) {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        await startTrackingWithPermission();
        toast({
          title: "Permission Granted",
          description: "Location tracking has been restored.",
        });
      }
    }
  };

  const handlePresetDistance = async (distance: number) => {
    try {
      await updateDefaultDistance(distance);
    } catch (error) {
      console.error('Error updating preset distance:', error);
    }
  };

  const handleDistanceChange = async (value: number[]) => {
    try {
      await updateDefaultDistance(value[0]);
    } catch (error) {
      console.error('Error updating distance:', error);
    }
  };

  const getLocationStatusInfo = () => {
    if (!proximitySettings.is_enabled) {
      return {
        icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
        text: "Location tracking disabled",
        variant: "outline" as const
      };
    }
    
    // Show permission-related errors first
    if (permissionState.state === 'denied') {
      return {
        icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
        text: "Permission denied",
        variant: "destructive" as const
      };
    }
    
    if (locationState.error) {
      return {
        icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
        text: "Location error",
        variant: "destructive" as const
      };
    }
    
    if (locationState.isTracking && !userLocation) {
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: "Getting location...",
        variant: "secondary" as const
      };
    }
    
    if (locationState.isTracking && userLocation) {
      const accuracy = userLocation.accuracy ? `±${Math.round(userLocation.accuracy)}m` : '';
      return {
        icon: <Navigation className="h-4 w-4 text-primary" />,
        text: `Active ${accuracy}`,
        variant: "default" as const
      };
    }
    
    return {
      icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
      text: "Inactive",
      variant: "outline" as const
    };
  };

  const locationStatus = getLocationStatusInfo();

  return (
    <>
      <ProximityOnboardingDialog
        open={isOnboardingOpen}
        onOpenChange={hideOnboarding}
        onContinue={handleOnboardingContinue}
      />

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto">
          <SheetHeader className="pb-6">
            <SheetTitle>Proximity Alert Settings</SheetTitle>
            <SheetDescription>
              Configure proximity alerts to get notified when you're near landmarks.
              {isSaving && (
                <span className="flex items-center mt-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Saving changes...
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            {/* DEBUG INFO - Temporary debugging display */}
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <div className="text-xs font-mono space-y-1">
                <div className="font-semibold text-yellow-800 mb-2">🔍 Debug Info:</div>
                <div>isTracking: <span className="font-bold">{String(locationState.isTracking)}</span></div>
                <div>isStartingUp: <span className="font-bold">{String(locationState.isStartingUp)}</span></div>
                <div>hasUserLocation: <span className="font-bold">{String(!!userLocation)}</span></div>
                <div>permissionState: <span className="font-bold">{permissionState.state}</span></div>
                <div>proximityEnabled: <span className="font-bold">{String(proximitySettings?.is_enabled)}</span></div>
                <div>error: <span className="font-bold">{locationState.error || 'none'}</span></div>
                {userLocation && (
                  <div>location: <span className="font-bold">
                    {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)} 
                    {userLocation.accuracy && ` (±${Math.round(userLocation.accuracy)}m)`}
                  </span></div>
                )}
              </div>
            </div>

            {/* Recovery Mode Warning Banner */}
            {isRecoveryMode && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-amber-800 mb-2">
                      🔧 Proximity Alerts Need Location Permission
                    </div>
                    <div className="text-sm text-amber-700 mb-3">
                      Your proximity alerts are enabled but can't work without location access. 
                      Use the "Fix Location Permission" button below to resolve this and start receiving notifications again.
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleRetryPermission}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Fix Location Permission
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Master Enable/Disable Toggle */}
            <div className={`flex flex-row items-center justify-between rounded-lg border p-4 ${isRecoveryMode ? 'border-amber-200 bg-amber-50/50' : ''}`}>
              <div className="space-y-0.5">
                <div className="text-base font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Enable Proximity Alerts
                  {isRecoveryMode && (
                    <Badge variant="secondary" className="text-xs border-amber-300 bg-amber-100 text-amber-800">
                      Needs Fix
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isRecoveryMode 
                    ? 'Enabled but requires location permission to work'
                    : 'Turn on proximity alerts for landmarks (requires location access)'
                  }
                </div>
              </div>
              <Switch
                checked={proximitySettings.is_enabled}
                onCheckedChange={handleEnableProximityAlerts}
                disabled={isSaving}
              />
            </div>

            {/* Location Tracking Status */}
            {proximitySettings.is_enabled && (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Location Tracking Status
                  </div>
                  <Badge variant={locationStatus.variant} className="flex items-center gap-1">
                    {locationStatus.icon}
                    {locationStatus.text}
                  </Badge>
                </div>
                
                {locationState.lastUpdate && (
                  <div className="text-xs text-muted-foreground">
                    Last updated: {locationState.lastUpdate.toLocaleTimeString()}
                  </div>
                )}
                
                {locationState.error && (
                  <div className="text-xs text-destructive mt-1">
                    {locationState.error}
                  </div>
                )}
              </div>
            )}

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

            {proximitySettings.is_enabled && (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  When proximity alerts are enabled, the system will:
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Automatically track your location in the background</li>
                  <li>• Send browser notifications when near landmarks</li>
                  <li>• Play sound alerts for proximity events</li>
                  <li>• Adjust tracking frequency based on your proximity to landmarks</li>
                  <li>• Respect battery life with smart polling intervals</li>
                </ul>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default ProximitySettingsDialog;
