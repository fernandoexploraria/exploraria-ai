
import { useState } from 'react';
import { setTourLandmarks } from '@/data/tourLandmarks';
import { toast } from 'sonner';

interface EnhancedTour {
  tourId: string;
  destination: string;
  promptTemplate: string;
  landmarks: any[];
}

export const useEnhancedTourGenerator = () => {
  const [currentTour, setCurrentTour] = useState<EnhancedTour | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleTourGenerated = (tourId: string, destination: string, landmarks: any[] = []) => {
    console.log('Enhanced tour generated:', { tourId, destination, landmarkCount: landmarks.length });
    
    // Create tour object
    const tour: EnhancedTour = {
      tourId,
      destination,
      promptTemplate: '', // This will be set by the dialog
      landmarks
    };

    setCurrentTour(tour);

    // Convert landmarks to the format expected by the map system
    const mapLandmarks = landmarks.map(landmark => ({
      name: landmark.displayName,
      coordinates: [landmark.location.lng, landmark.location.lat] as [number, number],
      description: landmark.editorialSummary || `A ${landmark.types?.[0]?.replace(/_/g, ' ')} in ${destination}`
    }));

    // Set tour landmarks for map display
    if (mapLandmarks.length > 0) {
      setTourLandmarks(mapLandmarks);
      console.log('Set', mapLandmarks.length, 'tour landmarks on map');
      toast.success(`${mapLandmarks.length} landmarks added to your tour!`);
    }

    return tour;
  };

  const clearCurrentTour = () => {
    setCurrentTour(null);
  };

  return {
    currentTour,
    isGenerating,
    setIsGenerating,
    handleTourGenerated,
    clearCurrentTour
  };
};
