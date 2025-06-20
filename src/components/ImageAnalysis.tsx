
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, MapPin, Info, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import CameraCapture from './CameraCapture';
import { Landmark } from '@/data/landmarks';

interface ImageAnalysisProps {
  plannedLandmarks: Landmark[];
}

interface AnalysisResult {
  landmark_name: string;
  confidence: number;
  description: string;
  is_from_tour: boolean;
  additional_info?: string;
}

const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ plannedLandmarks }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Don't render the button if there are no planned landmarks
  if (plannedLandmarks.length === 0) {
    return null;
  }

  const handleCapture = async (imageData: string) => {
    setCapturedImage(imageData);
    setIsAnalyzing(true);
    
    try {
      const base64Data = imageData.split(',')[1];
      
      const { data, error } = await supabase.functions.invoke('analyze-landmark-image', {
        body: {
          image: base64Data,
          plannedLandmarks: plannedLandmarks
        }
      });

      if (error) {
        console.error('Analysis error:', error);
        toast.error('Failed to analyze image. Please try again.');
        return;
      }

      if (data) {
        setAnalysisResult(data);
        setIsResultOpen(true);
        
        if (data.is_from_tour) {
          toast.success(`Found ${data.landmark_name} from your tour!`);
        } else {
          toast.success('Landmark analyzed successfully!');
        }
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      toast.error('Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openCamera = () => {
    setIsCameraOpen(true);
  };

  const closeResult = () => {
    setIsResultOpen(false);
    setAnalysisResult(null);
    setCapturedImage(null);
    setIsPlaying(false);
  };

  const handleTTS = async () => {
    if (!analysisResult) return;

    setIsPlaying(true);
    
    try {
      // Combine description and additional info for TTS
      const textToSpeak = analysisResult.additional_info 
        ? `${analysisResult.description} ${analysisResult.additional_info}`
        : analysisResult.description;

      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text: textToSpeak }
      });

      if (error) {
        console.error('TTS error:', error);
        toast.error("Text-to-speech failed. Please try again.");
        return;
      }

      if (data.audioContent) {
        // Create audio element and play
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        
        audio.onended = () => {
          setIsPlaying(false);
        };
        
        audio.onerror = () => {
          setIsPlaying(false);
          // Fallback to browser TTS if available
          if (data.fallbackToBrowser && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(data.enhancedText || textToSpeak);
            utterance.onend = () => setIsPlaying(false);
            utterance.onerror = () => setIsPlaying(false);
            speechSynthesis.speak(utterance);
          } else {
            toast.error("Audio playback failed.");
          }
        };
        
        await audio.play();
      } else if (data.fallbackToBrowser && 'speechSynthesis' in window) {
        // Use browser TTS as fallback
        const utterance = new SpeechSynthesisUtterance(data.enhancedText || textToSpeak);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsPlaying(false);
      toast.error("Text-to-speech failed. Please try again.");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
        onClick={openCamera}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <Loader2 className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4 animate-spin" />
        ) : (
          <Camera className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
        )}
        <span className="lg:hidden">Image Recognition</span>
        <span className="hidden lg:inline">Image Recognition</span>
      </Button>

      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCapture}
      />

      <Dialog open={isResultOpen} onOpenChange={closeResult}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Image Recognition
            </DialogTitle>
          </DialogHeader>
          
          {capturedImage && (
            <div className="mb-4 relative">
              <img 
                src={capturedImage} 
                alt="Captured image" 
                className="w-full h-48 object-cover rounded-lg"
              />
              {/* TTS Button positioned like in marker preview */}
              {analysisResult && (
                <Button
                  onClick={handleTTS}
                  disabled={isPlaying}
                  size="sm"
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-800 shadow-lg"
                >
                  <Volume2 className={`h-4 w-4 ${isPlaying ? 'animate-pulse' : ''}`} />
                </Button>
              )}
            </div>
          )}
          
          {analysisResult && (
            <div className="space-y-3">
              <p className="text-sm">
                {analysisResult.description}
              </p>
              
              {analysisResult.additional_info && (
                <p className="text-sm">
                  {analysisResult.additional_info}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageAnalysis;
