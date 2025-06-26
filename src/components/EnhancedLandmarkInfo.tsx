
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, MapPin, Shield, Database, Camera } from 'lucide-react';
import { EnhancedLandmark } from '@/data/landmarks';

interface EnhancedLandmarkInfoProps {
  landmark: EnhancedLandmark;
}

const EnhancedLandmarkInfo: React.FC<EnhancedLandmarkInfoProps> = ({ landmark }) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.5) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'places':
        return <MapPin className="h-3 w-3" />;
      case 'geocoding':
        return <Database className="h-3 w-3" />;
      case 'gemini':
        return <Shield className="h-3 w-3" />;
      default:
        return <MapPin className="h-3 w-3" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'places':
        return 'Google Places';
      case 'geocoding':
        return 'Google Geocoding';
      case 'gemini':
        return 'Gemini AI';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{landmark.name}</span>
          {landmark.rating && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{landmark.rating}</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{landmark.description}</p>
        
        {landmark.formattedAddress && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">{landmark.formattedAddress}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge className={`${getConfidenceColor(landmark.confidence)} border-0`}>
            <Shield className="h-3 w-3 mr-1" />
            {Math.round(landmark.confidence * 100)}% confident
          </Badge>
          
          <Badge variant="outline" className="flex items-center gap-1">
            {getSourceIcon(landmark.coordinateSource)}
            {getSourceLabel(landmark.coordinateSource)}
          </Badge>
        </div>

        {landmark.types && landmark.types.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Categories:</div>
            <div className="flex flex-wrap gap-1">
              {landmark.types.slice(0, 5).map((type, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {type.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {landmark.photos && landmark.photos.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-1">
              <Camera className="h-4 w-4" />
              Photos Available ({landmark.photos.length})
            </div>
            <div className="grid grid-cols-3 gap-2">
              {landmark.photos.slice(0, 3).map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`${landmark.name} ${index + 1}`}
                  className="w-full h-16 object-cover rounded border"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedLandmarkInfo;
