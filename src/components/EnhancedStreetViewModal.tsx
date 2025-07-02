import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StreetViewNavigationControls from './StreetViewNavigationControls';
import StreetViewThumbnailGrid from './StreetViewThumbnailGrid';
import EnhancedStreetViewCompass from './street-view/EnhancedStreetViewCompass';
import StreetViewMetadataPanel from './street-view/StreetViewMetadataPanel';
import StreetViewLoadingOverlay from './street-view/StreetViewLoadingOverlay';
import MultiViewpointIndicator from './street-view/MultiViewpointIndicator';
import StreetViewKeyboardHelp from './street-view/StreetViewKeyboardHelp';
import StreetViewDebugPanel from './street-view/StreetViewDebugPanel';
import OfflineIndicator from './OfflineIndicator';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAdaptiveStreetViewLoader } from '@/hooks/useAdaptiveStreetViewLoader';
import { PhotoData } from '@/hooks/useEnhancedPhotos';

interface StreetViewData {
  imageUrl: string;
  heading: number;
  pitch: number;
  fov: number;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
}

interface MultiViewpointData {
  primary: StreetViewData;
  viewpoints: StreetViewData[];
  metadata: {
    totalViews: number;
    recommendedView: number;
    dataUsage: string;
    fallbackInfo?: {
      requestedHeadings: number[];
      successfulHeadings: number[];
      fallbacksUsed: number;
      coveragePercent: number;
    };
  };
}

interface StreetViewItem {
  landmark: any;
  streetViewData: StreetViewData | MultiViewpointData | null;
}

interface EnhancedStreetViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  streetViewItems: StreetViewItem[];
  initialIndex?: number;
  onLocationSelect?: (coordinates: [number, number]) => void;
}

type ViewpointStrategy = 'single' | 'cardinal' | 'smart' | 'all';

const isMultiViewpointData = (data: any): data is MultiViewpointData => {
  const isMulti = data && 'primary' in data && 'viewpoints' in data && 'metadata' in data;
  
  console.log('🔍 Multi-viewpoint detection:', {
    hasData: !!data,
    hasPrimary: data && 'primary' in data,
    hasViewpoints: data && 'viewpoints' in data,
    hasMetadata: data && 'metadata' in data,
    viewpointCount: data?.viewpoints?.length || 0,
    isMultiViewpoint: isMulti,
    dataStructure: data ? Object.keys(data) : 'no data',
    fallbackInfo: data?.metadata?.fallbackInfo
  });
  
  return isMulti;
};

// Convert Street View data to PhotoData format for enhanced image loading
const streetViewToPhotoData = (streetViewData: StreetViewData): PhotoData => ({
  id: Date.now(),
  photoReference: 'streetview',
  urls: {
    thumb: streetViewData.imageUrl,
    medium: streetViewData.imageUrl,
    large: streetViewData.imageUrl
  },
  attributions: streetViewData.metadata.copyright ? [{
    displayName: streetViewData.metadata.copyright,
    uri: undefined,
    photoUri: undefined
  }] : [],
  width: 640,
  height: 640,
  qualityScore: 75
});

