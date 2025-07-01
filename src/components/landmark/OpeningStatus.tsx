
import React from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OpeningStatusProps {
  isOpen?: boolean;
  className?: string;
}

const OpeningStatus: React.FC<OpeningStatusProps> = ({
  isOpen,
  className = ''
}) => {
  if (isOpen === undefined) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Clock className="w-3 h-3 text-gray-400" />
      <Badge 
        variant={isOpen ? "default" : "secondary"}
        className={`text-xs px-2 py-0 ${
          isOpen 
            ? 'bg-green-500 text-white hover:bg-green-600' 
            : 'bg-red-500 text-white hover:bg-red-600'
        }`}
      >
        {isOpen ? 'Open Now' : 'Closed'}
      </Badge>
    </div>
  );
};

export default OpeningStatus;
