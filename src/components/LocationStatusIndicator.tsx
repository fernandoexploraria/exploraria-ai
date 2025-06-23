
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, MapPinOff, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { usePermissionMonitor } from '@/hooks/usePermissionMonitor';

const LocationStatusIndicator: React.FC = () => {
  const { locationState, userLocation } = useLocationTracking();
  const { permissionState } = usePermissionMonitor();

  if (!locationState.isTracking && permissionState.state !== 'denied') {
    return null; // Don't show anything when not tracking and no permission issues
  }

  const getStatusIcon = () => {
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
      return `Tracking ${accuracy}`;
    }
    
    return 'Location Off';
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (permissionState.state === 'denied' || locationState.error) return 'destructive';
    if (locationState.isTracking && userLocation) return 'default';
    if (locationState.isTracking) return 'secondary';
    return 'outline';
  };

  return (
    <Badge variant={getStatusVariant()} className="flex items-center gap-1 text-xs">
      {getStatusIcon()}
      <span className="hidden sm:inline">{getStatusText()}</span>
    </Badge>
  );
};

export default LocationStatusIndicator;
