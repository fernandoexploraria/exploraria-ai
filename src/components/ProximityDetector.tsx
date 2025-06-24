
import React from 'react';
import { Landmark } from '@/data/landmarks';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';

interface ProximityDetectorProps {
  landmarks: Landmark[];
}

const ProximityDetector: React.FC<ProximityDetectorProps> = ({ landmarks }) => {
  const { userLocation } = useLocationTracking();
  const { proximitySettings } = useProximityAlerts();
  
  // Use the sorted landmarks hook with proximity settings integration
  // This will automatically filter by proximity range and show alerts
  useSortedLandmarks(
    userLocation,
    landmarks,
    proximitySettings?.default_distance,
    proximitySettings
  );

  // This component doesn't render anything - it just handles proximity detection
  return null;
};

export default ProximityDetector;
