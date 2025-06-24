
import { useMemo, useEffect, useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, formatDistance } from '@/utils/proximityUtils';
import { useToast } from '@/hooks/use-toast';

interface LandmarkWithDistance {
  landmark: Landmark;
  distance: number;
}

export const useSortedLandmarks = (
  userLocation: UserLocation | null,
  landmarks: Landmark[],
  maxDistance?: number
): LandmarkWithDistance[] => {
  const { toast } = useToast();
  const [previousClosestId, setPreviousClosestId] = useState<string | null>(null);

  const sortedLandmarks = useMemo(() => {
    if (!userLocation || landmarks.length === 0) {
      return [];
    }

    const landmarksWithDistance = landmarks.map(landmark => {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        landmark.coordinates[1], // latitude
        landmark.coordinates[0]  // longitude
      );

      return {
        landmark,
        distance
      };
    });

    // Filter by distance if maxDistance is provided
    const filteredLandmarks = maxDistance 
      ? landmarksWithDistance.filter(item => item.distance <= maxDistance)
      : landmarksWithDistance;

    // Sort by distance (ascending)
    return filteredLandmarks.sort((a, b) => a.distance - b.distance);
  }, [userLocation, landmarks, maxDistance]);

  // Show toast only when closest landmark changes
  useEffect(() => {
    if (userLocation && sortedLandmarks.length > 0) {
      const closestLandmark = sortedLandmarks[0];
      
      // Only show toast if the closest landmark ID is different from the previous one
      if (closestLandmark.landmark.id !== previousClosestId) {
        toast({
          title: "Closest Landmark",
          description: `${closestLandmark.landmark.name} - ${formatDistance(closestLandmark.distance)}`,
        });
        
        // Update the stored ID to the current closest landmark
        setPreviousClosestId(closestLandmark.landmark.id);

        // Add marker to map for the closest landmark
        if ((window as any).navigateToMapCoordinates) {
          // Create a simple green marker element
          const markerElement = document.createElement('div');
          markerElement.className = 'w-4 h-4 rounded-full bg-green-400 border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125';
          markerElement.style.transition = 'background-color 0.3s, transform 0.3s';

          // Access map through the global reference and add marker
          const mapInstance = (window as any).map?.current;
          if (mapInstance && (window as any).mapboxgl) {
            const marker = new (window as any).mapboxgl.Marker(markerElement)
              .setLngLat(closestLandmark.landmark.coordinates)
              .addTo(mapInstance);

            // Store in navigation markers array if it exists
            if ((window as any).navigationMarkers) {
              (window as any).navigationMarkers.current.push({ marker, interaction: null });
            }
          }
        }
      }
    }
  }, [userLocation, sortedLandmarks, toast, previousClosestId]);

  return sortedLandmarks;
};
