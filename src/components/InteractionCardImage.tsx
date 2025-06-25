
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useStreetView } from '@/hooks/useStreetView';
import StreetViewModal from './StreetViewModal';
import { Landmark } from '@/data/landmarks';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  interaction_type: string;
  landmark_coordinates: any;
  full_transcript: any;
}

interface InteractionCardImageProps {
  imageUrl: string;
  destination: string;
  userInput: string;
  interaction: Interaction;
}

const InteractionCardImage: React.FC<InteractionCardImageProps> = ({
  imageUrl,
  destination,
  userInput,
  interaction,
}) => {
  const [isStreetViewModalOpen, setIsStreetViewModalOpen] = useState(false);
  const [streetViewData, setStreetViewData] = useState(null);
  const [isLoadingStreetView, setIsLoadingStreetView] = useState(false);
  const { getStreetView } = useStreetView();

  // Convert interaction coordinates to Landmark format
  const landmarkFromInteraction: Landmark | null = React.useMemo(() => {
    if (!interaction.landmark_coordinates) return null;
    
    // Handle different coordinate formats
    let coordinates: [number, number];
    
    if (Array.isArray(interaction.landmark_coordinates)) {
      coordinates = interaction.landmark_coordinates as [number, number];
    } else if (interaction.landmark_coordinates.lng && interaction.landmark_coordinates.lat) {
      coordinates = [interaction.landmark_coordinates.lng, interaction.landmark_coordinates.lat];
    } else if (interaction.landmark_coordinates.longitude && interaction.landmark_coordinates.latitude) {
      coordinates = [interaction.landmark_coordinates.longitude, interaction.landmark_coordinates.latitude];
    } else {
      return null;
    }

    return {
      id: `interaction-${interaction.id}`,
      name: interaction.destination,
      coordinates,
      description: interaction.user_input || `Street View for ${interaction.destination}`
    };
  }, [interaction]);

  // Pre-load Street View data when component mounts
  useEffect(() => {
    if (landmarkFromInteraction) {
      const preloadStreetView = async () => {
        try {
          const data = await getStreetView(landmarkFromInteraction);
          if (data) {
            setStreetViewData(data);
            console.log(`✅ Street View pre-loaded for ${landmarkFromInteraction.name}`);
          }
        } catch (error) {
          console.log(`❌ Failed to pre-load Street View for ${landmarkFromInteraction.name}:`, error);
        }
      };

      preloadStreetView();
    }
  }, [landmarkFromInteraction, getStreetView]);

  const handleStreetViewClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!landmarkFromInteraction) {
      console.log('❌ No valid landmark data for Street View');
      return;
    }

    if (streetViewData) {
      // Use cached data
      setIsStreetViewModalOpen(true);
      return;
    }

    // Fetch Street View data
    setIsLoadingStreetView(true);
    try {
      console.log(`🔍 Fetching Street View for ${landmarkFromInteraction.name}`);
      const data = await getStreetView(landmarkFromInteraction);
      
      if (data) {
        setStreetViewData(data);
        setIsStreetViewModalOpen(true);
        console.log(`✅ Street View loaded for ${landmarkFromInteraction.name}`);
      } else {
        console.log(`❌ No Street View available for ${landmarkFromInteraction.name}`);
      }
    } catch (error) {
      console.error(`❌ Error loading Street View for ${landmarkFromInteraction.name}:`, error);
    } finally {
      setIsLoadingStreetView(false);
    }
  };

  const handleImageDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Download button clicked');

    try {
      // Check if we're on a native platform (mobile app or PWA with native capabilities)
      const isNativePlatform = Capacitor.isNativePlatform() || 
                              (Capacitor.getPlatform() === 'web' && 'serviceWorker' in navigator);

      if (isNativePlatform && Capacitor.isNativePlatform()) {
        console.log('Attempting native save...');
        
        // For native platforms, we would need a different plugin like @capacitor/filesystem
        // and @capacitor/share to save to gallery. For now, fall back to download.
        throw new Error('Native save not implemented yet, using fallback');
        
      } else {
        throw new Error('Not a native platform, using fallback');
      }
    } catch (error) {
      console.log('Using standard download:', error);
      
      // Standard download approach for all platforms
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `exploraria-${destination.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(url);
        console.log('Image downloaded successfully');
      } catch (downloadError) {
        console.error('Download failed:', downloadError);
      }
    }
  };

  return (
    <>
      <div className="mb-2 flex-shrink-0 relative">
        <img 
          src={imageUrl} 
          alt="Landmark" 
          className="w-full h-20 object-cover rounded"
        />
        
        {/* Street View Available Badge */}
        {streetViewData && (
          <div className="absolute top-1 left-1">
            <Badge variant="secondary" className="text-xs bg-blue-500/80 text-white border-0">
              Street View
            </Badge>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="absolute top-1 right-1 flex gap-1">
          {/* Street View Button */}
          {landmarkFromInteraction && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
              onClick={handleStreetViewClick}
              disabled={isLoadingStreetView}
              title={streetViewData ? "View Street View" : "Load Street View"}
            >
              <Eye className={`w-3 h-3 text-white ${isLoadingStreetView ? 'animate-pulse' : ''}`} />
            </Button>
          )}
          
          {/* Download Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
            onClick={handleImageDownload}
            title="Download image"
          >
            <Download className="w-3 h-3 text-white" />
          </Button>
        </div>
      </div>

      {/* Street View Modal */}
      {streetViewData && (
        <StreetViewModal
          isOpen={isStreetViewModalOpen}
          onClose={() => setIsStreetViewModalOpen(false)}
          streetViewData={streetViewData}
        />
      )}
    </>
  );
};

export default InteractionCardImage;
