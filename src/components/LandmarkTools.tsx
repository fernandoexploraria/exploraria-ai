
import React from 'react';
import { Landmark } from '@/data/landmarks';

interface LandmarkToolsProps {
  landmark: Landmark;
}

const LandmarkTools: React.FC<LandmarkToolsProps> = ({ landmark }) => {
  return (
    <div className="space-y-4">
      <div className="text-center text-gray-500 text-sm">
        Additional tools for {landmark.name} will be available here.
      </div>
    </div>
  );
};

export default LandmarkTools;
