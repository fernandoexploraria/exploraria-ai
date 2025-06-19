
import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CameraCapture from '@/components/CameraCapture';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImageAnalysisProps {
  landmarks?: Array<{ name: string; description: string }>;
}

const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ landmarks = [] }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);

  const handleImageCapture = async (imageData: string) => {
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-landmark-image', {
        body: { 
          image: imageData,
          landmarks: landmarks.map(l => l.name)
        }
      });

      if (error) {
        console.error('Analysis error:', error);
        toast.error('Failed to analyze image');
        return;
      }

      setAnalysisResult(data.analysis);
      setIsResultDialogOpen(true);
      toast.success('Image analyzed successfully!');
      
    } catch (error) {
      console.error('Error analyzing image:', error);
      toast.error('Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
        onClick={() => setIsCameraOpen(true)}
        disabled={isAnalyzing}
      >
        <Camera className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
        {isAnalyzing ? 'Analyzing...' : 'Scan Landmark'}
      </Button>

      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleImageCapture}
      />

      <Dialog open={isResultDialogOpen} onOpenChange={setIsResultDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Image Analysis Result</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {analysisResult && (
              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {analysisResult}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageAnalysis;
