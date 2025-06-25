
import { Landmark } from '@/data/landmarks';

// Image cache for landmark images
export const imageCache: { [key: string]: string } = {};

// Function to generate cache key for landmark images
export const generateImageCacheKey = (landmark: Landmark): string => {
  return `${landmark.name}-${landmark.coordinates[0]}-${landmark.coordinates[1]}`;
};

// Function to create seeded placeholder image URL
export const createFallbackImageUrl = (landmark: Landmark): string => {
  const seed = landmark.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `https://picsum.photos/seed/${seed}/400/300`;
};

// Function to create marker element with proper styling
export const createMarkerElement = (landmark: Landmark): HTMLDivElement => {
  const el = document.createElement('div');
  
  // Different styling for different landmark types
  const isTopLandmark = landmark.id.startsWith('top-landmark-');
  const isTourLandmark = landmark.id.startsWith('tour-landmark-');
  
  let markerColor;
  if (isTopLandmark) {
    markerColor = 'bg-yellow-400';
  } else if (isTourLandmark) {
    markerColor = 'bg-green-400';
  } else {
    markerColor = 'bg-cyan-400';
  }
  
  el.className = `w-4 h-4 rounded-full ${markerColor} border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125`;
  el.style.transition = 'background-color 0.3s, transform 0.3s';
  
  return el;
};

// Function to update marker style based on selection state
export const updateMarkerStyle = (element: HTMLElement, isSelected: boolean, landmark: Landmark) => {
  const isTopLandmark = landmark.id.startsWith('top-landmark-');
  const isTourLandmark = landmark.id.startsWith('tour-landmark-');
  
  if (isSelected) {
    element.style.backgroundColor = '#f87171'; // red-400
    element.style.transform = 'scale(1.5)';
  } else {
    if (isTopLandmark) {
      element.style.backgroundColor = '#facc15'; // yellow-400
    } else if (isTourLandmark) {
      element.style.backgroundColor = '#4ade80'; // green-400
    } else {
      element.style.backgroundColor = '#22d3ee'; // cyan-400
    }
    element.style.transform = 'scale(1)';
  }
};
