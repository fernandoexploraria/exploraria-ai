
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Mic, MapPin, PersonStanding, Star } from 'lucide-react';
import ShareButton from './ShareButton';
import { Interaction } from './InteractionCarouselLogic';

interface InteractionCardHeaderProps {
  interaction: Interaction;
  onToggleFavorite: (interaction: Interaction) => void;
  onLocationClick: (coordinates: any) => void;
}

const InteractionCardHeader: React.FC<InteractionCardHeaderProps> = ({ 
  interaction, 
  onToggleFavorite,
  onLocationClick 
}) => {
  const getInteractionTypeInfo = () => {
    // Handle different possible interaction type values
    const type = interaction.interaction_type?.toLowerCase() || 'voice';
    
    switch (type) {
      case 'voice':
        return {
          icon: Mic,
          label: 'Voice',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10'
        };
      case 'image':
      case 'image_recognition':
        return {
          icon: Camera,
          label: 'Image',
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10'
        };
      case 'map':
      case 'map_marker':
        return {
          icon: MapPin,
          label: 'Map',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10'
        };
      case 'proximity':
        return {
          icon: PersonStanding,
          label: 'Proximity Discovery',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10'
        };
      default:
        return {
          icon: Mic,
          label: 'Chat',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10'
        };
    }
  };

  const { icon: Icon, label, color, bgColor } = getInteractionTypeInfo();

  // Format the date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Get proximity-specific subtitle
  const getProximitySubtitle = () => {
    if (interaction.interaction_type !== 'proximity') return null;
    
    const mode = interaction.transportation_mode || 'walking';
    const distance = interaction.discovery_distance;
    
    let subtitle = `Discovered while ${mode}`;
    if (distance) {
      subtitle += ` • Found ${distance}m away`;
    }
    
    return subtitle;
  };

  const handleLocationClick = () => {
    console.log('Location button clicked for interaction:', interaction.id);
    console.log('Coordinates:', interaction.landmark_coordinates);
    
    if (interaction.landmark_coordinates) {
      // Call the global map navigation function directly without closing carousel
      console.log('Attempting to call navigateToMapCoordinates');
      if ((window as any).navigateToMapCoordinates) {
        console.log('navigateToMapCoordinates function found, calling it');
        (window as any).navigateToMapCoordinates(interaction.landmark_coordinates, interaction);
      } else {
        console.error('navigateToMapCoordinates function not found on window');
      }
    } else {
      console.log('No landmark coordinates available for this interaction');
    }
  };

  return (
    <div className="flex flex-col gap-2 mb-4">
      {/* Top row - Type badge and action buttons */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className={`${bgColor} ${color} border-0`}>
          <Icon className="w-3 h-3 mr-1" />
          {label}
        </Badge>
        
        <div className="flex items-center gap-1">
          {/* Share Button */}
          <ShareButton interaction={interaction} />
          
          {/* Location Button - only show if coordinates exist */}
          {interaction.landmark_coordinates && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleLocationClick}
              title="View on Map"
            >
              <MapPin className="w-3 h-3 text-red-400" />
            </Button>
          )}
          
          {/* Favorite Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onToggleFavorite(interaction)}
            title={interaction.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Star className={`w-3 h-3 ${interaction.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
          </Button>
        </div>
      </div>
      
      {/* Bottom row - Date and subtitle */}
      <div className="text-right">
        <div className="text-sm text-gray-400">
          {formatDate(interaction.created_at)}
        </div>
        {getProximitySubtitle() && (
          <div className="text-xs text-gray-500 mt-1">
            {getProximitySubtitle()}
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractionCardHeader;
