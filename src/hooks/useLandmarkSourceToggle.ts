
import { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { convertTopLandmarkToLandmark } from '@/utils/landmarkUtils';

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

export const useLandmarkSourceToggle = () => {
  const [selectedSource, setSelectedSource] = useState<LandmarkSource>('all');
  
  // Get all landmarks from TOP_LANDMARKS array with validation
  const allLandmarks = TOP_LANDMARKS
    .map(convertTopLandmarkToLandmark)
    .filter((landmark): landmark is Landmark => landmark !== null);

  console.log(`useLandmarkSourceToggle: Processed ${allLandmarks.length} valid landmarks from ${TOP_LANDMARKS.length} total`);

  return {
    selectedSource,
    setSelectedSource,
    currentLandmarks: allLandmarks,
    sourceCounts: {
      all: allLandmarks.length
    }
  };
};
