import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Search, ChevronDown, ChevronUp, Menu, List, TestTube } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import SearchControl from '@/components/SearchControl';
import FreeTourCounter from '@/components/FreeTourCounter';
import ImageAnalysis from '@/components/ImageAnalysis';
import DebugWindow from '@/components/DebugWindow';
import ConnectionStatus from '@/components/ConnectionStatus';
import EnhancedTourGeneratorDialog from '@/components/EnhancedTourGeneratorDialog';
import { Landmark } from '@/data/landmarks';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  plannedLandmarks,
}) => {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);
  const [isTestingCors, setIsTestingCors] = useState(false);
  const [isEnhancedTourOpen, setIsEnhancedTourOpen] = useState(false);
  const { toast } = useToast();
  
  // Initialize connection monitoring
  const { connectionHealth } = useConnectionMonitor();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleTestCors = async () => {
    setIsTestingCors(true);
    console.log('🧪 Starting CORS test...');
    
    try {
      const { data, error } = await supabase.functions.invoke('test-cors', {
        body: { test: 'cors-functionality' }
      });

      if (error) {
        console.error('🧪 CORS test error:', error);
        toast({
          title: "CORS Test Failed",
          description: `Error: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('🧪 CORS test success:', data);
        toast({
          title: "CORS Test Successful!",
          description: `Response: ${data.message}`,
        });
      }
    } catch (error) {
      console.error('🧪 CORS test exception:', error);
      toast({
        title: "CORS Test Exception",
        description: `Exception: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsTestingCors(false);
    }
  };

  const handleEnhancedTourGenerated = (tourId: string, destination: string) => {
    console.log('Enhanced tour generated:', { tourId, destination });
    setIsEnhancedTourOpen(false);
    toast({
      title: "Tour Ready!",
      description: `Your personalized tour of ${destination} is ready!`,
    });
  };

  return (
    <>
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
          
          {/* Connection Status - Show compact version when collapsed or if there are issues */}
          {(isCollapsed || !connectionHealth.isHealthy) && (
            <ConnectionStatus compact className="w-full" />
          )}
          
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
              {/* New Smart Tour Generator Button */}
              <Button
                variant="outline"
                size="sm"
                className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 border-purple-200"
                onClick={() => setIsEnhancedTourOpen(true)}
              >
                <Sparkles className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4 text-purple-600" />
                <span className="lg:hidden">Smart Tour</span>
                <span className="hidden lg:inline">Smart Tour Generator</span>
              </Button>

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

              {/* Image Analysis Button */}
              <ImageAnalysis plannedLandmarks={plannedLandmarks} />
              
              {/* Connection Status - Full version when expanded */}
              <ConnectionStatus showDetails className="w-full" />
              
              {/* Test CORS Button */}
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                onClick={handleTestCors}
                disabled={isTestingCors}
              >
                <TestTube className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                {isTestingCors ? 'Testing...' : 'Test CORS'}
              </Button>
              
              {/* Debug Button wrapped in Drawer */}
              <Drawer open={isDebugDrawerOpen} onOpenChange={setIsDebugDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                  >
                    <List className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                    Debug
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[85vh]">
                  <DebugWindow isVisible={true} onClose={() => setIsDebugDrawerOpen(false)} />
                </DrawerContent>
              </Drawer>
              
              {user && <FreeTourCounter />}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Tour Generator Dialog */}
      <EnhancedTourGeneratorDialog
        open={isEnhancedTourOpen}
        onOpenChange={setIsEnhancedTourOpen}
        onTourGenerated={handleEnhancedTourGenerated}
      />
    </>
  );
};

export default TopControls;
