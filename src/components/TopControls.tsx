import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Map, MessageSquare, Compass, Instagram } from 'lucide-react';
import ImageAnalysis from './ImageAnalysis';
import { Landmark } from '@/data/landmarks';

interface TopControlsProps {
  plannedLandmarks: Landmark[];
  onTourPlannerOpen: () => void;
  onVoiceSearchOpen: () => void;
  onVoiceAssistantOpen: () => void;
  onInstagramOpen?: () => void; // Add this prop
}

const TopControls: React.FC<TopControlsProps> = ({ 
  plannedLandmarks, 
  onTourPlannerOpen, 
  onVoiceSearchOpen,
  onVoiceAssistantOpen,
  onInstagramOpen
}) => {
  const hasPlannedLandmarks = plannedLandmarks && plannedLandmarks.length > 0;

  return (
    <div className="absolute top-16 left-4 z-10 flex flex-col gap-2 lg:gap-3 w-40 lg:w-48">
      <Button
        variant="outline"
        size="sm"
        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
        onClick={onTourPlannerOpen}
      >
        <Map className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
        <span className="lg:hidden">Tour Planner</span>
        <span className="hidden lg:inline">Tour Planner</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
        onClick={onVoiceSearchOpen}
      >
        <MessageSquare className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
        <span className="lg:hidden">Travel Log</span>
        <span className="hidden lg:inline">Travel Log</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
        onClick={onVoiceAssistantOpen}
      >
        <Compass className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
        <span className="lg:hidden">New Tour</span>
        <span className="hidden lg:inline">New Tour</span>
      </Button>
      
      {onInstagramOpen && (
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 hover:from-purple-500/20 hover:to-pink-500/20"
          onClick={onInstagramOpen}
        >
          <Instagram className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4 text-pink-500" />
          <span className="lg:hidden">Instagram</span>
          <span className="hidden lg:inline">Travel Memories</span>
        </Button>
      )}

      {hasPlannedLandmarks && (
        <ImageAnalysis plannedLandmarks={plannedLandmarks} />
      )}
    </div>
  );
};

export default TopControls;
