
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, MapPin } from 'lucide-react';
import GoogleStreetViewPanorama from './GoogleStreetViewPanorama';
import { useGoogleStreetViewPanorama } from '@/hooks/useGoogleStreetViewPanorama';
import { useStreetView } from '@/hooks/useStreetView';
import { landmarks } from '@/data/landmarks';

const GoogleStreetViewTestButton: React.FC = () => {
  const [selectedLandmark, setSelectedLandmark] = useState<string>('');
  const { panoramaState, openPanorama, closePanorama } = useGoogleStreetViewPanorama();
  const { fetchPanoramaData, isLoading } = useStreetView();

  // Test landmarks in Mexico City
  const testLandmarks = landmarks.filter(landmark => 
    landmark.name.includes('Zócalo') || 
    landmark.name.includes('Palacio') ||
    landmark.name.includes('Catedral') ||
    landmark.name.includes('Torre')
  ).slice(0, 5);

  const handleTestPanorama = async (landmarkId: string) => {
    const landmark = landmarks.find(l => l.id === landmarkId);
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
