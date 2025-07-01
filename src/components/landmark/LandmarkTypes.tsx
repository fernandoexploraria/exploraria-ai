
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatPlaceType } from '@/utils/landmarkDisplayUtils';

interface LandmarkTypesProps {
  types: string[];
}

const LandmarkTypes: React.FC<LandmarkTypesProps> = ({ types }) => {
  if (types.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {types.map((type, index) => (
        <Badge key={index} variant="secondary" className="text-xs">
          {formatPlaceType(type)}
        </Badge>
      ))}
    </div>
  );
};

export default LandmarkTypes;
