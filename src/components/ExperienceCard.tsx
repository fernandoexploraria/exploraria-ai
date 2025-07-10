import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { Experience } from '@/hooks/useExperiences';
interface ExperienceCardProps {
  experience: Experience;
  onSelect?: (experience: Experience) => void;
}
const ExperienceCard: React.FC<ExperienceCardProps> = ({
  experience,
  onSelect
}) => {
  const getPhotoUrl = (photo: any): string | null => {
    if (!photo) return null;
    if (typeof photo === 'string') return photo;
    if (Array.isArray(photo) && photo.length > 0) return photo[0];
    if (typeof photo === 'object' && photo.url) return photo.url;
    return null;
  };
  const photoUrl = getPhotoUrl(experience.photo);
  return <Card className="w-[280px] h-[380px] flex-shrink-0 overflow-hidden flex flex-col">
      {photoUrl && <div className="h-[160px] w-full overflow-hidden flex-shrink-0">
          <img src={photoUrl} alt={experience.destination} className="w-full h-full object-cover" onError={e => {
        e.currentTarget.style.display = 'none';
      }} />
        </div>}
      
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-lg line-clamp-2 flex items-center gap-2 h-[56px]">
          <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="line-clamp-2">{experience.destination}</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-6 pt-0">
        <div className="flex-1 mb-4">
          <CardDescription className="text-sm h-[72px] overflow-y-auto">
            {experience.description || 'Discover amazing places and experiences in this curated tour.'}
          </CardDescription>
        </div>
        
        {onSelect && <Button variant="outline" size="sm" onClick={() => onSelect(experience)} className="bg-gradient-to-r from-purple-400/80 to-pink-400/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 border-purple-300 hover:from-purple-300/80 hover:to-pink-300/80">
            Generate Experience
          </Button>}
      </CardContent>
    </Card>;
};
export default ExperienceCard;