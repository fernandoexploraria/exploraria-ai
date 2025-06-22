
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Camera, Mic, MapPin, PersonStanding } from 'lucide-react';
import { Interaction } from './InteractionCarouselLogic';

interface InteractionCardHeaderProps {
  interaction: Interaction;
}

const InteractionCardHeader: React.FC<InteractionCardHeaderProps> = ({ interaction }) => {
  const getInteractionTypeInfo = () => {
    switch (interaction.interaction_type) {
      case 'voice':
        return {
          icon: Mic,
          label: 'Voice Chat',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10'
        };
      case 'image':
        return {
          icon: Camera,
          label: 'Image Analysis',
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10'
        };
      case 'map':
        return {
          icon: MapPin,
          label: 'Map Search',
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
    
    // These properties might not exist on all interaction types, so we need to handle them safely
    const mode = (interaction as any).transportation_mode || 'walking';
    const distance = (interaction as any).discovery_distance;
    
    let subtitle = `Discovered while ${mode}`;
    if (distance) {
      subtitle += ` • Found ${distance}m away`;
    }
    
    return subtitle;
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className={`${bgColor} ${color} border-0`}>
          <Icon className="w-3 h-3 mr-1" />
          {label}
        </Badge>
      </div>
      
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