const EnhancedStreetViewModal: React.FC<EnhancedStreetViewModalProps> = ({
  isOpen,
  onClose,
  streetViewItems,
  initialIndex = 0,
  onLocationSelect
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentViewpoint, setCurrentViewpoint] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const { isOnline, isSlowConnection } = useNetworkStatus();

  // Refs for loading state management
  const mountedRef = useRef(true);
  const loadingSessionRef = useRef<string | null>(null);
  const loadedItemsRef = useRef<Set<string>>(new Set());

  const {
    loadingState,
    loadingViewpoints,
    startLoading,
    finishLoading,
    updateProgress,
    setViewpointLoading,
    loadImageWithProgress,
    getOptimalLoadingStrategy
  } = useAdaptiveStreetViewLoader({
    onComplete: () => {
      console.log('✅ Panorama Street View loading completed');
    }
  });

  // Create stable loading identifier based on current state
  const currentLoadingId = useMemo(() => {
    return `item-${currentIndex}-view-${currentViewpoint}`;
  }, [currentIndex, currentViewpoint]);

  // Reset indices when modal opens or items change
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setCurrentViewpoint(0);
    // Clear loaded items cache when items change
    loadedItemsRef.current.clear();
  }, [initialIndex, streetViewItems]);

  // Reset viewpoint when landmark changes
  useEffect(() => {
    setCurrentViewpoint(0);
  }, [currentIndex]);

  const determineStrategy = useCallback((multiData: MultiViewpointData): ViewpointStrategy => {
    const viewCount = multiData.viewpoints.length;
    const fallbackInfo = multiData.metadata.fallbackInfo;
    
    // Use fallback info to determine actual strategy used
    if (fallbackInfo) {
      const requestedCount = fallbackInfo.requestedHeadings.length;
      const coveragePercent = fallbackInfo.coveragePercent;
      
      console.log('📐 Strategy determination:', {
        viewCount,
        requestedCount,
        coveragePercent,
        fallbacksUsed: fallbackInfo.fallbacksUsed
      });
      
      if (requestedCount === 1) return 'single';
      if (requestedCount === 4 && coveragePercent >= 75) return 'cardinal';
      if (requestedCount <= 3 && coveragePercent >= 66) return 'smart';
      return 'all';
    }
    
    // Fallback to simple view count logic
    if (viewCount === 1) return 'single';
    if (viewCount === 4) return 'cardinal';
    if (viewCount <= 3) return 'smart';
    return 'all';
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentIndex(prev => prev > 0 ? prev - 1 : streetViewItems.length - 1);
  }, [streetViewItems.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => prev < streetViewItems.length - 1 ? prev + 1 : 0);
  }, [streetViewItems.length]);

  const handleThumbnailClick = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const handleShowOnMap = useCallback(() => {
    const currentItem = streetViewItems[currentIndex];
    if (currentItem?.streetViewData && onLocationSelect) {
      let location;
      
      if (isMultiViewpointData(currentItem.streetViewData)) {
        const currentStreetView = currentItem.streetViewData.viewpoints[currentViewpoint];
        location = currentStreetView.location;
      } else {
        location = currentItem.streetViewData.location;
      }
      
      if (location) {
        onLocationSelect([location.lng, location.lat]);
        onClose();
      }
    }
  }, [currentIndex, currentViewpoint, streetViewItems, onLocationSelect, onClose]);

  // Enhanced keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      const currentItem = streetViewItems[currentIndex];
      const currentStreetViewData = currentItem?.streetViewData;
      const isMultiViewpoint = currentStreetViewData && isMultiViewpointData(currentStreetViewData);
      const maxViewpoints = isMultiViewpoint ? currentStreetViewData.viewpoints.length : 1;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey && isMultiViewpoint) {
            setCurrentViewpoint(prev => prev > 0 ? prev - 1 : maxViewpoints - 1);
          } else {
            handlePrevious();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey && isMultiViewpoint) {
            setCurrentViewpoint(prev => prev < maxViewpoints - 1 ? prev + 1 : 0);
          } else {
            handleNext();
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (showKeyboardHelp) {
            setShowKeyboardHelp(false);
          } else {
            onClose();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(prev => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, currentIndex, currentViewpoint, streetViewItems.length, onClose, handlePrevious, handleNext, toggleFullscreen, showKeyboardHelp]);

  const [showDebugPanel, setShowDebugPanel] = useState(process.env.NODE_ENV === 'development');

  // Component unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadingSessionRef.current = null;
      loadedItemsRef.current.clear();
    };
  }, []);

  if (!isOpen || streetViewItems.length === 0) return null;

  const currentItem = streetViewItems[currentIndex];
  const currentStreetViewData = currentItem?.streetViewData;

  if (!currentStreetViewData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="bg-white rounded-lg p-8 max-w-md text-center">
          <div className="mb-4">
            {!isOnline ? <WifiOff className="w-12 h-12 mx-auto text-gray-400" /> : null}
          </div>
          <h2 className="text-xl font-bold mb-4">Panorama Street View Not Available</h2>
          <p className="text-gray-600 mb-4">
            {!isOnline 
              ? `Panorama data for ${currentItem?.landmark.name} is not available offline.`
              : `Interactive panorama is not available for ${currentItem?.landmark.name}.`
            }
          </p>
          <p className="text-sm text-blue-600 mb-4">
            Note: We've transitioned to panorama-only Street View for better interactivity.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  // For now, render a placeholder until panorama integration is complete
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 ${isFullscreen ? 'p-0' : 'p-4'}`}>
      <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden ${isFullscreen ? 'max-w-none max-h-none' : 'max-w-7xl max-h-[95vh]'}`}>
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{currentItem?.landmark.name}</h2>
                <OfflineIndicator />
              </div>
              <div className="flex items-center gap-4 text-sm opacity-90 mb-2">
                <span>Panorama Street View • Interactive Experience</span>
              </div>
              <div className="text-sm text-blue-400">
                🚧 Panorama integration in progress - Enhanced interactive Street View coming soon!
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20"
              title="Close (Esc)"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Placeholder content */}
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center text-white p-8">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-2xl font-bold mb-4">Interactive Panorama Street View</h3>
            <p className="text-gray-300 mb-4">
              Enhanced panorama experience for {currentItem?.landmark.name}
            </p>
            <p className="text-sm text-blue-400">
              Panorama-only strategy active • Static Street View components removed
            </p>
          </div>
        </div>

        {/* Debug Panel */}
        <StreetViewDebugPanel
          isVisible={showDebugPanel}
          onToggle={() => setShowDebugPanel(!showDebugPanel)}
        />
      </div>
    </div>
  );
};

export default EnhancedStreetViewModal;
