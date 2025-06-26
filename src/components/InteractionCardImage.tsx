
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, EyeOff, Satellite, Link } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';
import EnhancedStreetViewModal from './EnhancedStreetViewModal';
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
  const [streetViewStatus, setStreetViewStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown');
  const { 
    isModalOpen, 
    streetViewItems, 
    openStreetViewModal, 
    closeStreetViewModal 
  } = useStreetViewNavigation();

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

  // Check Street View status on mount
  useEffect(() => {
    const checkStreetViewAvailability = async () => {
      if (!landmarkFromInteraction) {
        setStreetViewStatus('unavailable');
        return;
      }

      try {
        // Try to open Street View modal in background to check availability
        await openStreetViewModal([landmarkFromInteraction], landmarkFromInteraction);
        
        // Check if we got any Street View data
        setTimeout(() => {
          const hasValidStreetView = streetViewItems.some(item => item.streetViewData !== null);
          setStreetViewStatus(hasValidStreetView ? 'available' : 'unavailable');
          closeStreetViewModal(); // Close the modal that was opened for checking
        }, 100);
      } catch (error) {
        setStreetViewStatus('unavailable');
        console.log(`❌ Failed to check Street View for ${landmarkFromInteraction.name}:`, error);
      }
    };

    if (streetViewStatus === 'unknown') {
      checkStreetViewAvailability();
    }
  }, [landmarkFromInteraction, streetViewStatus, openStreetViewModal, closeStreetViewModal, streetViewItems]);

  const handleStreetViewClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!landmarkFromInteraction) {
      console.log('❌ No valid landmark data for Street View');
      return;
    }

    try {
      console.log(`🔍 Opening enhanced Street View for ${landmarkFromInteraction.name}`);
      await openStreetViewModal([landmarkFromInteraction], landmarkFromInteraction);
    } catch (error) {
      console.error(`❌ Error opening enhanced Street View for ${landmarkFromInteraction.name}:`, error);
    }
  };

  const handleFallbackClick = (e: React.MouseEvent, type: 'satellite' | 'maps') => {
    e.stopPropagation();
    
    if (!landmarkFromInteraction) return;
    
    const [lng, lat] = landmarkFromInteraction.coordinates;
    let url: string;
    
    if (type === 'satellite') {
      // Google Maps satellite view
      url = `https://www.google.com/maps/@${lat},${lng},18z/data=!3m1!1e3`;
    } else {
      // Google Maps regular view
      url = `https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},17z`;
    }
    
    window.open(url, '_blank');
  };

  const handleImageDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Download button clicked');

    try {
      // Check if we're on a native platform
      const isNativePlatform = Capacitor.isNativePlatform() || 
                              (Capacitor.getPlatform() === 'web' && 'serviceWorker' in navigator);

      if (isNativePlatform && Capacitor.isNativePlatform()) {
        console.log('Attempting native save...');
        throw new Error('Native save not implemented yet, using fallback');
      } else {
        throw new Error('Not a native platform, using fallback');
      }
    } catch (error) {
      console.log('Using standard download:', error);
      
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
        
        {/* Street View Status Badge */}
        {streetViewStatus === 'available' && (
          <div className="absolute top-1 left-1">
            <Badge variant="secondary" className="text-xs bg-blue-500/80 text-white border-0">
              Street View
            </Badge>
          </div>
        )}
        
        {streetViewStatus === 'unavailable' && (
          <div className="absolute top-1 left-1">
            <Badge variant="secondary" className="text-xs bg-gray-500/80 text-white border-0">
              No Street View
            </Badge>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="absolute top-1 right-1 flex gap-1">
          {/* Street View Button */}
          {landmarkFromInteraction && streetViewStatus === 'available' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
              onClick={handleStreetViewClick}
              title="View Enhanced Street View"
            >
              <Eye className="w-3 h-3 text-white" />
            </Button>
          )}
          
          {/* Disabled Street View Button */}
          {landmarkFromInteraction && streetViewStatus === 'unavailable' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-gray-500/50 cursor-not-allowed"
              disabled
              title="Street View not available"
            >
              <EyeOff className="w-3 h-3 text-gray-400" />
            </Button>
          )}
          
          {/* Loading Street View Button */}
          {landmarkFromInteraction && streetViewStatus === 'unknown' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
              onClick={handleStreetViewClick}
              title="Checking Street View availability..."
            >
              <Eye className="w-3 h-3 text-white animate-pulse" />
            </Button>
          )}
          
          {/* Fallback: Satellite View Button */}
          {landmarkFromInteraction && streetViewStatus === 'unavailable' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
              onClick={(e) => handleFallbackClick(e, 'satellite')}
              title="View satellite imagery"
            >
              <Satellite className="w-3 h-3 text-white" />
            </Button>
          )}
          
          {/* Fallback: Maps Link Button */}
          {landmarkFromInteraction && streetViewStatus === 'unavailable' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
              onClick={(e) => handleFallbackClick(e, 'maps')}
              title="Open in Google Maps"
            >
              <Link className="w-3 h-3 text-white" />
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

      {/* Enhanced Street View Modal */}
      <EnhancedStreetViewModal
        isOpen={isModalOpen}
        onClose={closeStreetViewModal}
        streetViewItems={streetViewItems}
        initialIndex={0}
      />
    </>
  );
};

export default InteractionCardImage;
