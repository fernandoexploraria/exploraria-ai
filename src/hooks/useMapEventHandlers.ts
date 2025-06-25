
import { useCallback, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface MapEventHandlersProps {
  onMapClick?: (e: mapboxgl.MapMouseEvent) => void;
  onMoveEnd?: () => void;
}

export const useMapEventHandlers = ({ onMapClick, onMoveEnd }: MapEventHandlersProps = {}) => {
  const isZooming = useRef<boolean>(false);
  const pendingPopupLandmark = useRef<any>(null);

  const setupMapEventListeners = useCallback((map: mapboxgl.Map) => {
    // Handle moveend event to show popup after zoom completes
    const handleMoveEnd = () => {
      if (pendingPopupLandmark.current && isZooming.current) {
        isZooming.current = false;
        if (onMoveEnd) {
          onMoveEnd();
        }
      }
    };

    // Handle map click events
    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (onMapClick) {
        onMapClick(e);
      }
    };

    map.on('moveend', handleMoveEnd);
    map.on('click', handleMapClick);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('click', handleMapClick);
    };
  }, [onMapClick, onMoveEnd]);

  const setPendingPopupLandmark = useCallback((landmark: any) => {
    pendingPopupLandmark.current = landmark;
  }, []);

  const setIsZooming = useCallback((zooming: boolean) => {
    isZooming.current = zooming;
  }, []);

  return {
    setupMapEventListeners,
    setPendingPopupLandmark,
    setIsZooming,
    isZooming: isZooming.current,
    pendingPopupLandmark: pendingPopupLandmark.current
  };
};
