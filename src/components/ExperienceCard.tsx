import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { Experience } from '@/hooks/useExperiences';

interface ExperienceCardProps {
  experience: Experience;
  onSelect?: (experience: Experience) => void;
}

const ExperienceCard: React.FC<ExperienceCardProps> = ({ experience, onSelect }) => {
  const getPhotoUrl = (photo: any): string | null => {
    if (!photo) return null;
    if (typeof photo === 'string') return photo;
    if (typeof photo === 'object' && photo.url) return photo.url;
    return null;
  };

  const photoUrl = getPhotoUrl(experience.photo);

  return (
    <Card className="w-[280px] h-[320px] flex-shrink-0 overflow-hidden">
      {photoUrl && (
        <div className="h-[160px] w-full overflow-hidden">
          <img 
            src={photoUrl} 
            alt={experience.destination}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
      
      <CardHeader className="pb-2">
        <CardTitle className="text-lg line-clamp-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
          {experience.destination}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-between">
        <CardDescription className="line-clamp-3 text-sm mb-4">
          {experience.description || 'Discover amazing places and experiences in this curated tour.'}
        </CardDescription>
        
        {onSelect && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onSelect(experience)}
            className="w-full"
          >
            View Experience
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ExperienceCard;