
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, MapPin } from 'lucide-react';
import GoogleStreetViewPanorama from './GoogleStreetViewPanorama';
import { useGoogleStreetViewPanorama } from '@/hooks/useGoogleStreetViewPanorama';
import { useStreetView } from '@/hooks/useStreetView';
import { TOP_LANDMARKS } from '@/data/topLandmarks';

const GoogleStreetViewTestButton: React.FC = () => {
  const [selectedLandmark, setSelectedLandmark] = useState<string>('');
  const { panoramaState, openPanorama, closePanorama } = useGoogleStreetViewPanorama();
  const { fetchPanoramaData, isLoading } = useStreetView();

  // Select 6 world-famous landmarks with excellent Street View coverage
  const testLandmarks = [
    TOP_LANDMARKS[0], // Eiffel Tower, Paris
    TOP_LANDMARKS[1], // Times Square, New York
    TOP_LANDMARKS[4], // Big Ben, London
    TOP_LANDMARKS[7], // Colosseum, Rome
    TOP_LANDMARKS[10], // Golden Gate Bridge, San Francisco
    TOP_LANDMARKS[19], // Empire State Building, New York
  ].map(landmark => ({
    id: `test-${landmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: landmark.name,
    coordinates: landmark.coordinates,
    description: landmark.description
  }));

  const handleTestPanorama = async (landmarkId: string) => {
    const landmark = testLandmarks.find(l => l.id === landmarkId);
    if (landmark) {
      console.log('🎯 Testing panorama for:', landmark.name);
      setSelectedLandmark(landmarkId);

      // Fetch panorama data from edge function
      const panoramaData = await fetchPanoramaData(landmark);
      
      if (panoramaData && panoramaData.isAvailable) {
        console.log('✅ Panorama available, opening viewer');
        openPanorama(landmark, panoramaData);
      } else {
        console.log('❌ Panorama not available for this location');
        // Still open the panorama component to show "not available" message
        openPanorama(landmark, null);
      }
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Test Button */}
      <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Test Street View Panorama
        </h3>
        
        <div className="space-y-2">
          {testLandmarks.map((landmark) => (
            <Button
              key={landmark.id}
              variant="outline"
              size="sm"
              onClick={() => handleTestPanorama(landmark.id)}
              disabled={isLoading[landmark.id]}
              className="w-full justify-start text-left"
            >
              <MapPin className="h-3 w-3 mr-2 flex-shrink-0" />
              <span className="truncate">
                {isLoading[landmark.id] ? 'Loading...' : landmark.name}
              </span>
            </Button>
          ))}
        </div>
        
        <p className="text-xs text-gray-500 mt-2">
          Click any landmark to test interactive Street View panorama
        </p>
      </div>

      {/* Panorama Modal */}
      <GoogleStreetViewPanorama
        isOpen={panoramaState.isOpen}
        onClose={closePanorama}
        location={panoramaState.location || { lat: 0, lng: 0 }}
        landmarkName={panoramaState.landmarkName}
        panoId={panoramaState.panoId}
        isAvailable={panoramaState.isAvailable}
      />
    </div>
  );
};

export default GoogleStreetViewTestButton;
