import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, StarOff, Calendar, Camera, Mic, MapPin } from 'lucide-react';
import ShareButton from './ShareButton';
import { Interaction } from './InteractionCarouselLogic';

interface InteractionCardHeaderProps {
  interaction: Interaction;
  onToggleFavorite: (interaction: Interaction) => void;
}

const InteractionCardHeader: React.FC<InteractionCardHeaderProps> = ({
  interaction,
  onToggleFavorite,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleShowOnMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('=== Show on Map Debug ===');
    console.log('Button clicked!');
    console.log('Interaction:', interaction);
    console.log('Landmark coordinates:', interaction.landmark_coordinates);
    console.log('Coordinates type:', typeof interaction.landmark_coordinates);
    console.log('Window navigateToMapCoordinates function exists:', !!(window as any).navigateToMapCoordinates);
    
    if (interaction.landmark_coordinates) {
      let coordinates: [number, number];
      
      // Handle different coordinate formats
      if (typeof interaction.landmark_coordinates === 'string') {
        // Handle string format like "(-99.1706976631243,19.3494767782822)"
        const coordString = interaction.landmark_coordinates.replace(/[()]/g, ''); // Remove parentheses
        const parts = coordString.split(',');
        if (parts.length === 2) {
          coordinates = [Number(parts[0].trim()), Number(parts[1].trim())];
        } else {
          console.log('ERROR: Invalid string coordinate format!', interaction.landmark_coordinates);
          return;
        }
      } else if (Array.isArray(interaction.landmark_coordinates)) {
        // If it's already an array [lng, lat]
        coordinates = [
          Number(interaction.landmark_coordinates[0]),
          Number(interaction.landmark_coordinates[1])
        ];
      } else if (typeof interaction.landmark_coordinates === 'object') {
        // If it's an object with x,y or lng,lat or longitude,latitude properties
        const coords = interaction.landmark_coordinates as any;
        coordinates = [
          Number(coords.lng || coords.longitude || coords.x || coords[0]),
          Number(coords.lat || coords.latitude || coords.y || coords[1])
        ];
      } else {
        console.log('ERROR: Unexpected coordinate format!');
        return;
      }
      
      console.log('Processed coordinates:', coordinates);
      console.log('Coordinate 0 (lng):', coordinates[0], 'type:', typeof coordinates[0]);
      console.log('Coordinate 1 (lat):', coordinates[1], 'type:', typeof coordinates[1]);
      
      // Validate coordinates are actual numbers
      if (isNaN(coordinates[0]) || isNaN(coordinates[1])) {
        console.log('ERROR: Coordinates are NaN!', coordinates);
        return;
      }
      
      // Call the new navigation function from Map component with interaction data
      if ((window as any).navigateToMapCoordinates) {
        console.log('Calling navigateToMapCoordinates with interaction data...');
        (window as any).navigateToMapCoordinates(coordinates, interaction);
      } else {
        console.log('ERROR: navigateToMapCoordinates function not found on window!');
      }
    } else {
      console.log('ERROR: No landmark coordinates found!');
    }
    console.log('=== End Debug ===');
  };

  // Determine icon based on interaction type
  let IconComponent, iconColor;
  if (interaction.interaction_type === 'voice') {
    IconComponent = Mic;
    iconColor = 'text-blue-400';
  } else if (interaction.interaction_type === 'image_recognition') {
    IconComponent = Camera;
    iconColor = 'text-purple-400';
  } else if (interaction.interaction_type === 'map_marker') {
    IconComponent = MapPin;
    iconColor = 'text-red-400';
  } else {
    IconComponent = Mic;
    iconColor = 'text-blue-400';
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <IconComponent className={`w-3 h-3 ${iconColor}`} />
          <Badge variant="outline" className="text-xs px-1 py-0">{interaction.destination}</Badge>
          {interaction.similarity && (
            <Badge variant="secondary" className="text-xs px-1 py-0">
              {Math.round(interaction.similarity * 100)}% match
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ShareButton interaction={interaction} />
          {interaction.landmark_coordinates && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleShowOnMap}
              title="Show on map"
            >
              <MapPin className="w-3 h-3 text-red-400" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onToggleFavorite(interaction)}
          >
            {interaction.is_favorite ? (
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
            ) : (
              <StarOff className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex items-center text-xs text-gray-400 mb-2">
        <Calendar className="w-3 h-3 mr-1" />
        {formatDate(interaction.created_at)}
      </div>
    </>
  );
};

export default InteractionCardHeader;
