
import React, { useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Landmark } from '@/data/landmarks';
import { supabase } from '@/integrations/supabase/client';
import { imageCache, generateImageCacheKey, createFallbackImageUrl } from '@/utils/mapUtils';

interface UsePopupManagerProps {
  map: mapboxgl.Map | null;
  photoPopupsRef: React.MutableRefObject<{ [key: string]: mapboxgl.Popup }>;
  currentAudio: React.MutableRefObject<HTMLAudioElement | null>;
  playingAudio: { [key: string]: boolean };
  setPlayingAudio: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  onStreetViewOpen: (landmarkId: string) => void;
}

export const usePopupManager = ({
  map,
  photoPopupsRef,
  currentAudio,
  playingAudio,
  setPlayingAudio,
  onStreetViewOpen
}: UsePopupManagerProps) => {
  // Function to stop current audio playback
  const stopCurrentAudio = () => {
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.currentTime = 0;
      currentAudio.current = null;
    }
    setPlayingAudio({});
  };

  // Function to fetch landmark image using Supabase edge function
  const fetchLandmarkImage = async (landmark: Landmark): Promise<string> => {
    const cacheKey = generateImageCacheKey(landmark);
    
    if (imageCache[cacheKey]) {
      console.log('Using cached image for:', landmark.name);
      return imageCache[cacheKey];
    }

    try {
      console.log('Fetching image via edge function for:', landmark.name);
      
      const { data, error } = await supabase.functions.invoke('fetch-landmark-image', {
        body: { 
          landmarkName: landmark.name,
          coordinates: landmark.coordinates
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data && data.imageUrl) {
        console.log('Received image URL for:', landmark.name, data.isFallback ? '(fallback)' : '(Google Places)');
        imageCache[cacheKey] = data.imageUrl;
        return data.imageUrl;
      }

      throw new Error('No image URL received from edge function');
      
    } catch (error) {
      console.error('Error fetching image for', landmark.name, error);
      
      const fallbackUrl = createFallbackImageUrl(landmark);
      imageCache[cacheKey] = fallbackUrl;
      return fallbackUrl;
    }
  };

  // Function to show landmark popup
  const showLandmarkPopup = async (landmark: Landmark, hasStreetView: boolean = false) => {
    if (!map) return;
    
    console.log('🗺️ [PopupManager] Showing popup for:', landmark.name);
    
    stopCurrentAudio();
    
    // Remove existing photo popup for this landmark
    if (photoPopupsRef.current[landmark.id]) {
      photoPopupsRef.current[landmark.id].remove();
    }
    
    // Close all other popups first
    Object.values(photoPopupsRef.current).forEach(popup => {
      popup.remove();
    });
    photoPopupsRef.current = {};
    
    // Create new photo popup
    const photoPopup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 25,
      maxWidth: '450px',
      className: 'custom-popup'
    });

    // Initial popup with loading state
    photoPopup
      .setLngLat(landmark.coordinates)
      .setHTML(`
        <div style="text-align: center; padding: 10px; position: relative;">
          <button class="custom-close-btn" onclick="
            if (window.handlePopupClose) window.handlePopupClose('${landmark.id}');
            this.closest('.mapboxgl-popup').remove();
          " style="
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            z-index: 1000;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'" onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.7)'">×</button>
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${landmark.name}</h3>
          <div style="margin-bottom: 10px; color: #666;">Loading image...</div>
        </div>
      `)
      .addTo(map);

    photoPopupsRef.current[landmark.id] = photoPopup;

    // Handle popup close event
    photoPopup.on('close', () => {
      stopCurrentAudio();
      delete photoPopupsRef.current[landmark.id];
    });

    // Fetch and display image with action buttons
    try {
      const imageUrl = await fetchLandmarkImage(landmark);
      const isPlaying = playingAudio[landmark.id] || false;
      
      const streetViewButton = hasStreetView ? `
        <button 
          class="streetview-btn-${landmark.id}" 
          onclick="window.handleStreetViewOpen('${landmark.id}')"
          style="
            background: rgba(59, 130, 246, 0.95);
            color: white;
            border: 3px solid rgba(255, 255, 255, 0.9);
            border-radius: 50%;
            width: 56px;
            height: 56px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          "
          onmouseover="this.style.backgroundColor='rgba(37, 99, 235, 1)'; this.style.borderColor='white'; this.style.transform='scale(1.15)'; this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.5)'"
          onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.95)'; this.style.borderColor='rgba(255, 255, 255, 0.9)'; this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.4)'"
          title="View Street View"
        >
          👁️
        </button>
      ` : '';
      
      photoPopup.setHTML(`
        <div style="text-align: center; padding: 10px; max-width: 400px; position: relative;">
          <button class="custom-close-btn" onclick="
            if (window.handlePopupClose) window.handlePopupClose('${landmark.id}');
            this.closest('.mapboxgl-popup').remove();
          " style="
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            z-index: 1000;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'" onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.7)'">×</button>
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${landmark.name}</h3>
          <div style="position: relative; margin-bottom: 10px;">
            <img src="${imageUrl}" alt="${landmark.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;" />
            <div style="position: absolute; bottom: 10px; right: 10px; display: flex; gap: 8px;">
              ${streetViewButton}
              <button 
                class="listen-btn-${landmark.id}" 
                onclick="window.handleLandmarkListen('${landmark.id}')"
                style="
                  background: rgba(0, 0, 0, 0.9);
                  color: white;
                  border: 3px solid rgba(255, 255, 255, 0.9);
                  border-radius: 50%;
                  width: 56px;
                  height: 56px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 24px;
                  transition: all 0.3s ease;
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                  ${isPlaying ? 'opacity: 0.7;' : ''}
                "
                onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.95)'; this.style.borderColor='white'; this.style.transform='scale(1.15)'; this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.5)'"
                onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'; this.style.borderColor='rgba(255, 255, 255, 0.9)'; this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.4)'"
                ${isPlaying ? 'disabled' : ''}
                title="Listen to description"
              >
                🔊
              </button>
            </div>
          </div>
        </div>
      `);

    } catch (error) {
      console.error('Failed to load image for', landmark.name, error);
      // Handle no-image case similar to above but without image
      photoPopup.setHTML(`
        <div style="text-align: center; padding: 10px; max-width: 400px; position: relative;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #1a1a1a;">${landmark.name}</h3>
          <div style="width: 100%; height: 150px; background-color: #f0f0f0; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #888;">
            No image available
          </div>
        </div>
      `);
    }
  };

  return { showLandmarkPopup, stopCurrentAudio };
};
