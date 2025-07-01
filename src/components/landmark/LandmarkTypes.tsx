
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatPlaceType } from '@/utils/landmarkDisplayUtils';

interface LandmarkTypesProps {
  types: string[];
  className?: string;
}

const LandmarkTypes: React.FC<LandmarkTypesProps> = ({
  types,
  className = ''
}) => {
  if (!types.length) return null;

  return (
    <div className={`flex gap-1 flex-wrap ${className}`}>
      {types.map((type) => (
        <Badge 
          key={type}
          variant="outline"
          className="text-xs px-2 py-0 text-gray-300 border-gray-600"
        >
          {formatPlaceType(type)}
        </Badge>
      ))}
    </div>
  );
};

export default LandmarkTypes;
