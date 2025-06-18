
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface ImageAnalysisResultProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageData: string | null;
  analysis: string | null;
  landmarkName?: string;
}

const ImageAnalysisResult: React.FC<ImageAnalysisResultProps> = ({
  open,
  onOpenChange,
  imageData,
  analysis,
  landmarkName
}) => {
  if (!imageData || !analysis) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>AI Analysis</span>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {landmarkName && landmarkName !== 'Unknown location' && (
            <div className="text-sm text-muted-foreground">
              Analyzing: <span className="font-medium">{landmarkName}</span>
            </div>
          )}
          
          <div className="rounded-lg overflow-hidden border">
            <img 
              src={imageData} 
              alt="Captured landmark" 
              className="w-full h-48 object-cover"
            />
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">AI Analysis</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ImageAnalysisResult;
