
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, MapPin } from 'lucide-react';
import GoogleStreetViewPanorama from './GoogleStreetViewPanorama';
import { useGoogleStreetViewPanorama } from '@/hooks/useGoogleStreetViewPanorama';
import { landmarks } from '@/data/landmarks';

const GoogleStreetViewTestButton: React.FC = () => {
  const [selectedLandmark, setSelectedLandmark] = useState<string>('');
  const { panoramaState, openPanorama, closePanorama } = useGoogleStreetViewPanorama();

  // Test landmarks in Mexico City
  const testLandmarks = landmarks.filter(landmark => 
    landmark.name.includes('Zócalo') || 
    landmark.name.includes('Palacio') ||
    landmark.name.includes('Catedral') ||
    landmark.name.includes('Torre')
  ).slice(0, 5);

  const handleTestPanorama = (landmarkId: string) => {
    const landmark = landmarks.find(l => l.id === landmarkId);
    if (landmark) {
      console.log('🎯 Testing panorama for:', landmark.name);
      setSelectedLandmark(landmarkId);
      openPanorama(landmark);
    }
  };

  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <strong>Google API Key Required:</strong> Please set VITE_GOOGLE_API_KEY in your environment variables.
      </div>
    );
  }

  // Check if Google Maps API is loaded
  if (typeof google === 'undefined' || !google.maps) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        <strong>Loading Google Maps API...</strong> Please wait for the API to load.
      </div>
    );
  }

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
              className="w-full justify-start text-left"
            >
              <MapPin className="h-3 w-3 mr-2 flex-shrink-0" />
              <span className="truncate">{landmark.name}</span>
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
        apiKey={apiKey}
      />
    </div>
  );
};

export default GoogleStreetViewTestButton;
