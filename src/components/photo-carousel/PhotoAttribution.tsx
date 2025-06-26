
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { ExternalLink, User, Copyright, Info, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoAttributionProps {
  photo: PhotoData;
  isVisible: boolean;
  onToggle: () => void;
  className?: string;
}

const PhotoAttribution: React.FC<PhotoAttributionProps> = ({
  photo,
  isVisible,
  onToggle,
  className
}) => {
  const hasAttributions = photo.attributions && photo.attributions.length > 0;

  if (!hasAttributions && !photo.qualityScore) {
    return null;
  }

  return (
    <div className={cn(
      'absolute bottom-0 left-0 right-0 transition-all duration-300',
      isVisible ? 'translate-y-0' : 'translate-y-full',
      className
    )}>
      {/* Toggle button */}
      <div className="flex justify-center pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
        >
          <Info className="w-4 h-4 mr-1" />
          {isVisible ? 'Hide' : 'Show'} Details
          {isVisible ? (
            <ChevronDown className="w-4 h-4 ml-1" />
          ) : (
            <ChevronUp className="w-4 h-4 ml-1" />
          )}
        </Button>
      </div>

      {/* Attribution panel */}
      <div className="bg-black/80 backdrop-blur-sm text-white p-4 space-y-3">
        {/* Photo metadata */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Copyright className="w-4 h-4" />
            <span className="text-sm font-medium">Photo Information</span>
          </div>
          {photo.qualityScore && (
            <Badge 
              variant="secondary" 
              className={cn(
                'text-xs',
                photo.qualityScore >= 80 ? 'bg-green-500' : 
                photo.qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              )}
            >
              Quality: {Math.round(photo.qualityScore)}
            </Badge>
          )}
        </div>

        {/* Attribution list */}
        {hasAttributions && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Photo Credits
            </h4>
            {photo.attributions.map((attribution, index) => (
              <div key={index} className="bg-white/10 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {attribution.displayName}
                      </span>
                      {attribution.uri && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-auto p-1 text-white hover:bg-white/20"
                        >
                          <a 
                            href={attribution.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="View profile"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                    
                    {attribution.photoUri && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          <a 
                            href={attribution.photoUri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            View Original Photo
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Technical details */}
        <div className="border-t border-white/20 pt-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-white/60">Dimensions:</span>
              <div className="font-medium">{photo.width} × {photo.height}px</div>
            </div>
            <div>
              <span className="text-white/60">Aspect Ratio:</span>
              <div className="font-medium">
                {(photo.width / photo.height).toFixed(2)}:1
              </div>
            </div>
            {photo.qualityScore && (
              <div>
                <span className="text-white/60">Quality Score:</span>
                <div className="font-medium">{Math.round(photo.qualityScore)}/100</div>
              </div>
            )}
            <div>
              <span className="text-white/60">Photo ID:</span>
              <div className="font-medium font-mono text-xs">
                {photo.id}
              </div>
            </div>
          </div>
        </div>

        {/* Legal notice */}
        <div className="border-t border-white/20 pt-3 text-xs text-white/60">
          <p>
            Photos provided by Google Places API. All rights belong to their respective owners.
            Usage subject to Google's Terms of Service and attribution requirements.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PhotoAttribution;
