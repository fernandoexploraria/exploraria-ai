
import React from 'react';
import { Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EnhancedBadgeProps {
  className?: string;
}

const EnhancedBadge: React.FC<EnhancedBadgeProps> = ({
  className = ''
}) => {
  return (
    <Badge 
      className={`bg-blue-500 text-white hover:bg-blue-600 text-xs px-2 py-0 ${className}`}
    >
      <Database className="w-3 h-3 mr-1" />
      Enhanced
    </Badge>
  );
};

export default EnhancedBadge;
