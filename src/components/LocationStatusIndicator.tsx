
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, MapPinOff, Loader2, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { usePermissionMonitor } from '@/hooks/usePermissionMonitor';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';

const LocationStatusIndicator: React.FC = () => {
  const { locationState, userLocation } = useLocationTracking();
  const { permissionState } = usePermissionMonitor();
  const { proximitySettings } = useProximityAlerts();

  // Enhanced logic to show warning state when proximity is enabled but permission denied
  const isProximityEnabled = proximitySettings?.is_enabled || false;
  const isRecoveryMode = isProximityEnabled && permissionState.state === 'denied';

  if (!locationState.isTracking && !locationState.isStartingUp && permissionState.state !== 'denied' && !isRecoveryMode) {
    return null; // Don't show anything when not tracking and no permission issues
  }

  const getStatusIcon = () => {
    // Show startup state first
    if (locationState.isStartingUp) {
      return <Loader2 className="h-3 w-3 animate-spin" />;
    }
    
    // Show recovery mode icon (warning) when proximity enabled but permission denied
    if (isRecoveryMode) {
      return <AlertCircle className="h-3 w-3 text-amber-600" />;
    }
    
    // Show permission denied first (highest priority)
    if (permissionState.state === 'denied') {
      return <AlertTriangle className="h-3 w-3 text-destructive" />;
    }
    
    if (locationState.error) {
      return <AlertTriangle className="h-3 w-3 text-destructive" />;
    }
    
    if (locationState.isTracking && !userLocation) {
      return <Loader2 className="h-3 w-3 animate-spin" />;
    }
    
    if (locationState.isTracking && userLocation) {
      return <CheckCircle className="h-3 w-3 text-primary" />;
    }
    
    return <MapPinOff className="h-3 w-3 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (locationState.isStartingUp) {
      return 'Starting...';
    }
    
    if (isRecoveryMode) {
      return 'Fix Required';
    }
    
    if (permissionState.state === 'denied') {
      return 'Permission Denied';
    }
    
    if (locationState.error) {
      return 'Location Error';
    }
    
    if (locationState.isTracking && !userLocation) {
      return 'Locating...';
    }
    
    if (locationState.isTracking && userLocation) {
      const accuracy = userLocation.accuracy ? `±${Math.round(userLocation.accuracy)}m` : '';
      return `Active ${accuracy}`;
    }
    
    return 'Location Off';
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (locationState.isStartingUp) return 'secondary';
    if (isRecoveryMode) return 'secondary'; // Warning state for recovery mode
    if (permissionState.state === 'denied' || locationState.error) return 'destructive';
    if (locationState.isTracking && userLocation) return 'default';
    if (locationState.isTracking) return 'secondary';
    return 'outline';
  };

  return (
    <Badge 
      variant={getStatusVariant()} 
      className={`flex items-center gap-1 text-xs ${isRecoveryMode ? 'border-amber-300 bg-amber-100 text-amber-800' : ''}`}
    >
      {getStatusIcon()}
      <span className="hidden sm:inline">{getStatusText()}</span>
    </Badge>
  );
};

export default LocationStatusIndicator;
