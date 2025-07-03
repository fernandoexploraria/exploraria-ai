import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import SearchControl from '@/components/SearchControl';
import ProximityControlPanel from '@/components/ProximityControlPanel';
import FloatingProximityCard from '@/components/FloatingProximityCard';
import ProximityAutocomplete from '@/components/ProximityAutocomplete';
import ProximitySearch from '@/components/ProximitySearch';
import OfflineIndicator from '@/components/OfflineIndicator';
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Users, Settings } from "lucide-react";
import { useAuth } from '@/components/AuthProvider';
import { geolocateControlDebouncer } from '@/utils/geolocateControlDebouncer';
import { Landmark } from '@/data/landmarks';

// Enhanced update source priority system
type UpdateSource = 'Manual' | 'GeolocateControl' | 'System' | 'SettingsSync' | 'UserAction';

const UPDATE_PRIORITIES: Record<UpdateSource, number> = {
  Manual: 5,
  UserAction: 4,
  GeolocateControl: 3,
  SettingsSync: 2,
  System: 1
};

interface MapProps {
  landmarks?: Landmark[];
  onSelectLandmark?: (landmark: Landmark) => void;
  selectedLandmark?: Landmark | null;
  plannedLandmarks?: Landmark[];
}

const Map: React.FC<MapProps> = ({
  landmarks = [],
  onSelectLandmark,
  selectedLandmark,
  plannedLandmarks = []
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const geolocateControl = useRef<mapboxgl.GeolocateControl | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const proximityMarkers = useRef<mapboxgl.Marker[]>([]);
  
  const mapboxToken = useMapboxToken();
  const { userLocation, startTracking, stopTracking, locationState } = useLocationTracking();
  const { proximitySettings, updateProximityEnabled } = useProximityAlerts();
  const nearbyLandmarks = useNearbyLandmarks({ 
    userLocation, 
    notificationDistance: proximitySettings?.notification_distance || 100 
  });
  const { user } = useAuth();

  // Enhanced flag system for multi-source update prevention
  const isUpdatingFromGeolocateControl = useRef<boolean>(false);
  const geolocateEventInProgress = useRef<boolean>(false);
  const manualUserActionInProgress = useRef<boolean>(false);
  const proximitySettingsSyncInProgress = useRef<boolean>(false);
  const lastUpdateSource = useRef<UpdateSource>('System');
  const lastUpdateTimestamp = useRef<number>(0);

  // Fix: Access the correct property from locationState
  const isTracking = locationState.isTracking;

  // Debug and monitoring state
  const [debugInfo, setDebugInfo] = useState<{
    geolocateState: string;
    lastEventType: string;
    flagStates: Record<string, boolean>;
  }>({
    geolocateState: 'OFF',
    lastEventType: 'none',
    flagStates: {}
  });

  // Add state for ProximityAutocomplete
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [showProximitySearch, setShowProximitySearch] = useState(false);

  // Priority-based update coordination
  const getUpdatePriority = useCallback((source: string): number => {
    if (source.includes('Manual') || source.includes('UserAction')) return UPDATE_PRIORITIES.Manual;
    if (source.includes('GeolocateControl')) return UPDATE_PRIORITIES.GeolocateControl;
    if (source.includes('SettingsSync')) return UPDATE_PRIORITIES.SettingsSync;
    return UPDATE_PRIORITIES.System;
  }, []);

  // Enhanced flag management with coordination
  const setUpdateFlag = useCallback((flagName: string, value: boolean, source: UpdateSource) => {
    const priority = UPDATE_PRIORITIES[source];
    const lastPriority = UPDATE_PRIORITIES[lastUpdateSource.current];
    const now = Date.now();

    // Allow higher priority sources to interrupt lower priority ones
    if (value && priority < lastPriority && now - lastUpdateTimestamp.current < 2000) {
      console.log(`🚫 [Map] ${source} update blocked by higher priority ${lastUpdateSource.current}`);
      return false;
    }

    // Update the appropriate flag
    switch (flagName) {
      case 'isUpdatingFromGeolocateControl':
        isUpdatingFromGeolocateControl.current = value;
        break;
      case 'geolocateEventInProgress':
        geolocateEventInProgress.current = value;
        break;
      case 'manualUserActionInProgress':
        manualUserActionInProgress.current = value;
        break;
      case 'proximitySettingsSyncInProgress':
        proximitySettingsSyncInProgress.current = value;
        break;
    }

    if (value) {
      lastUpdateSource.current = source;
      lastUpdateTimestamp.current = now;
    }

    // Update debug info
    setDebugInfo(prev => ({
      ...prev,
      flagStates: {
        isUpdatingFromGeolocateControl: isUpdatingFromGeolocateControl.current,
        geolocateEventInProgress: geolocateEventInProgress.current,
        manualUserActionInProgress: manualUserActionInProgress.current,
        proximitySettingsSyncInProgress: proximitySettingsSyncInProgress.current
      }
    }));

    console.log(`🏴 [Map] Flag ${flagName} set to ${value} by ${source} (priority: ${priority})`);
    return true;
  }, []);

  // Check if any blocking flags are active
  const isAnyUpdateInProgress = useCallback(() => {
    return isUpdatingFromGeolocateControl.current || 
           geolocateEventInProgress.current || 
           manualUserActionInProgress.current || 
           proximitySettingsSyncInProgress.current;
  }, []);

  // Enhanced proximity enabled update with source coordination
  const handleProximityEnabledUpdate = useCallback(async (enabled: boolean, source: UpdateSource = 'System') => {
    if (!user) return;

    const priority = UPDATE_PRIORITIES[source];
    const lastPriority = UPDATE_PRIORITIES[lastUpdateSource.current];
    const now = Date.now();

    // Check if we should skip this update based on priority and timing
    if (isAnyUpdateInProgress() && priority < lastPriority && now - lastUpdateTimestamp.current < 1000) {
      console.log(`⏸️ [Map] Skipping ${source} update (priority: ${priority}) - higher priority operation in progress`);
      return;
    }

    // Set appropriate flag based on source
    let flagSet = false;
    if (source === 'GeolocateControl') {
      flagSet = setUpdateFlag('isUpdatingFromGeolocateControl', true, source);
    } else if (source === 'Manual' || source === 'UserAction') {
      flagSet = setUpdateFlag('manualUserActionInProgress', true, source);
    } else if (source === 'SettingsSync') {
      flagSet = setUpdateFlag('proximitySettingsSyncInProgress', true, source);
    }

    if (!flagSet && source !== 'System') {
      console.log(`❌ [Map] Failed to set flag for ${source} update`);
      return;
    }

    try {
      console.log(`🔄 [Map] Processing proximity update: ${enabled} from ${source} (priority: ${priority})`);
      await updateProximityEnabled(enabled, `Map-${source}`);
    } finally {
      // Clear flags after a short delay to prevent race conditions
      setTimeout(() => {
        if (source === 'GeolocateControl') {
          isUpdatingFromGeolocateControl.current = false;
        } else if (source === 'Manual' || source === 'UserAction') {
          manualUserActionInProgress.current = false;
        } else if (source === 'SettingsSync') {
          proximitySettingsSyncInProgress.current = false;
        }
        
        setDebugInfo(prev => ({
          ...prev,
          flagStates: {
            isUpdatingFromGeolocateControl: isUpdatingFromGeolocateControl.current,
            geolocateEventInProgress: geolocateEventInProgress.current,
            manualUserActionInProgress: manualUserActionInProgress.current,
            proximitySettingsSyncInProgress: proximitySettingsSyncInProgress.current
          }
        }));
      }, 500);
    }
  }, [user, updateProximityEnabled, isAnyUpdateInProgress, setUpdateFlag]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.006, 40.7128],
      zoom: 12,
      attributionControl: false
    });

    // Enhanced GeolocateControl with debounced event handling
    geolocateControl.current = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      },
      trackUserLocation: true,
      showUserHeading: true,
      fitBoundsOptions: {
        maxZoom: 15
      }
    });

    map.current.addControl(geolocateControl.current, 'top-right');

    // Enhanced event handlers with GeolocateControl debouncer integration
    geolocateControl.current.on('geolocate', (e) => {
      if (!user) return;
      
      setDebugInfo(prev => ({ ...prev, lastEventType: 'geolocate', geolocateState: 'ACTIVE' }));
      
      // Use the GeolocateControl debouncer instead of direct calls
      geolocateControlDebouncer.debounceGeolocateEvent(
        user.id,
        'geolocate',
        true,
        async (enabled: boolean) => {
          await handleProximityEnabledUpdate(enabled, 'GeolocateControl');
        },
        'ACTIVE_LOCK'
      );
    });

    geolocateControl.current.on('trackuserlocationstart', () => {
      if (!user) return;
      
      setDebugInfo(prev => ({ ...prev, lastEventType: 'trackuserlocationstart', geolocateState: 'TRACKING' }));
      setUpdateFlag('geolocateEventInProgress', true, 'GeolocateControl');
      
      geolocateControlDebouncer.debounceGeolocateEvent(
        user.id,
        'trackuserlocationstart',
        true,
        async (enabled: boolean) => {
          await handleProximityEnabledUpdate(enabled, 'GeolocateControl');
        },
        'BACKGROUND'
      );
    });

    geolocateControl.current.on('trackuserlocationend', () => {
      if (!user) return;
      
      setDebugInfo(prev => ({ ...prev, lastEventType: 'trackuserlocationend', geolocateState: 'OFF' }));
      setUpdateFlag('geolocateEventInProgress', false, 'GeolocateControl');
      
      geolocateControlDebouncer.debounceGeolocateEvent(
        user.id,
        'trackuserlocationend',
        false,
        async (enabled: boolean) => {
          await handleProximityEnabledUpdate(enabled, 'GeolocateControl');
        },
        'OFF'
      );
    });

    geolocateControl.current.on('error', (e) => {
      if (!user) return;
      
      console.error('GeolocateControl error:', e);
      setDebugInfo(prev => ({ ...prev, lastEventType: 'error', geolocateState: 'ERROR' }));
      
      geolocateControlDebouncer.debounceGeolocateEvent(
        user.id,
        'error',
        false,
        async (enabled: boolean) => {
          await handleProximityEnabledUpdate(enabled, 'GeolocateControl');
        },
        'ERROR'
      );
    });

    // Navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
      }
      if (user) {
        geolocateControlDebouncer.emergencyBrake(user.id);
      }
    };
  }, [mapboxToken, user, handleProximityEnabledUpdate, setUpdateFlag]);

  // Handle manual user location toggle
  const handleLocationToggle = useCallback(async () => {
    if (!user) return;
    
    setUpdateFlag('manualUserActionInProgress', true, 'Manual');
    
    try {
      if (isTracking) {
        console.log('🔄 [Map] Manual location stop');
        stopTracking();
        await handleProximityEnabledUpdate(false, 'Manual');
      } else {
        console.log('🔄 [Map] Manual location start');
        startTracking();
        await handleProximityEnabledUpdate(true, 'Manual');
      }
    } catch (error) {
      console.error('Error toggling location:', error);
    }
  }, [isTracking, startTracking, stopTracking, user, handleProximityEnabledUpdate, setUpdateFlag]);

  // Sync proximity settings changes (with lower priority)
  useEffect(() => {
    if (proximitySettings && proximitySettings.is_enabled !== undefined) {
      // This is a settings sync operation with lower priority
      handleProximityEnabledUpdate(proximitySettings.is_enabled, 'SettingsSync');
    }
  }, [proximitySettings?.is_enabled, handleProximityEnabledUpdate]);

  // Update user location marker
  useEffect(() => {
    if (!map.current) return;

    if (userLocation) {
      const { latitude, longitude } = userLocation;

      // If marker exists, update its position
      if (userMarker.current) {
        userMarker.current.setLngLat([longitude, latitude]);
      } else {
        // Otherwise, create a new marker
        userMarker.current = new mapboxgl.Marker({ color: 'blue' })
          .setLngLat([longitude, latitude])
          .addTo(map.current);
      }
    }

    return () => {
      if (userMarker.current) {
        userMarker.current.remove();
        userMarker.current = null;
      }
    };
  }, [userLocation]);

  // Update proximity landmark markers
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    proximityMarkers.current.forEach(marker => marker.remove());
    proximityMarkers.current = [];

    // Add new markers for each landmark
    if (nearbyLandmarks) {
      nearbyLandmarks.forEach(({ landmark }) => {
        const { coordinates, name } = landmark;
        const marker = new mapboxgl.Marker({ color: 'green' })
          .setLngLat([coordinates[0], coordinates[1]])
          .setPopup(new mapboxgl.Popup().setText(name)) // add popup
          .addTo(map.current);
        proximityMarkers.current.push(marker);
      });
    }

    return () => {
      proximityMarkers.current.forEach(marker => marker.remove());
      proximityMarkers.current = [];
    };
  }, [nearbyLandmarks]);

  // Handler for autocomplete suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: any) => {
    console.log('Selected suggestion:', suggestion);
    // Handle the selected suggestion here
  }, []);

  // Handler for proximity search place selection
  const handlePlaceSelect = useCallback((place: any) => {
    console.log('Selected place:', place);
    setShowProximitySearch(false);
  }, []);

  // Helper function to convert TourLandmark to Landmark
  const convertTourLandmarkToLandmark = useCallback((tourLandmark: any): Landmark => {
    return {
      id: tourLandmark.id || tourLandmark.placeId || `landmark-${Date.now()}`, // Ensure id exists
      name: tourLandmark.name,
      coordinates: tourLandmark.coordinates,
      description: tourLandmark.description,
      rating: tourLandmark.rating,
      photos: tourLandmark.photos,
      types: tourLandmark.types,
      placeId: tourLandmark.placeId,
      formattedAddress: tourLandmark.formattedAddress
    };
  }, []);

  // Debug panel in development
  const DebugPanel = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    
    return (
      <div className="absolute top-4 left-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50">
        <div>GeolocateState: {debugInfo.geolocateState}</div>
        <div>Last Event: {debugInfo.lastEventType}</div>
        <div>Flags:</div>
        {Object.entries(debugInfo.flagStates).map(([key, value]) => (
          <div key={key} className={`ml-2 ${value ? 'text-yellow-400' : 'text-gray-400'}`}>
            {key}: {value ? 'ON' : 'OFF'}
          </div>
        ))}
        <div>Last Source: {lastUpdateSource.current}</div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-screen">
      <DebugPanel />
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Top Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <SearchControl landmarks={landmarks} onSelectLandmark={onSelectLandmark || (() => {})} />
        <ProximityControlPanel />
        <Button
          variant="outline"
          size="icon"
          onClick={handleLocationToggle}
          className={`${isTracking ? 'bg-blue-500 text-white' : 'bg-white'} shadow-lg`}
        >
          <Navigation className="h-4 w-4" />
        </Button>
      </div>

      {/* Floating Proximity Card - Only show if we have nearby landmarks */}
      {nearbyLandmarks && nearbyLandmarks.length > 0 && userLocation && (
        <FloatingProximityCard 
          landmark={convertTourLandmarkToLandmark(nearbyLandmarks[0].landmark)}
          userLocation={userLocation}
          onClose={() => console.log('Closing proximity card')}
          onGetDirections={(landmark) => console.log('Getting directions to:', landmark)}
        />
      )}
      
      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <ProximityAutocomplete 
          onSuggestionSelect={handleSuggestionSelect}
          value={autocompleteQuery}
          onChange={setAutocompleteQuery}
          locationBias={userLocation ? {
            circle: {
              center: {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude
              },
              radius: 1000
            }
          } : undefined}
        />
      </div>
      
      {/* Proximity Search */}
      {showProximitySearch && userLocation && (
        <ProximitySearch 
          coordinates={[userLocation.longitude, userLocation.latitude]}
          onClose={() => setShowProximitySearch(false)}
          onSelectPlace={handlePlaceSelect}
        />
      )}
      
      {/* Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
};

export default Map;
