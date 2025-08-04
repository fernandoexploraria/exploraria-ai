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
import { performanceBenchmark } from '@/utils/streetViewTestUtils';
import { useDemoMode } from '@/hooks/useDemoMode';

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
  
  // Enhanced debugging for multi-viewpoint detection
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
  const { isDemoMode } = useDemoMode();

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
      console.log('✅ Street View loading completed');
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
    console.log(`🔄 Landmark changed, resetting viewpoint from ${currentViewpoint} to 0`);
    setCurrentViewpoint(0);
  }, [currentIndex]);

  // Enhanced logging for viewpoint changes
  useEffect(() => {
    const currentItem = streetViewItems[currentIndex];
    const currentStreetViewData = currentItem?.streetViewData;
    
    if (currentStreetViewData && isMultiViewpointData(currentStreetViewData)) {
      const viewpoint = currentStreetViewData.viewpoints[currentViewpoint];
      console.log(`🧭 Viewpoint changed:`, {
        currentViewpoint,
        totalViewpoints: currentStreetViewData.viewpoints.length,
        currentHeading: viewpoint?.heading,
        currentImageUrl: viewpoint?.imageUrl,
        landmarkName: currentItem?.landmark.name
      });
    }
  }, [currentViewpoint, currentIndex, streetViewItems]);

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

  // Enhanced keyboard navigation with new shortcuts
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
            const newViewpoint = currentViewpoint > 0 ? currentViewpoint - 1 : maxViewpoints - 1;
            console.log(`⌨️ Keyboard: changing viewpoint from ${currentViewpoint} to ${newViewpoint}`);
            setCurrentViewpoint(newViewpoint);
          } else {
            handlePrevious();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey && isMultiViewpoint) {
            const newViewpoint = currentViewpoint < maxViewpoints - 1 ? currentViewpoint + 1 : 0;
            console.log(`⌨️ Keyboard: changing viewpoint from ${currentViewpoint} to ${newViewpoint}`);
            setCurrentViewpoint(newViewpoint);
          } else {
            handleNext();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isMultiViewpoint) {
            const newViewpoint = currentViewpoint > 0 ? currentViewpoint - 1 : maxViewpoints - 1;
            console.log(`⌨️ Keyboard: changing viewpoint from ${currentViewpoint} to ${newViewpoint}`);
            setCurrentViewpoint(newViewpoint);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (isMultiViewpoint) {
            const newViewpoint = currentViewpoint < maxViewpoints - 1 ? currentViewpoint + 1 : 0;
            console.log(`⌨️ Keyboard: changing viewpoint from ${currentViewpoint} to ${newViewpoint}`);
            setCurrentViewpoint(newViewpoint);
          }
          break;
        case ' ':
          e.preventDefault();
          if (e.shiftKey) {
            handlePrevious();
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
        case 'i':
        case 'I':
          e.preventDefault();
          setShowMetadata(prev => !prev);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          if (onLocationSelect) {
            handleShowOnMap();
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          // Reset view functionality would be implemented here
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(prev => !prev);
          break;
        default:
          // Handle number keys for viewpoint selection
          if (isMultiViewpoint && /^[1-9]$/.test(e.key)) {
            const viewpointIndex = parseInt(e.key) - 1;
            if (viewpointIndex < maxViewpoints) {
              setCurrentViewpoint(viewpointIndex);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, currentIndex, currentViewpoint, streetViewItems.length, onClose, handlePrevious, handleNext, toggleFullscreen, showKeyboardHelp, onLocationSelect, handleShowOnMap]);

  const [showDebugPanel, setShowDebugPanel] = useState(process.env.NODE_ENV === 'development');

  // Stabilized loading effect with proper guards
  useEffect(() => {
    if (!isOpen || !mountedRef.current) return;
    
    const currentItem = streetViewItems[currentIndex];
    const currentStreetViewData = currentItem?.streetViewData;
    
    if (!currentStreetViewData) {
      console.log('🚫 No Street View data available for loading');
      return;
    }

    // Create stable session ID and check if already loaded/loading
    const sessionId = currentLoadingId;
    
    // Check if this item is already loaded
    if (loadedItemsRef.current.has(sessionId)) {
      console.log(`✅ Item ${sessionId} already loaded, skipping`);
      return;
    }
    
    // Check if already loading this session
    if (loadingSessionRef.current === sessionId) {
      console.log(`🔄 Already loading session ${sessionId}, skipping`);
      return;
    }

    // Start new loading session
    loadingSessionRef.current = sessionId;
    console.log(`🚀 Starting loading session: ${sessionId}`);
    
    const loadStreetViewData = async () => {
      if (!mountedRef.current || loadingSessionRef.current !== sessionId) {
        console.log(`🛑 Loading cancelled for session: ${sessionId}`);
        return;
      }

      try {
        if (isMultiViewpointData(currentStreetViewData)) {
          const strategy = determineStrategy(currentStreetViewData);
          const viewpoints = currentStreetViewData.viewpoints;
          
          console.log(`📐 Loading multi-viewpoint: ${viewpoints.length} viewpoints with ${strategy} strategy`);
          
          startLoading(viewpoints.length, sessionId);
          
          const { concurrentLoads } = getOptimalLoadingStrategy();
          
          await performanceBenchmark.measure(
            `Multi-viewpoint loading - ${viewpoints.length} viewpoints`,
            async () => {
              for (let i = 0; i < viewpoints.length; i += concurrentLoads) {
                if (!mountedRef.current || loadingSessionRef.current !== sessionId) break;
                
                const batch = viewpoints.slice(i, i + concurrentLoads);
                const loadPromises = batch.map((viewpoint, batchIndex) => {
                  const actualIndex = i + batchIndex;
                  return performanceBenchmark.measure(
                    `Viewpoint ${actualIndex + 1}/${viewpoints.length}`,
                    () => loadImageWithProgress(
                      viewpoint.imageUrl, 
                      actualIndex,
                      () => updateProgress((actualIndex / viewpoints.length) * 100, `Loading viewpoint ${actualIndex + 1}...`)
                    )
                  );
                });
                
                await Promise.all(loadPromises);
              }
            }
          );
        } else {
          console.log('📐 Loading single viewpoint');
          
          startLoading(1, sessionId);
          
          updateProgress(25, 'Loading Street View...');
          await new Promise(resolve => setTimeout(resolve, 100));
          
          updateProgress(75, 'Processing image...');
          
          await performanceBenchmark.measure(
            'Single viewpoint loading',
            () => loadImageWithProgress(
              currentStreetViewData.imageUrl,
              0,
              () => updateProgress(90, 'Finalizing...')
            )
          );
        }

        // Mark as completed if still the active session
        if (mountedRef.current && loadingSessionRef.current === sessionId) {
          loadedItemsRef.current.add(sessionId);
          console.log(`✅ Loading completed for session: ${sessionId}`);
          
          setTimeout(() => {
            if (mountedRef.current && loadingSessionRef.current === sessionId) {
              finishLoading();
              loadingSessionRef.current = null;
            }
          }, 200);
        }
      } catch (error) {
        console.error(`❌ Loading failed for session ${sessionId}:`, error);
        if (mountedRef.current && loadingSessionRef.current === sessionId) {
          finishLoading();
          loadingSessionRef.current = null;
        }
      }
    };

    loadStreetViewData();
  }, [currentLoadingId, isOpen, streetViewItems, determineStrategy, startLoading, loadImageWithProgress, updateProgress, getOptimalLoadingStrategy, finishLoading]);

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
          <h2 className="text-xl font-bold mb-4">Street View Not Available</h2>
          <p className="text-gray-600 mb-4">
            {!isOnline 
              ? `Street View data for ${currentItem?.landmark.name} is not available offline.`
              : `Street View is not available for ${currentItem?.landmark.name}.`
            }
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  // Enhanced multi-viewpoint detection with detailed logging
  const isMultiViewpoint = isMultiViewpointData(currentStreetViewData);
  
  console.log('🎯 Street View Modal State:', {
    landmarkName: currentItem?.landmark.name,
    isMultiViewpoint,
    currentViewpoint,
    streetViewDataKeys: currentStreetViewData ? Object.keys(currentStreetViewData) : 'none',
    viewpointCount: isMultiViewpoint ? currentStreetViewData.viewpoints.length : 1,
    currentHeading: isMultiViewpoint 
      ? currentStreetViewData.viewpoints[currentViewpoint]?.heading 
      : currentStreetViewData.heading,
    fallbackInfo: isMultiViewpoint ? currentStreetViewData.metadata.fallbackInfo : undefined
  });
  
  const currentStreetView = isMultiViewpoint 
    ? currentStreetViewData.viewpoints[currentViewpoint]
    : currentStreetViewData;
  
  const allViewpoints = isMultiViewpoint 
    ? currentStreetViewData.viewpoints 
    : [currentStreetViewData];
    
  const strategy = isMultiViewpoint ? determineStrategy(currentStreetViewData) : 'single';

  // Updated compass visibility logic - show for any data with 2+ viewpoints
  const shouldShowCompass = isMultiViewpoint && allViewpoints.length >= 2;

  console.log('🧭 Compass Display Logic:', {
    isMultiViewpoint,
    allViewpointsLength: allViewpoints.length,
    shouldShowCompass,
    strategy,
    currentViewpoint,
    viewpointHeadings: allViewpoints.map(v => v.heading)
  });

  const availableItems = streetViewItems.filter(item => item.streetViewData);

  // Convert Street View data to PhotoData for enhanced loading
  const currentStreetViewPhoto = streetViewToPhotoData(currentStreetView);

  // Create unique key for image component to force re-rendering
  const imageKey = `viewpoint-${currentViewpoint}-heading-${currentStreetView.heading}-${currentStreetView.imageUrl?.slice(-20)}`;
  
  console.log('🖼️ Image Key Generated:', {
    imageKey,
    currentViewpoint,
    heading: currentStreetView.heading,
    imageUrl: currentStreetView.imageUrl?.slice(0, 50) + '...'
  });

  // Convert streetViewItems to thumbnailData format for the grid
  const thumbnailData = streetViewItems.map(item => ({
    landmark: item.landmark,
    streetViewData: item.streetViewData && isMultiViewpointData(item.streetViewData) 
      ? item.streetViewData.primary 
      : item.streetViewData as StreetViewData | null
  }));

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 ${isFullscreen ? 'p-0' : 'p-4'}`}>
      <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden ${isFullscreen ? 'max-w-none max-h-none' : 'max-w-7xl max-h-[95vh]'}`}>
        
        {/* Loading Overlay */}
        <StreetViewLoadingOverlay 
          loadingState={loadingState}
          strategy={strategy}
        />
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{currentStreetView.landmarkName}</h2>
                <OfflineIndicator />
              </div>
              {isDemoMode && (
                <div className="flex items-center gap-4 text-sm opacity-90 mb-2">
                  <span>
                    Street View • {currentStreetView.location.lat.toFixed(6)}, {currentStreetView.location.lng.toFixed(6)}
                  </span>
                </div>
              )}
              
              {/* Multi-viewpoint indicator with fallback info */}
              {isMultiViewpoint && (
                <div className="space-y-1">
                  <MultiViewpointIndicator
                    strategy={strategy}
                    viewpointCount={allViewpoints.length}
                    dataUsage={currentStreetViewData.metadata.dataUsage}
                    variant="detailed"
                    isLoading={loadingState.isLoading}
                  />
                  
                  {/* Fallback information - only show in demo mode */}
                  {isDemoMode && currentStreetViewData.metadata.fallbackInfo && (
                    <div className="text-xs text-blue-400 opacity-75">
                      Coverage: {currentStreetViewData.metadata.fallbackInfo.coveragePercent}% 
                      ({currentStreetViewData.metadata.fallbackInfo.fallbacksUsed} fallbacks used)
                    </div>
                  )}
                </div>
              )}
              
              {isSlowConnection && (
                <p className="text-xs text-yellow-400 mt-1">
                  Loading optimized for slow connection
                </p>
              )}

              {/* Debug information - only when demo mode is enabled */}
              {isDemoMode && (
                <div className="text-xs text-blue-400 mt-1 opacity-75">
                  Debug: {isMultiViewpoint ? 'Multi' : 'Single'} • 
                  Views: {allViewpoints.length} • 
                  Current: {currentViewpoint + 1} • 
                  Heading: {currentStreetView.heading}° •
                  Compass: {shouldShowCompass ? 'YES' : 'NO'} •
                  Key: {imageKey.slice(0, 30)}...
                </div>
              )}
            </div>
            
            {/* Navigation Controls */}
            <div className="flex items-center gap-4">
              <StreetViewNavigationControls
                onPrevious={handlePrevious}
                onNext={handleNext}
                onFullscreen={toggleFullscreen}
                onShowOnMap={onLocationSelect ? handleShowOnMap : undefined}
                onToggleInfo={() => setShowMetadata(!showMetadata)}
                onToggleKeyboardHelp={() => setShowKeyboardHelp(!showKeyboardHelp)}
                hasPrevious={currentIndex > 0}
                hasNext={currentIndex < streetViewItems.length - 1}
                currentIndex={currentIndex}
                totalCount={streetViewItems.length}
                isMultiViewpoint={isMultiViewpoint}
                isInfoVisible={showMetadata}
              />
              
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
        </div>

        {/* Enhanced Street View Image with unique key */}
        <div className="w-full h-full relative">
          <EnhancedProgressiveImage
            key={imageKey}
            photo={currentStreetViewPhoto}
            alt={`Street View of ${currentStreetView.landmarkName} (${currentStreetView.heading}°)`}
            className="w-full h-full"
            showAttribution={false}
          />
          
          {/* Connection indicator for image */}
          {!isOnline && (
            <div className="absolute top-4 right-4 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              Cached Offline
            </div>
          )}
        </div>

        {/* Keyboard Help Panel */}
        {showKeyboardHelp && (
          <StreetViewKeyboardHelp
            isMultiViewpoint={isMultiViewpoint}
            isVisible={showKeyboardHelp}
            onToggle={() => setShowKeyboardHelp(!showKeyboardHelp)}
          />
        )}

        {/* Enhanced Multi-viewpoint Compass - Updated visibility logic */}
        {shouldShowCompass && (
          <div className="absolute top-1/2 right-4 transform -translate-y-1/2">
            <EnhancedStreetViewCompass
              viewpoints={allViewpoints}
              currentViewpoint={currentViewpoint}
              onViewpointChange={(index) => {
                console.log(`🧭 Compass viewpoint change: ${currentViewpoint} → ${index}`);
                setCurrentViewpoint(index);
              }}
              strategy={strategy}
              loadingViewpoints={loadingViewpoints}
            />
          </div>
        )}

        {/* Debug overlay to verify compass should be visible */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-1/2 left-4 bg-black/80 text-white text-xs p-2 rounded">
            <div>Multi: {isMultiViewpoint ? 'YES' : 'NO'}</div>
            <div>Views: {allViewpoints.length}</div>
            <div>Show: {shouldShowCompass ? 'YES' : 'NO'}</div>
            <div>Current: {currentViewpoint}</div>
            <div>Strategy: {strategy}</div>
            {isMultiViewpoint && currentStreetViewData.metadata.fallbackInfo && (
              <div>Fallbacks: {currentStreetViewData.metadata.fallbackInfo.fallbacksUsed}</div>
            )}
          </div>
        )}

        {/* Metadata Panel */}
        <StreetViewMetadataPanel
          streetViewData={currentStreetViewData}
          currentViewpoint={currentViewpoint}
          isVisible={showMetadata}
          onToggle={() => setShowMetadata(!showMetadata)}
          loadingState={loadingState}
        />

        {/* Enhanced Thumbnail Navigation */}
        {availableItems.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <StreetViewThumbnailGrid
              thumbnails={thumbnailData}
              onThumbnailClick={handleThumbnailClick}
              selectedIndex={currentIndex}
              loadingStates={Object.fromEntries(
                Object.entries(loadingViewpoints).map(([key, value]) => [parseInt(key), value])
              )}
              className="justify-center"
              size="sm"
              maxItems={8}
            />
          </div>
        )}

        {/* Debug Panel */}
        <StreetViewDebugPanel
          isVisible={showDebugPanel}
          onToggle={() => setShowDebugPanel(!showDebugPanel)}
        />

        {/* Enhanced Keyboard shortcuts hint */}
        <div className="absolute bottom-4 right-4 text-white text-xs opacity-50">
          {isMultiViewpoint 
            ? '← → Navigate • ↑ ↓ / 1-9 Change View • Space Next • F Fullscreen • I Info • ? Help • ESC Close'
            : '← → Navigate • Space Next • F Fullscreen • I Info • ? Help • ESC Close'
          }
        </div>
      </div>
    </div>
  );
};

export default EnhancedStreetViewModal;
