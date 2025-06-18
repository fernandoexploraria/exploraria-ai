
import { useState, useEffect } from "react";
import { Landmark } from "@/data/landmarks";
import { landmarks } from "@/data/landmarks";
import Map from "@/components/Map";
import InfoPanel from "@/components/InfoPanel";
import TourPlannerDialog from "@/components/TourPlannerDialog";
import VoiceAssistant from "@/components/VoiceAssistant";
import VoiceSearchDialog from "@/components/VoiceSearchDialog";
import VoiceInteractionsTable from "@/components/VoiceInteractionsTable";
import { Button } from "@/components/ui/button";
import { MessageSquare, Search, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [tourLandmarks, setTourLandmarks] = useState<Landmark[]>([]);
  const [destination, setDestination] = useState('');
  const [tourPlannerOpen, setTourPlannerOpen] = useState(false);
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  const [voiceSearchOpen, setVoiceSearchOpen] = useState(false);
  const [perplexityApiKey, setPerplexityApiKey] = useState(process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY || 'YOUR_PERPLEXITY_API_KEY');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || 'YOUR_ELEVENLABS_API_KEY');
  const [mapboxToken, setMapboxToken] = useState(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN');
  const [isGeneratingTour, setIsGeneratingTour] = useState(false);
  const { toast } = useToast();

  const addLandmarkToTour = (landmark: Landmark) => {
    setTourLandmarks([...tourLandmarks, landmark]);
    toast({
      title: "Landmark Added",
      description: `${landmark.name} added to your tour.`,
    });
  };

  const removeLandmarkFromTour = (landmarkToRemove: Landmark) => {
    setTourLandmarks(tourLandmarks.filter(landmark => landmark.id !== landmarkToRemove.id));
    toast({
      title: "Landmark Removed",
      description: `${landmarkToRemove.name} removed from your tour.`,
    });
  };

  const handleGenerateTour = async (tourDestination: string) => {
    setIsGeneratingTour(true);
    try {
      // Placeholder for tour generation logic
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      toast({
        title: "Tour Generated",
        description: `Tour for ${tourDestination} has been generated.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate tour.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingTour(false);
    }
  };

  const [showInteractionsTable, setShowInteractionsTable] = useState(false);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Tour Planner</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowInteractionsTable(!showInteractionsTable)}
            variant="outline"
            size="sm"
          >
            <Database className="w-4 h-4 mr-2" />
            {showInteractionsTable ? 'Hide' : 'Show'} Records
          </Button>
          <Button
            onClick={() => setVoiceSearchOpen(true)}
            variant="outline"
            size="sm"
          >
            <Search className="w-4 h-4 mr-2" />
            Search Conversations
          </Button>
          <Button
            onClick={() => setVoiceAssistantOpen(true)}
            variant="outline"
            size="sm"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Voice Assistant
          </Button>
        </div>
      </div>

      {/* Voice Interactions Table */}
      {showInteractionsTable && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <VoiceInteractionsTable />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        <div className="flex-1">
          <Map
            mapboxToken={mapboxToken}
            landmarks={landmarks}
            onSelectLandmark={setSelectedLandmark}
            selectedLandmark={selectedLandmark}
            plannedLandmarks={tourLandmarks}
          />
        </div>
        
        {selectedLandmark && (
          <InfoPanel
            landmark={selectedLandmark}
            onClose={() => setSelectedLandmark(null)}
            elevenLabsApiKey={elevenLabsApiKey}
          />
        )}
      </div>

      <TourPlannerDialog
        open={tourPlannerOpen}
        onOpenChange={setTourPlannerOpen}
        onGenerateTour={handleGenerateTour}
        isLoading={isGeneratingTour}
      />

      <VoiceAssistant
        open={voiceAssistantOpen}
        onOpenChange={setVoiceAssistantOpen}
        destination={destination}
        landmarks={tourLandmarks}
        perplexityApiKey={perplexityApiKey}
        elevenLabsApiKey={elevenLabsApiKey}
      />

      <VoiceSearchDialog
        open={voiceSearchOpen}
        onOpenChange={setVoiceSearchOpen}
      />
    </div>
  );
};

export default Index;
