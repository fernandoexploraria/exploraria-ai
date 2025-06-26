import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, EyeOff, Satellite, Link, ChevronLeft, ChevronRight, Camera, Maximize2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';
import { useEnhancedPhotos, PhotoData } from '@/hooks/useEnhancedPhotos';
import { usePhotoNavigation } from '@/hooks/usePhotoNavigation';
import EnhancedStreetViewModal from './EnhancedStreetViewModal';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import PhotoAttribution from './photo-carousel/PhotoAttribution';
import ImageViewerDialog from './ImageViewerDialog';
import { Landmark } from '@/data/landmarks';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  interaction_type: string;
  landmark_coordinates: any;
  full_transcript: any;
  place_id?: string;
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
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [showAttribution, setShowAttribution] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  
  const { 
    isModalOpen, 
    streetViewItems, 
    openStreetViewModal, 
    closeStreetViewModal 
  } = useStreetViewNavigation();
  
  const { fetchPhotos, getBestPhoto } = useEnhancedPhotos();

  // Photo navigation for multiple photos
  const {
    currentIndex,
    currentPhoto,
    hasNext,
    hasPrevious,
    totalCount,
    goToNext,
    goToPrevious
  } = usePhotoNavigation({
    photos,
    initialIndex: 0
  });

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

  // Create fallback photo from existing image URL
  const createFallbackPhoto = (url: string): PhotoData => ({
    id: 0,
    photoReference: 'fallback',
    urls: {
      thumb: url,
      medium: url,
      large: url
    },
    attributions: [],
    width: 800,
    height: 600,
    qualityScore: 50
  });

  // Fetch enhanced photos if place_id is available
  useEffect(() => {
    const loadPhotos = async () => {
      if (interaction.place_id) {
        setIsLoadingPhotos(true);
        try {
          console.log(`🖼️ Fetching photos for place_id: ${interaction.place_id}`);
          const photosResponse = await fetchPhotos(interaction.place_id, 800, 'medium');
          
          if (photosResponse && photosResponse.photos.length > 0) {
            console.log(`✅ Found ${photosResponse.photos.length} photos for ${destination}`);
            setPhotos(photosResponse.photos);
          } else {
            // Fallback to existing image URL
            console.log(`ℹ️ No photos found, using fallback image for ${destination}`);
            setPhotos([createFallbackPhoto(imageUrl)]);
          }
        } catch (error) {
          console.error('❌ Error fetching photos:', error);
          setPhotos([createFallbackPhoto(imageUrl)]);
        } finally {
          setIsLoadingPhotos(false);
        }
      } else {
        // No place_id, use existing image URL
        setPhotos([createFallbackPhoto(imageUrl)]);
      }
    };

    loadPhotos();
  }, [interaction.place_id, imageUrl, destination, fetchPhotos]);

  // Check Street View status on mount
  useEffect(() => {
    const checkStreetViewAvailability = async () => {
      if (!landmarkFromInteraction) {
        setStreetViewStatus('unavailable');
        return;
      }

      try {
        await openStreetViewModal([landmarkFromInteraction], landmarkFromInteraction);
        
        setTimeout(() => {
          const hasValidStreetView = streetViewItems.some(item => item.streetViewData !== null);
          setStreetViewStatus(hasValidStreetView ? 'available' : 'unavailable');
          closeStreetViewModal();
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
      url = `https://www.google.com/maps/@${lat},${lng},18z/data=!3m1!1e3`;
    } else {
      url = `https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},17z`;
    }
    
    window.open(url, '_blank');
  };

  const handleImageClick = () => {
    setIsImageViewerOpen(true);
  };

  const handleImageDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const photoToDownload = currentPhoto || createFallbackPhoto(imageUrl);
    const downloadUrl = photoToDownload.urls.large || photoToDownload.urls.medium || photoToDownload.urls.thumb;
    
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('Attempting native save...');
        throw new Error('Native save not implemented yet, using fallback');
      } else {
        throw new Error('Not a native platform, using fallback');
      }
    } catch (error) {
      console.log('Using standard download:', error);
      
      try {
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `exploraria-${destination.replace(/\s+/g, '-').toLowerCase()}-${currentIndex + 1}-${Date.now()}.jpg`;
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

  const goToPreviousPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToPrevious();
  };

  const goToNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToNext();
  };

  const displayPhoto = currentPhoto || createFallbackPhoto(imageUrl);
  const hasMultiplePhotos = photos.length > 1;

  if (isLoadingPhotos) {
    return (
      <div className="mb-2 flex-shrink-0 relative">
        <div className="w-full h-20 bg-gray-200 animate-pulse rounded flex items-center justify-center">
          <Camera className="w-6 h-6 text-gray-400" />
        </div>
      </div>
    );
  }

  if (!currentPhoto) {
    return (
      <div className="mb-2 flex-shrink-0 relative">
        <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center">
          <div className="text-gray-500 text-sm">No image available</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 flex-shrink-0 relative group cursor-pointer" onClick={handleImageClick}>
        {/* Main Photo Display */}
        <div className="relative">
          <EnhancedProgressiveImage
            photo={displayPhoto}
            alt={`${destination} - Photo ${currentIndex + 1}`}
            className="w-full h-20 rounded"
            showAttribution={false}
          />
          
          {/* Photo Navigation for Multiple Photos */}
          {hasMultiplePhotos && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousPhoto}
                disabled={!hasPrevious}
                className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-3 h-3 text-white" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextPhoto}
                disabled={!hasNext}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-3 h-3 text-white" />
              </Button>
            </>
          )}

          {/* Fullscreen indicator */}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Maximize2 className="w-6 h-6 text-white drop-shadow-lg" />
          </div>
        </div>
        
        {/* Status Badges */}
        <div className="absolute top-1 left-1 flex gap-1">
          {streetViewStatus === 'available' && (
            <Badge variant="secondary" className="text-xs bg-blue-500/80 text-white border-0">
              Street View
            </Badge>
          )}
          
          {streetViewStatus === 'unavailable' && (
            <Badge variant="secondary" className="text-xs bg-gray-500/80 text-white border-0">
              No Street View
            </Badge>
          )}
          
          {hasMultiplePhotos && (
            <Badge variant="secondary" className="text-xs bg-green-500/80 text-white border-0">
              {currentIndex + 1}/{totalCount}
            </Badge>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="absolute top-1 right-1 flex gap-1">
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
          
          {landmarkFromInteraction && streetViewStatus === 'unavailable' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 bg-gray-500/50 cursor-not-allowed"
                disabled
                title="Street View not available"
              >
                <EyeOff className="w-3 h-3 text-gray-400" />
              </Button>
              
              {/* Fallback: Satellite View Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
                onClick={(e) => handleFallbackClick(e, 'satellite')}
                title="View satellite imagery"
              >
                <Satellite className="w-3 h-3 text-white" />
              </Button>
              
              {/* Fallback: Maps Link Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
                onClick={(e) => handleFallbackClick(e, 'maps')}
                title="Open in Google Maps"
              >
                <Link className="w-3 h-3 text-white" />
              </Button>
            </>
          )}
          
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
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
            onClick={handleImageDownload}
            title="Download current photo"
          >
            <Download className="w-3 h-3 text-white" />
          </Button>
        </div>

        {/* Photo Attribution Overlay */}
        {displayPhoto.attributions && displayPhoto.attributions.length > 0 && (
          <PhotoAttribution
            photo={displayPhoto}
            isVisible={showAttribution}
            onToggle={() => setShowAttribution(!showAttribution)}
            className="rounded-b"
          />
        )}
      </div>

      {/* Enhanced Image Viewer Dialog */}
      <ImageViewerDialog
        open={isImageViewerOpen}
        onOpenChange={setIsImageViewerOpen}
        photos={photos}
        imageName={destination}
        initialIndex={currentIndex}
      />

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
