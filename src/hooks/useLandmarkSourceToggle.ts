
import { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS, TopLandmark } from '@/data/topLandmarks';

export type LandmarkSource = 'all';

export interface LandmarkSourceOption {
  value: LandmarkSource;
  label: string;
  description: string;
}

export const LANDMARK_SOURCE_OPTIONS: LandmarkSourceOption[] = [
  {
    value: 'all',
    label: 'All Landmarks',
    description: 'Show all available landmarks (top 100 + tour-generated)'
  }
];

// Convert TopLandmark to Landmark format
const convertTopLandmarkToLandmark = (topLandmark: TopLandmark): Landmark => {
  return {
    id: `top-${topLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: topLandmark.name,
    coordinates: topLandmark.coordinates,
    location: {
      lat: topLandmark.coordinates[1],
      lng: topLandmark.coordinates[0]
    },
    description: topLandmark.description
  };
};

export const useLandmarkSourceToggle = () => {
  const [selectedSource, setSelectedSource] = useState<LandmarkSource>('all');
  
  // Get all landmarks from TOP_LANDMARKS array (includes tour landmarks)
  const allLandmarks = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);

  return {
    selectedSource,
    setSelectedSource,
    currentLandmarks: allLandmarks,
    sourceCounts: {
      all: allLandmarks.length
    }
  };
};
