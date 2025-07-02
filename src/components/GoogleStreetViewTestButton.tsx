
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, MapPin, Loader2 } from 'lucide-react';
import SimplifiedStreetViewViewer from './SimplifiedStreetViewViewer';
import { useStreetView } from '@/hooks/useStreetView';
import { TOP_LANDMARKS } from '@/data/topLandmarks';

const GoogleStreetViewTestButton: React.FC = () => {
  const [selectedLandmark, setSelectedLandmark] = useState<string>('');
  const [viewerState, setViewerState] = useState({
    isOpen: false,
    landmarkName: '',
    streetViewData: null,
    panoramaData: null,
    viewpoints: []
  });

  const { fetchStreetView, fetchPanoramaData, isLoading } = useStreetView();

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

  const handleTestStreetView = async (landmarkId: string) => {
    const landmark = testLandmarks.find(l => l.id === landmarkId);
    if (!landmark) return;

    console.log('🎯 Testing Street View for:', landmark.name);
    setSelectedLandmark(landmarkId);

    try {
      // Fetch both street view data and panorama data
      const [streetViewResult, panoramaResult] = await Promise.all([
        fetchStreetView(landmark).catch(() => null),
        fetchPanoramaData(landmark).catch(() => null)
      ]);

      console.log('📊 Street View Results:', {
        streetView: streetViewResult ? 'Available' : 'Not Available',
        panorama: panoramaResult?.isAvailable ? 'Available' : 'Not Available'
      });

      // Open the viewer with the results
      setViewerState({
        isOpen: true,
        landmarkName: landmark.name,
        streetViewData: streetViewResult,
        panoramaData: panoramaResult,
        viewpoints: streetViewResult ? [streetViewResult] : []
      });

    } catch (error) {
      console.error('❌ Error testing Street View:', error);
      
      // Still open viewer to show error state
      setViewerState({
        isOpen: true,
        landmarkName: landmark.name,
        streetViewData: null,
        panoramaData: null,
        viewpoints: []
      });
    } finally {
      setSelectedLandmark('');
    }
  };

  const closeViewer = () => {
    setViewerState({
      isOpen: false,
      landmarkName: '',
      streetViewData: null,
      panoramaData: null,
      viewpoints: []
    });
  };

  return (
    <>
      {/* Test Control Panel */}
      <div className="fixed bottom-4 left-4 z-50">
        <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm border">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Test Street View (Simplified)
          </h3>
          
          <div className="space-y-2">
            {testLandmarks.map((landmark) => {
              const isCurrentlyLoading = isLoading[landmark.id] || selectedLandmark === landmark.id;
              
              return (
                <Button
                  key={landmark.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestStreetView(landmark.id)}
                  disabled={isCurrentlyLoading}
                  className="w-full justify-start text-left"
                >
                  {isCurrentlyLoading ? (
                    <Loader2 className="h-3 w-3 mr-2 animate-spin flex-shrink-0" />
                  ) : (
                    <MapPin className="h-3 w-3 mr-2 flex-shrink-0" />
                  )}
                  <span className="truncate">
                    {isCurrentlyLoading ? 'Loading...' : landmark.name}
                  </span>
                </Button>
              );
            })}
          </div>
          
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500">
              ✨ Simplified viewer - no Google Maps API dependency
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Shows static Street View images via secure edge functions
            </p>
          </div>
        </div>
      </div>

      {/* Simplified Street View Viewer */}
      <SimplifiedStreetViewViewer
        isOpen={viewerState.isOpen}
        onClose={closeViewer}
        landmarkName={viewerState.landmarkName}
        streetViewData={viewerState.streetViewData}
        panoramaData={viewerState.panoramaData}
        viewpoints={viewerState.viewpoints}
        isLoading={selectedLandmark !== ''}
      />
    </>
  );
};

export default GoogleStreetViewTestButton;
