
import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CameraCapture from './CameraCapture';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Landmark } from '@/data/landmarks';

interface ImageAnalysisProps {
  landmarks: Landmark[];
  destination: string;
}

const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ landmarks, destination }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { toast } = useToast();

  const handleCapture = async (imageData: string) => {
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-landmark-image', {
        body: {
          imageData,
          landmarks: landmarks.map(l => l.name),
          destination
        }
      });

      if (error) {
        console.error('Error analyzing image:', error);
        toast({
          title: "Analysis Failed",
          description: "Could not analyze the image. Please try again.",
          variant: "destructive"
        });
      } else if (data?.analysis) {
        setAnalysisResult(data.analysis);
        setShowResult(true);
        toast({
          title: "Analysis Complete",
          description: "Your landmark has been identified!"
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsCameraOpen(true)}
        disabled={isAnalyzing}
        className="rounded-full"
        title="Identify landmark with camera"
      >
        <Camera className="h-4 w-4" />
      </Button>

      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCapture}
      />

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Landmark Analysis</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Here's what I found about your photo:
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">{analysisResult}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageAnalysis;
