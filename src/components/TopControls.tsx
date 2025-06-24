
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Search, ChevronDown, ChevronUp, Menu, Bug } from 'lucide-react';
import SearchControl from '@/components/SearchControl';
import FreeTourCounter from '@/components/FreeTourCounter';
import ImageAnalysis from '@/components/ImageAnalysis';
import LandmarksDebugWindow from '@/components/LandmarksDebugWindow';
import { Landmark } from '@/data/landmarks';
import { useIsMobile } from '@/hooks/use-mobile';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';

interface TopControlsProps {
  allLandmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  onTourPlannerOpen: () => void;
  onVoiceSearchOpen: () => void;
  onVoiceAssistantOpen: () => void;
  onLogoClick: () => void;
  user: any;
  plannedLandmarks: Landmark[];
}

const TopControls: React.FC<TopControlsProps> = ({
  allLandmarks,
  onSelectLandmark,
  onTourPlannerOpen,
  onVoiceSearchOpen,
  onVoiceAssistantOpen,
  onLogoClick,
  user,
  plannedLandmarks
}) => {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const { proximitySettings } = useProximityAlerts();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const isProximityEnabled = proximitySettings?.is_enabled || false;

  return (
    <div className="absolute top-4 left-4 z-10">
      {/* Vertical layout for all screen sizes */}
      <div className="flex flex-col items-start gap-2 max-w-[calc(100vw-120px)]">
        {/* Logo */}
        <img 
          src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
          alt="Exploraria Logo" 
          className="h-16 w-auto bg-yellow-400 rounded-lg p-1 flex-shrink-0 lg:h-20 cursor-pointer hover:bg-yellow-300 transition-colors"
          onClick={onLogoClick}
        />
        
        {/* Search Control */}
        <SearchControl landmarks={allLandmarks} onSelectLandmark={onSelectLandmark} />
        
        {/* Collapse Toggle Button */}
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
          onClick={toggleCollapse}
        >
          <Menu className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
          <span className="lg:hidden">Menu</span>
          <span className="hidden lg:inline">Menu</span>
          {isCollapsed ? (
            <ChevronDown className="ml-auto h-3 w-3 lg:h-4 lg:w-4" />
          ) : (
            <ChevronUp className="ml-auto h-3 w-3 lg:h-4 lg:w-4" />
          )}
        </Button>
        
        {/* Action Buttons - Collapsible */}
        {!isCollapsed && (
          <div className="flex flex-col gap-1 w-full animate-fade-in">
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
            
            {plannedLandmarks.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                onClick={onVoiceAssistantOpen}
              >
                <Sparkles className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                Tour Guide
              </Button>
            )}
            
            {user && (
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                onClick={onVoiceSearchOpen}
              >
                <Search className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                Travel Log
              </Button>
            )}

            {/* Debug Window Button - Only show when proximity is enabled */}
            {user && isProximityEnabled && (
              <Button
                variant="outline"
                size="sm"
                className="bg-amber-100/80 hover:bg-amber-200/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 border-amber-300"
                onClick={() => setIsDebugOpen(true)}
              >
                <Bug className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4 text-amber-700" />
                <span className="lg:hidden text-amber-700">Debug</span>
                <span className="hidden lg:inline text-amber-700">Debug: Show Landmarks</span>
              </Button>
            )}

            {/* Image Analysis Button */}
            <ImageAnalysis plannedLandmarks={plannedLandmarks} />
            
            {user && <FreeTourCounter />}
          </div>
        )}
      </div>

      {/* Debug Window */}
      <LandmarksDebugWindow
        open={isDebugOpen}
        onOpenChange={setIsDebugOpen}
      />
    </div>
  );
};

export default TopControls;
