import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useExperiences, Experience } from '@/hooks/useExperiences';
import { supabase } from '@/integrations/supabase/client';
import { setTourLandmarks, TourLandmark } from '@/data/tourLandmarks';
import { useToast } from '@/hooks/use-toast';
import ExperienceCard from './ExperienceCard';
import { Loader2, Compass } from 'lucide-react';

interface ExperiencesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExperienceLaunch?: (experienceData: {
    destination: string;
    systemPrompt: string;
    landmarks: any[];
    agentId?: string;
  }) => void;
}

const ExperiencesDrawer: React.FC<ExperiencesDrawerProps> = ({ open, onOpenChange, onExperienceLaunch }) => {
  const { data: experiences, isLoading, error } = useExperiences();
  const [isLaunching, setIsLaunching] = useState(false);
  const { toast } = useToast();

  const handleExperienceSelect = async (experience: Experience) => {
    console.log('🎯 Launching experience:', experience.destination);
    setIsLaunching(true);

    try {
      // Fetch tour landmarks from the database
      const { data: landmarks, error: landmarksError } = await supabase
        .from('generated_landmarks')
        .select('*')
        .eq('tour_id', experience.id);

      if (landmarksError) {
        console.error('❌ Error fetching landmarks:', landmarksError);
        toast({
          title: "Error Loading Experience",
          description: "Unable to load tour landmarks. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (!landmarks || landmarks.length === 0) {
        console.warn('⚠️ No landmarks found for experience:', experience.id);
        toast({
          title: "No Landmarks Available",
          description: "This experience doesn't have any landmarks yet.",
          variant: "destructive",
        });
        return;
      }

      // Convert database landmarks to TourLandmark format
      const tourLandmarks: TourLandmark[] = landmarks.map(landmark => ({
        placeId: landmark.place_id || landmark.id,
        id: landmark.id,
        name: landmark.name,
        coordinates: [
          parseFloat(landmark.coordinates.split('(')[1].split(',')[0]),
          parseFloat(landmark.coordinates.split(',')[1].split(')')[0])
        ] as [number, number],
        description: landmark.description || '',
        rating: landmark.rating,
        photos: landmark.photos ? (Array.isArray(landmark.photos) ? landmark.photos : [landmark.photos]) : [],
        types: landmark.types || [],
        formattedAddress: landmark.formatted_address,
        tourId: experience.id,
        coordinateSource: landmark.coordinate_source,
        confidence: landmark.confidence as 'high' | 'medium' | 'low',
      }));

      console.log('📍 Formatted tour landmarks:', tourLandmarks.length);

      // Set landmarks on the map
      setTourLandmarks(tourLandmarks);

      // Prepare experience data for voice assistant
      const experienceData = {
        destination: experience.destination,
        systemPrompt: experience.system_prompt,
        landmarks: tourLandmarks,
        agentId: experience.agentid || undefined,
      };

      // Close the drawer
      onOpenChange(false);

      // Launch the experience via callback
      if (onExperienceLaunch) {
        onExperienceLaunch(experienceData);
      }

      toast({
        title: "Experience Launched!",
        description: `Loading ${experience.destination} with ${tourLandmarks.length} locations`,
      });

    } catch (error) {
      console.error('❌ Error launching experience:', error);
      toast({
        title: "Launch Failed",
        description: "Unable to launch experience. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
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
                      isLaunching={isLaunching}
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