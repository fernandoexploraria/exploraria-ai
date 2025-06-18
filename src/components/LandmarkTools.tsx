
import React from 'react';
import { Landmark } from '@/data/landmarks';

interface LandmarkToolsProps {
  landmark: Landmark;
}

const LandmarkTools: React.FC<LandmarkToolsProps> = ({ landmark }) => {
  return (
    <div className="space-y-4">
      {/* Tools will be added here in the future */}
    </div>
  );
};

export default LandmarkTools;
