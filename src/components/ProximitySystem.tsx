
import React, { useState, useCallback } from 'react';
import { useProximityGeolocation } from '@/hooks/useProximityGeolocation';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import ProximityControls from './ProximityControls';
import ProximityAlertDrawer from './ProximityAlertDrawer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';
import { toast } from 'sonner';

interface ProximityAlert {
  landmark: any;
  distance: number;
  timestamp: number;
}

const ProximitySystem: React.FC = () => {
  // Settings state
  const [enabled, setEnabled] = useState(false);
  const [proximityDistance, setProximityDistance] = useState(100); // meters
  const [transportationMode, setTransportationMode] = useState<'walking' | 'driving'>('walking');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  
  // Alert state
  const [currentAlert, setCurrentAlert] = useState<ProximityAlert | null>(null);
  
  const { user } = useAuth();

  // Handle location updates
  const handleLocationUpdate = useCallback((location: any) => {
    console.log('Location updated:', location);
  }, []);

  // Handle proximity alerts
  const handleProximityAlert = useCallback((alert: ProximityAlert) => {
    console.log('Proximity alert triggered:', alert);
    setCurrentAlert(alert);
    
    // Show toast notification
    toast(`Discovered ${alert.landmark.name}!`, {
      description: `Found ${Math.round(alert.distance)}m away while ${transportationMode}`,
      duration: 4000,
    });
  }, [transportationMode]);

  // Initialize geolocation tracking
  const { location, error, permissionStatus, isTracking } = useProximityGeolocation({
    enabled,
    onLocationUpdate: handleLocationUpdate
  });

  // Initialize proximity alerts
  const { nearbyLandmarks } = useProximityAlerts({
    location,
    proximityDistance,
    transportationMode,
    enabled,
    onAlert: handleProximityAlert
  });

  // Handle "Learn More" from alert drawer
  const handleLearnMore = useCallback(async (alert: ProximityAlert) => {
    if (!user) {
      toast.error('Please sign in to save discoveries');
      return;
    }

    try {
      console.log('Storing proximity interaction...');
      
      // Generate AI description for the landmark
      const userInput = `I discovered ${alert.landmark.name} while ${transportationMode}`;
      const assistantResponse = `You discovered ${alert.landmark.name}! ${alert.landmark.description || 'This is an interesting landmark in the area.'}`;
      
      // Store the proximity interaction
      const response = await supabase.functions.invoke('store-interaction', {
        body: {
          userInput,
          assistantResponse,
          destination: alert.landmark.name,
          interactionType: 'proximity',
          landmarkCoordinates: alert.landmark.coordinates,
          landmarkImageUrl: alert.landmark.image,
          // Proximity-specific data
          discoveryDistance: Math.round(alert.distance),
          transportationMode,
          userLocation: location ? [location.longitude, location.latitude] : null
        }
      });

      if (response.error) {
        console.error('Error storing proximity interaction:', response.error);
        toast.error('Failed to save discovery');
      } else {
        console.log('Proximity interaction stored successfully');
        toast.success('Discovery saved to your travel log!');
      }
    } catch (error) {
      console.error('Error in handleLearnMore:', error);
      toast.error('Failed to save discovery');
    }
  }, [user, transportationMode, location]);

  // Handle alert dismissal
  const handleDismissAlert = useCallback(() => {
    setCurrentAlert(null);
  }, []);

  // Handle location click from alert drawer
  const handleLocationClick = useCallback((coordinates: [number, number]) => {
    // This would typically trigger map navigation
    console.log('Navigate to location:', coordinates);
    toast.info('Location feature would navigate to coordinates');
  }, []);

  // Show permission error if needed
  if (enabled && permissionStatus === 'denied') {
    return (
      <ProximityControls
        proximityDistance={proximityDistance}
        onProximityDistanceChange={setProximityDistance}
        transportationMode={transportationMode}
        onTransportationModeChange={setTransportationMode}
        units={units}
        onUnitsChange={setUnits}
        enabled={false}
        onEnabledChange={() => toast.error('Location permission required for proximity alerts')}
        isTracking={false}
        nearbyCount={0}
      />
    );
  }

  return (
    <>
      <ProximityControls
        proximityDistance={proximityDistance}
        onProximityDistanceChange={setProximityDistance}
        transportationMode={transportationMode}
        onTransportationModeChange={setTransportationMode}
        units={units}
        onUnitsChange={setUnits}
        enabled={enabled}
        onEnabledChange={setEnabled}
        isTracking={isTracking}
        nearbyCount={nearbyLandmarks.length}
      />

      <ProximityAlertDrawer
        alert={currentAlert}
        transportationMode={transportationMode}
        units={units}
        onLearnMore={handleLearnMore}
        onDismiss={handleDismissAlert}
        onLocationClick={handleLocationClick}
      />
    </>
  );
};

export default ProximitySystem;
