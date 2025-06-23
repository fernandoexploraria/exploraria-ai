
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';

const LocationStatusIndicator: React.FC = () => {
  const { locationState, userLocation } = useLocationTracking();
  const { proximitySettings } = useProximityAlerts();

  // Don't show anything if proximity alerts are disabled
  if (!proximitySettings?.is_enabled) {
    return null;
  }

  const getStatusIcon = () => {
    if (locationState.error) {
      return <AlertTriangle className="h-3 w-3 text-destructive" />;
    }
    
    if (locationState.isTracking && !userLocation) {
      return <Loader2 className="h-3 w-3 animate-spin" />;
    }
    
    if (locationState.isTracking && userLocation) {
      return <CheckCircle className="h-3 w-3 text-primary" />;
    }
    
    return <MapPin className="h-3 w-3 text-muted-foreground" />;
  };

  const getStatusText = () => {
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
    if (locationState.error) return 'destructive';
    if (locationState.isTracking && userLocation) return 'default';
    if (locationState.isTracking) return 'secondary';
    return 'outline';
  };

  return (
    <Badge 
      variant={getStatusVariant()} 
      className="flex items-center gap-1 text-xs"
    >
      {getStatusIcon()}
      <span className="hidden sm:inline">{getStatusText()}</span>
    </Badge>
  );
};

export default LocationStatusIndicator;
