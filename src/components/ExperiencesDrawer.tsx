import React from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useExperiences, Experience } from '@/hooks/useExperiences';
import ExperienceCard from './ExperienceCard';
import { Loader2, Compass } from 'lucide-react';
interface ExperiencesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIntelligentTourOpen?: () => void;
}
const ExperiencesDrawer: React.FC<ExperiencesDrawerProps> = ({
  open,
  onOpenChange,
  onIntelligentTourOpen
}) => {
  const {
    data: experiences,
    isLoading,
    error
  } = useExperiences();
  const handleExperienceSelect = (experience: Experience) => {
    console.log('Selected experience:', experience);
    if (!onIntelligentTourOpen) {
      console.warn('onIntelligentTourOpen not provided to ExperiencesDrawer');
      return;
    }

    // Convert experience to landmark format
    const convertExperienceToLandmark = (experience: Experience) => {
      const details = experience.destination_details;
      if (!details) {
        console.error('Experience missing destination_details:', experience);
        return null;
      }
      return {
        id: experience.id,
        name: details.name || experience.destination,
        description: details.editorialSummary || experience.description,
        coordinates: [details.location.longitude, details.location.latitude],
        placeId: details.placeId,
        formattedAddress: details.address,
        types: details.types || details.destination_types || ['tourist_attraction'],
        rating: details.rating,
        tourId: experience.id,
        experience: true
      };
    };
    const landmark = convertExperienceToLandmark(experience);
    if (!landmark) {
      console.error('Failed to convert experience to landmark');
      return;
    }
    console.log('Converted experience to landmark:', landmark);

    // Store landmark as pending destination for IntelligentTourDialog
    (window as any).pendingLandmarkDestination = landmark;

    // Close experiences drawer
    onOpenChange(false);

    // Open intelligent tour dialog
    onIntelligentTourOpen();
  };
  return <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-screen flex flex-col">
        <DrawerHeader className="text-center">
          <DrawerTitle className="flex items-center justify-center gap-2">
            <Compass className="h-5 w-5" />
            Curated Experiences
          </DrawerTitle>
          <DrawerDescription className="text-base font-bold">
            Discover amazing places and tours curated by our experts
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 pb-6">
          {isLoading && <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>}
          
          {error && <div className="text-center py-8 text-muted-foreground">
              <p>Unable to load experiences. Please try again later.</p>
            </div>}
          
          {experiences && experiences.length === 0 && <div className="text-center py-8 text-muted-foreground">
              <Compass className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No experiences available yet.</p>
              <p className="text-sm">Check back soon for curated tours!</p>
            </div>}
          
          {experiences && experiences.length > 0 && <Carousel opts={{
          align: "start",
          loop: false
        }} className="w-full">
              <CarouselContent className="-ml-2 md:-ml-4">
                {experiences.map(experience => <CarouselItem key={experience.id} className="pl-2 md:pl-4 basis-auto">
                    <ExperienceCard experience={experience} onSelect={handleExperienceSelect} />
                  </CarouselItem>)}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex" />
              <CarouselNext className="hidden md:flex" />
            </Carousel>}
        </div>
      </DrawerContent>
    </Drawer>;
};
export default ExperiencesDrawer;