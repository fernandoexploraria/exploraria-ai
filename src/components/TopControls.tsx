
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Search, Star } from 'lucide-react';
import SearchControl from '@/components/SearchControl';
import { Landmark } from '@/data/landmarks';

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
  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
      <img 
        src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
        alt="Explorar-IA Logo" 
        className="h-10 w-auto bg-yellow-400 rounded-lg p-1"
      />
      <SearchControl landmarks={allLandmarks} onSelectLandmark={onSelectLandmark} />
      <Button
        variant="outline"
        className="bg-background/80 backdrop-blur-sm shadow-lg"
        onClick={onTourPlannerOpen}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Plan a Tour
      </Button>
      {user && (
        <>
          <Button
            variant="outline"
            className="bg-background/80 backdrop-blur-sm shadow-lg"
            onClick={onFavoritesOpen}
          >
            <Star className="mr-2 h-4 w-4" />
            Favorites
          </Button>
          <Button
            variant="outline"
            className="bg-background/80 backdrop-blur-sm shadow-lg"
            onClick={onVoiceSearchOpen}
          >
            <Search className="mr-2 h-4 w-4" />
            Search Conversations
          </Button>
        </>
      )}
      {plannedLandmarks.length > 0 && (
        <Button
          variant="outline"
          className="bg-background/80 backdrop-blur-sm shadow-lg"
          onClick={onVoiceAssistantOpen}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Voice Guide
        </Button>
      )}
    </div>
  );
};

export default TopControls;
