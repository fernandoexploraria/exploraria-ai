
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star, StarOff, Calendar, MapPin, Camera, Mic } from 'lucide-react';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  is_favorite: boolean;
  created_at: string;
  interaction_type: string;
  landmark_coordinates: any;
  landmark_image_url: string | null;
  full_transcript: any;
  similarity?: number;
}

interface InteractionCardProps {
  interaction: Interaction;
  index: number;
  isCurrentlyPlaying: boolean;
  onToggleFavorite: (interaction: Interaction) => void;
  onLocationClick: (coordinates: any) => void;
  onSlideDrawer?: () => void;
}

const InteractionCard: React.FC<InteractionCardProps> = ({
  interaction,
  index,
  isCurrentlyPlaying,
  onToggleFavorite,
  onLocationClick,
  onSlideDrawer,
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

  const renderContent = () => {
    const transcript = interaction.full_transcript;
    
    if (interaction.interaction_type === 'voice' && transcript && Array.isArray(transcript)) {
      return (
        <div className="space-y-1">
          {transcript
            .filter((entry: any) => entry.message && (entry.role === 'user' || entry.role === 'agent'))
            .map((entry: any, entryIndex: number) => (
              <div key={entryIndex} className={`p-2 rounded text-xs ${
                entry.role === 'user' 
                  ? 'bg-blue-900/30 text-blue-100' 
                  : 'bg-green-900/30 text-green-100'
              }`}>
                <span className="font-medium text-xs">
                  {entry.role === 'user' ? 'You:' : 'Assistant:'}
                </span>
                <p className="mt-1">
                  {entry.message}
                  {entry.role === 'agent' && entry.interrupted && (
                    <span className="text-orange-400 ml-1">(interrupted)</span>
                  )}
                </p>
              </div>
            ))}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="p-2 rounded text-xs bg-blue-900/30 text-blue-100">
          <span className="font-medium text-xs">You:</span>
          <p className="mt-1">{interaction.user_input}</p>
        </div>
        <div className="p-2 rounded text-xs bg-green-900/30 text-green-100">
          <span className="font-medium text-xs">Assistant:</span>
          <p className="mt-1">{interaction.assistant_response}</p>
        </div>
      </div>
    );
  };

  // New function specifically for handling "Show on Map" button click
  const handleShowOnMap = () => {
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

      // Slide the drawer to 7% instead of closing completely
      if (onSlideDrawer) {
        console.log('Sliding drawer to 7%...');
        onSlideDrawer();
      }
    } else {
      console.log('ERROR: No landmark coordinates found!');
    }
    console.log('=== End Debug ===');
  };

  return (
    <Card className={`w-full max-w-xs mx-auto border-gray-700 h-96 transition-all duration-300 ${
      isCurrentlyPlaying 
        ? 'bg-green-900/20 border-green-500/50 shadow-lg shadow-green-500/20' 
        : 'bg-gray-900'
    }`}>
      <CardContent className="p-3 h-full flex flex-col">
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
        
        <div className="flex items-center text-xs text-gray-400 mb-2">
          <Calendar className="w-3 h-3 mr-1" />
          {formatDate(interaction.created_at)}
        </div>

        {interaction.landmark_image_url && (
          <div className="mb-2 flex-shrink-0">
            <img 
              src={interaction.landmark_image_url} 
              alt="Landmark" 
              className="w-full h-20 object-cover rounded"
            />
          </div>
        )}

        <ScrollArea className="flex-1 w-full">
          {renderContent()}
        </ScrollArea>

        {interaction.landmark_coordinates && (
          <div className="mt-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={handleShowOnMap}
            >
              <MapPin className="w-3 h-3 mr-1" />
              Show on Map
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InteractionCard;
