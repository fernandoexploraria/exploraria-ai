
import React from 'react';
import CameraCapture from '@/components/CameraCapture';
import { Landmark } from '@/data/landmarks';

interface CameraControlsProps {
  currentDestination: string;
  selectedLandmark: Landmark | null;
  onImageCapture: (imageData: string) => void;
  isAnalyzing: boolean;
}

const CameraControls: React.FC<CameraControlsProps> = ({
  currentDestination,
  selectedLandmark,
  onImageCapture,
  isAnalyzing
}) => {
  if (!currentDestination) return null;

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
      <div className="bg-background/90 backdrop-blur-sm shadow-lg rounded-lg p-4">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground text-center">
            {selectedLandmark 
              ? `Analyze ${selectedLandmark.name} with your camera`
              : `Analyze any landmark in ${currentDestination} with your camera`
            }
          </p>
          <CameraCapture 
            onImageCapture={onImageCapture}
            isLoading={isAnalyzing}
          />
        </div>
      </div>
    </div>
  );
};

export default CameraControls;
