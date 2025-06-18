
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Search, Star, Bookmark } from 'lucide-react';
import SearchControl from '@/components/SearchControl';
import { Landmark } from '@/data/landmarks';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

  // Use vertical layout for mobile and tablet (up to lg breakpoint)
  const useVerticalLayout = true; // This will apply to all screen sizes below lg (1024px)

  return (
    <div className="absolute top-4 left-4 z-10">
      {/* Show vertical layout for mobile and tablet */}
      <div className="flex flex-col gap-2 max-w-[calc(100vw-120px)] lg:hidden">
        <div className="flex items-center gap-2">
          <img 
            src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
            alt="Exploraria Logo" 
            className="h-16 w-auto bg-yellow-400 rounded-lg p-1 flex-shrink-0"
          />
          <SearchControl landmarks={allLandmarks} onSelectLandmark={onSelectLandmark} />
        </div>
        <div className="flex flex-col gap-1 w-fit">
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full"
            onClick={onTourPlannerOpen}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Plan Tour
          </Button>
          {user && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full"
                onClick={onFavoritesOpen}
              >
                <Star className="mr-1 h-3 w-3" />
                Favorites
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full"
                onClick={onVoiceSearchOpen}
              >
                <Search className="mr-1 h-3 w-3" />
                Search
              </Button>
            </>
          )}
          {plannedLandmarks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full"
              onClick={onVoiceAssistantOpen}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Voice Guide
            </Button>
          )}
        </div>
      </div>

      {/* Show horizontal layout for desktop only */}
      <div className="hidden lg:flex items-center gap-2">
        <img 
          src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
          alt="Exploraria Logo" 
          className="h-20 w-auto bg-yellow-400 rounded-lg p-1"
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
    </div>
  );
};

export default TopControls;
