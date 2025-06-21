
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import InstagramCaptionGenerator from './InstagramCaptionGenerator';

interface LandmarkDetailProps {
  landmark: Landmark;
}

const LandmarkDetail: React.FC<LandmarkDetailProps> = ({ landmark }) => {
  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {landmark.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">{landmark.description}</p>
          <div className="mt-2 text-sm text-gray-500">
            Coordinates: {landmark.coordinates[1].toFixed(4)}, {landmark.coordinates[0].toFixed(4)}
          </div>
        </CardContent>
      </Card>

      <InstagramCaptionGenerator landmark={landmark} />
    </div>
  );
};

export default LandmarkDetail;
