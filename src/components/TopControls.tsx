
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Search, Star, User } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import SearchControl from '@/components/SearchControl';
import FreeTourCounter from '@/components/FreeTourCounter';
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

  return (
    <div className="absolute top-4 left-4 z-10">
      {/* Vertical layout for all screen sizes */}
      <div className="flex flex-col items-start gap-2 max-w-[calc(100vw-120px)]">
        {/* Logo */}
        <img 
          src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
          alt="Exploraria Logo" 
          className="h-16 w-auto bg-yellow-400 rounded-lg p-1 flex-shrink-0 lg:h-20"
        />
        
        {/* Search Control */}
        <SearchControl landmarks={allLandmarks} onSelectLandmark={onSelectLandmark} />
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-1 w-full">
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
            onClick={onTourPlannerOpen}
          >
            <Sparkles className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
            <span className="lg:hidden">Plan Tour</span>
            <span className="hidden lg:inline">Plan a Tour</span>
          </Button>
          
          {user ? (
            <>
              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                  >
                    <Avatar className="mr-1 h-4 w-4 lg:mr-2 lg:h-5 lg:w-5">
                      <AvatarImage src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" alt="Profile" />
                      <AvatarFallback>
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    Profile
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={onFavoritesOpen}>
                    <Star className="mr-2 h-4 w-4" />
                    Bookmarks
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onVoiceSearchOpen}>
                    <Search className="mr-2 h-4 w-4" />
                    History
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
              onClick={onFavoritesOpen}
            >
              <Star className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
              Bookmarks
            </Button>
          )}
          
          {plannedLandmarks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
              onClick={onVoiceAssistantOpen}
            >
              <Sparkles className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
              Voice Guide
            </Button>
          )}
          
          {user && <FreeTourCounter />}
        </div>
      </div>
    </div>
  );
};

export default TopControls;
