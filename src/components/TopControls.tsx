
import React from 'react';
import { Landmark } from '@/data/landmarks';
import SearchControl from './SearchControl';
import { Button } from './ui/button';
import { MapPin, Heart, Mic, Bot } from 'lucide-react';
import ImageAnalysis from './ImageAnalysis';

interface TopControlsProps {
  allLandmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  onTourPlannerOpen: () => void;
  onFavoritesOpen: () => void;
  onVoiceSearchOpen: () => void;
  onVoiceAssistantOpen: () => void;
  user: any;
  plannedLandmarks: Landmark[];
}

const TopControls: React.FC<TopControlsProps> = ({
  allLandmarks,
  onSelectLandmark,
  onTourPlannerOpen,
  onFavoritesOpen,
  onVoiceSearchOpen,
  onVoiceAssistantOpen,
  user,
  plannedLandmarks
}) => {
  const hasTour = plannedLandmarks.length > 0;

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex items-center space-x-2">
      {/* Search Control */}
      <div className="flex-1">
        <SearchControl 
          landmarks={allLandmarks} 
          onSelectLandmark={onSelectLandmark}
        />
      </div>
      
      {/* Control Buttons */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onTourPlannerOpen}
          className="bg-white/90 backdrop-blur-sm"
          title="Plan Tour"
        >
          <MapPin className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onFavoritesOpen}
          className="bg-white/90 backdrop-blur-sm"
          title="Favorites"
        >
          <Heart className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onVoiceSearchOpen}
          className="bg-white/90 backdrop-blur-sm"
          title="Voice Search"
        >
          <Mic className="h-4 w-4" />
        </Button>

        {hasTour && (
          <Button
            variant="outline"
            size="icon"
            onClick={onVoiceAssistantOpen}
            className="bg-white/90 backdrop-blur-sm"
            title="Voice Assistant"
          >
            <Bot className="h-4 w-4" />
          </Button>
        )}

        {hasTour && (
          <div className="bg-white/90 backdrop-blur-sm rounded-md p-1">
            <ImageAnalysis 
              landmarks={plannedLandmarks}
              destination={plannedLandmarks[0]?.name?.split(',')[0] || 'Unknown'}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TopControls;
