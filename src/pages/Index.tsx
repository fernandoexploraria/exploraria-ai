import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import SearchControl from '@/components/SearchControl';
import Map from '@/components/Map';
import TopControls from '@/components/TopControls';
import UserControls from '@/components/UserControls';
import DialogManager from '@/components/DialogManager';
import SplashScreen from '@/components/SplashScreen';
import { Landmark } from '@/data/landmarks';
import { useAuth } from '@/components/AuthProvider';

const Index = () => {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [plannedLandmarks, setPlannedLandmarks] = useState<Landmark[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [voiceSearchDialogOpen, setVoiceSearchDialogOpen] = useState(false);
  const [interactionCarouselOpen, setInteractionCarouselOpen] = useState(false);
  const [favoritesDialogOpen, setFavoritesDialogOpen] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const [interactionLocation, setInteractionLocation] = useState<{
    coordinates: [number, number];
    name: string;
    imageUrl?: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch('/api/get-mapbox-token');
        const data = await response.json();

        if (response.ok) {
          setMapboxToken(data.token);
        } else {
          console.error('Failed to fetch Mapbox token:', data.error);
          toast({
            title: "Failed to load map",
            description: "Could not retrieve Mapbox token.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        toast({
          title: "Failed to load map",
          description: "Could not retrieve Mapbox token.",
          variant: "destructive"
        });
      }
    };

    fetchToken();
  }, [toast]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedLandmark(null);
  };

  const allLandmarksForSearch = React.useMemo(() => {
    return [...landmarks];
  }, [landmarks]);

  const handleLocationSelect = (coordinates: [number, number], interaction: any) => {
    setInteractionLocation({
      coordinates,
      name: interaction.user_input,
      imageUrl: interaction.landmark_image_url || undefined,
      description: interaction.assistant_response
    });
  };

  return (
    <div className="relative w-full h-screen">
      <SplashScreen />
      
      <Map
        mapboxToken={mapboxToken}
        landmarks={landmarks}
        onSelectLandmark={setSelectedLandmark}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={plannedLandmarks}
        interactionLocation={interactionLocation}
      />
      
      <TopControls
        landmarks={allLandmarksForSearch}
        onSelectLandmark={setSelectedLandmark}
        setSearchDialogOpen={setSearchDialogOpen}
        setVoiceSearchDialogOpen={setVoiceSearchDialogOpen}
        setInteractionCarouselOpen={setInteractionCarouselOpen}
        setFavoritesDialogOpen={setFavoritesDialogOpen}
        mapboxToken={mapboxToken} 
      />
      
      <SearchControl
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        isLoading={isLoading}
        searchQuery={searchQuery}
      />
      
      <UserControls 
        mapboxToken={mapboxToken}
        onLandmarksChange={setLandmarks}
        onPlanChange={setPlannedLandmarks}
      />

      <DialogManager
        searchDialogOpen={searchDialogOpen}
        setSearchDialogOpen={setSearchDialogOpen}
        voiceSearchDialogOpen={voiceSearchDialogOpen}
        setVoiceSearchDialogOpen={setVoiceSearchDialogOpen}
        interactionCarouselOpen={interactionCarouselOpen}
        setInteractionCarouselOpen={setInteractionCarouselOpen}
        favoritesDialogOpen={favoritesDialogOpen}
        setFavoritesDialogOpen={setFavoritesDialogOpen}
        onLocationSelect={handleLocationSelect}
      />
    </div>
  );
};

export default Index;
