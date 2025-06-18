
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import { useTourStats } from '@/hooks/useTourStats';

const TourCounter: React.FC = () => {
  const { tourStats, isLoading } = useTourStats();

  if (isLoading || !tourStats) {
    return null;
  }

  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <MapPin className="w-3 h-3" />
      <span>{tourStats.tour_count} tours generated</span>
    </Badge>
  );
};

export default TourCounter;
