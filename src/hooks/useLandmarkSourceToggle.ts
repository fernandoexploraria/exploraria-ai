
import { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS, TopLandmark } from '@/data/topLandmarks';
import { useCombinedLandmarks } from '@/hooks/useCombinedLandmarks';

export type LandmarkSource = 'top100' | 'tour' | 'combined';

export interface LandmarkSourceOption {
  value: LandmarkSource;
  label: string;
  description: string;
}

export const LANDMARK_SOURCE_OPTIONS: LandmarkSourceOption[] = [
  {
    value: 'top100',
    label: 'Top 100 Only',
    description: 'Show only the static top 100 landmarks'
  },
  {
    value: 'tour',
    label: 'Tour Only', 
    description: 'Show only tour-generated landmarks'
  },
  {
    value: 'combined',
    label: 'Combined',
    description: 'Show both top 100 and tour landmarks'
  }
];

// Convert TopLandmark to Landmark format
const convertTopLandmarkToLandmark = (topLandmark: TopLandmark): Landmark => {
  return {
    id: `top-${topLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: topLandmark.name,
    coordinates: topLandmark.coordinates,
    description: topLandmark.description
  };
};

export const useLandmarkSourceToggle = (tourLandmarks: Landmark[] = []) => {
  const [selectedSource, setSelectedSource] = useState<LandmarkSource>('combined');
  
  // Get all landmark sources
  const combinedLandmarks = useCombinedLandmarks(tourLandmarks);
  const top100Landmarks = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);

  // Select the appropriate landmark set based on current selection
  const getCurrentLandmarks = (): Landmark[] => {
    switch (selectedSource) {
      case 'top100':
        return top100Landmarks;
      case 'tour':
        return tourLandmarks;
      case 'combined':
      default:
        return combinedLandmarks;
    }
  };

  const currentLandmarks = getCurrentLandmarks();

  return {
    selectedSource,
    setSelectedSource,
    currentLandmarks,
    sourceCounts: {
      top100: top100Landmarks.length,
      tour: tourLandmarks.length,
      combined: combinedLandmarks.length
    }
  };
};
