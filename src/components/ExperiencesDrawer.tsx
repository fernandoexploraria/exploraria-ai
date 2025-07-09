import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useExperiences, Experience } from '@/hooks/useExperiences';
import ExperienceCard from './ExperienceCard';
import { Loader2, Compass } from 'lucide-react';
import { useMarkerLoadingState } from '@/hooks/useMarkerLoadingState';
import { setTourLandmarks, clearTourMarkers, TourLandmark } from '@/data/tourLandmarks';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExperiencesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Coordinate validation function
const validateLandmarkCoordinates = (coordinates: unknown): coordinates is [number, number] => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }
  
  const [lng, lat] = coordinates;
  
  // Check if both values are valid numbers
  if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
    return false;
  }
  
  // Check if coordinates are not zero (which indicates missing data)
  if (lng === 0 && lat === 0) {
    return false;
  }
  
  // Check if coordinates are within valid ranges
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return false;
  }
  
  return true;
};

const ExperiencesDrawer: React.FC<ExperiencesDrawerProps> = ({ open, onOpenChange }) => {
  const { data: experiences, isLoading, error } = useExperiences();
  const { toast } = useToast();
  const [isLoadingExperience, setIsLoadingExperience] = useState(false);
  
  // Initialize marker loading state hook
  const {
    isMarkersLoading,
    markersLoaded,
    startMarkerLoading,
    finishMarkerLoading,
    resetMarkerState
  } = useMarkerLoadingState(300);

  const handleExperienceSelect = async (experience: Experience) => {
    console.log('🎯 Selected experience:', experience);
    
    if (isLoadingExperience || isMarkersLoading) {
      console.log('⏳ Already loading experience, skipping...');
      return;
    }
    
    setIsLoadingExperience(true);
    
    try {
      // Step 1: Start marker loading
      console.log('🔄 Starting marker loading...');
      startMarkerLoading();
      
      // Step 2: Clear existing tour markers
      console.log('🧹 Clearing existing tour markers...');
      clearTourMarkers();
      
      // Step 3: Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 4: Fetch landmarks for this experience
      console.log('📊 Fetching landmarks for experience:', experience.id);
      const { data: landmarks, error: landmarksError } = await supabase
        .from('generated_landmarks')
        .select('*')
        .eq('tour_id', experience.id);
      
      if (landmarksError) {
        console.error('❌ Error fetching landmarks:', landmarksError);
        throw landmarksError;
      }
      
      console.log('📍 Fetched landmarks:', landmarks?.length || 0);
      
      // Step 5: Validate coordinates and convert to TourLandmark format
      const validLandmarks: TourLandmark[] = (landmarks || [])
        .filter(landmark => {
          if (!validateLandmarkCoordinates(landmark.coordinates)) {
            console.warn('⚠️ Invalid coordinates for landmark:', landmark.name, landmark.coordinates);
            return false;
          }
          return true;
        })
        .map(landmark => ({
          placeId: landmark.place_id || landmark.landmark_id,
          id: landmark.landmark_id,
          name: landmark.name,
          coordinates: landmark.coordinates as [number, number],
          description: landmark.description || '',
          rating: landmark.rating,
          photos: landmark.photo_references || [],
          types: landmark.types || [],
          formattedAddress: landmark.formatted_address,
          tourId: experience.id,
          coordinateSource: landmark.coordinate_source || 'unknown',
          confidence: landmark.confidence as 'high' | 'medium' | 'low' || 'medium'
        }));
      
      console.log('✅ Valid landmarks processed:', validLandmarks.length);
      
      // Step 6: Set tour landmarks
      if (validLandmarks.length > 0) {
        console.log('🗺️ Setting tour landmarks on map...');
        setTourLandmarks(validLandmarks);
      } else {
        console.warn('⚠️ No valid landmarks found for experience');
        toast({
          title: "No landmarks found",
          description: "This experience doesn't have any valid landmarks to display.",
          variant: "destructive"
        });
      }
      
      // Step 7: Finish marker loading
      await finishMarkerLoading();
      
      console.log('🎉 Experience loaded successfully!');
      toast({
        title: "Experience loaded!",
        description: `${validLandmarks.length} landmarks loaded on the map.`
      });
      
    } catch (error) {
      console.error('❌ Error loading experience:', error);
      toast({
        title: "Error loading experience",
        description: "Failed to load the experience. Please try again.",
        variant: "destructive"
      });
      resetMarkerState();
    } finally {
      setIsLoadingExperience(false);
    }
  };

  return (
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
    >
      <DrawerContent className="h-screen flex flex-col">
        <DrawerHeader className="text-center">
          <DrawerTitle className="flex items-center justify-center gap-2">
            <Compass className="h-5 w-5" />
            Curated Experiences
          </DrawerTitle>
          <DrawerDescription>
            Discover amazing places and tours curated by our experts
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 pb-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          
          {error && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Unable to load experiences. Please try again later.</p>
            </div>
          )}
          
          {experiences && experiences.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Compass className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No experiences available yet.</p>
              <p className="text-sm">Check back soon for curated tours!</p>
            </div>
          )}
          
          {/* Loading overlay for experience loading */}
          {isLoadingExperience && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-background p-6 rounded-lg shadow-lg flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <div>
                  <p className="font-semibold">Loading Experience</p>
                  <p className="text-sm text-muted-foreground">
                    {isMarkersLoading ? 'Preparing map markers...' : 'Loading landmarks...'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {experiences && experiences.length > 0 && (
            <Carousel
              opts={{
                align: "start",
                loop: false,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {experiences.map((experience) => (
                  <CarouselItem key={experience.id} className="pl-2 md:pl-4 basis-auto">
                    <ExperienceCard 
                      experience={experience} 
                      onSelect={handleExperienceSelect}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex" />
              <CarouselNext className="hidden md:flex" />
            </Carousel>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ExperiencesDrawer;