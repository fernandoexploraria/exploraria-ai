import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, MapPin, Info, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import CameraCapture from './CameraCapture';
import PhotoUpload from './PhotoUpload';
import { Landmark } from '@/data/landmarks';
import { useAuth } from '@/components/AuthProvider';

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
  const [isPhotoUploadOpen, setIsPhotoUploadOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();

  // Don't render the buttons if there are no planned landmarks
  if (plannedLandmarks.length === 0) {
    return null;
  }

  // Function to get current location
  const getCurrentLocation = (): Promise<[number, number]> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [
            position.coords.longitude,
            position.coords.latitude
          ];
          resolve(coords);
        },
        (error) => {
          console.warn('Could not get location:', error.message);
          // Don't reject, just resolve with null to allow the feature to work without location
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  // Function to store image recognition interaction
  const storeImageRecognitionInteraction = async (result: AnalysisResult, imageUrl: string, coordinates?: [number, number]) => {
    if (!user) {
      console.log('User not authenticated, skipping interaction storage');
      return;
    }

    try {
      console.log('Storing image recognition interaction for:', result.landmark_name);
      
      const interactionData: any = {
        userInput: `Image recognition: ${result.landmark_name}`,
        assistantResponse: `${result.description}${result.additional_info ? '. ' + result.additional_info : ''}`,
        destination: 'Camera Recognition',
        interactionType: 'image_recognition',
        landmarkImageUrl: imageUrl
      };

      // Add coordinates if available
      if (coordinates) {
        interactionData.landmarkCoordinates = coordinates;
        console.log('Including coordinates:', coordinates);
      }

      const { error } = await supabase.functions.invoke('store-interaction', {
        body: interactionData
      });

      if (error) {
        console.error('Error storing image recognition interaction:', error);
      } else {
        console.log('Image recognition interaction stored successfully');
      }
    } catch (error) {
      console.error('Error storing image recognition interaction:', error);
    }
  };

  // Function to stop current audio playback
  const stopCurrentAudio = () => {
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.currentTime = 0;
      currentAudio.current = null;
    }
    setIsPlayingAudio(false);
  };

  // Function to handle text-to-speech using Google Cloud TTS via edge function
  const handleTextToSpeech = async () => {
    if (!analysisResult || isPlayingAudio) {
      return;
    }

    // Stop any currently playing audio
    stopCurrentAudio();

    try {
      setIsPlayingAudio(true);
      const text = `${analysisResult.landmark_name}. ${analysisResult.description}${analysisResult.additional_info ? '. ' + analysisResult.additional_info : ''}`;
      
      console.log('Calling Google Cloud TTS via edge function for image analysis:', text.substring(0, 50) + '...');
      
      // Call the same edge function used by the voice assistant and map markers
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('Google Cloud TTS error:', error);
        return;
      }

      if (data?.audioContent && !data.fallbackToBrowser) {
        console.log('Playing audio from Google Cloud TTS for image analysis');
        await playAudioFromBase64(data.audioContent);
      } else {
        console.log('No audio content received for image analysis');
      }
      
    } catch (error) {
      console.error('Error with Google Cloud TTS for image analysis:', error);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  // Function to play audio from base64
  const playAudioFromBase64 = async (base64Audio: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        console.log('Converting base64 to audio blob for image analysis');
        
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        // Store reference to current audio
        currentAudio.current = audio;
        
        audio.onended = () => {
          console.log('Image analysis audio playback ended');
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error('Image analysis audio playback error:', error);
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          reject(error);
        };
        
        audio.play().then(() => {
          console.log('Image analysis audio playing successfully');
        }).catch(error => {
          console.error('Failed to play image analysis audio:', error);
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          reject(error);
        });
        
      } catch (error) {
        console.error('Error creating audio from base64 for image analysis:', error);
        reject(error);
      }
    });
  };

  const handleImageAnalysis = async (imageData: string, fromCamera: boolean = false) => {
    setCapturedImage(imageData);
    setIsAnalyzing(true);
    
    try {
      // Try to get current location only for camera captures
      let coordinates: [number, number] | undefined;
      if (fromCamera) {
        try {
          coordinates = await getCurrentLocation();
          setCurrentLocation(coordinates);
          console.log('Location captured:', coordinates);
        } catch (locationError) {
          console.warn('Could not capture location:', locationError);
        }
      }

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
        
        // Store the interaction with location if available
        await storeImageRecognitionInteraction(data, imageData, coordinates);
        
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

  const handleCapture = async (imageData: string) => {
    await handleImageAnalysis(imageData, true);
  };

  const handlePhotoUpload = async (imageData: string) => {
    await handleImageAnalysis(imageData, false);
  };

  const openCamera = () => {
    setIsCameraOpen(true);
  };

  const openPhotoUpload = () => {
    setIsPhotoUploadOpen(true);
  };

  const closeResult = () => {
    // Stop any playing audio when dialog closes
    stopCurrentAudio();
    setIsResultOpen(false);
    setAnalysisResult(null);
    setCapturedImage(null);
    setCurrentLocation(null);
  };

  return (
    <>
      <div className="flex flex-col gap-2 w-full">
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
          <span>Take Photo</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
          onClick={openPhotoUpload}
          disabled={isAnalyzing}
        >
          <Upload className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
          <span>Upload Photo</span>
        </Button>
      </div>

      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCapture}
      />

      <PhotoUpload
        isOpen={isPhotoUploadOpen}
        onClose={() => setIsPhotoUploadOpen(false)}
        onUpload={handlePhotoUpload}
      />

      <Dialog open={isResultOpen} onOpenChange={closeResult}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Image Recognition
              {currentLocation && (
                <Badge variant="outline" className="ml-2 text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  Location captured
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {capturedImage && (
            <div className="mb-4 relative">
              <img 
                src={capturedImage} 
                alt="Analyzed image" 
                className="w-full h-48 object-cover rounded-lg"
              />
              {analysisResult && (
                <button 
                  onClick={handleTextToSpeech}
                  disabled={isPlayingAudio}
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(0, 0, 0, 0.9)',
                    color: 'white',
                    border: '3px solid rgba(255, 255, 255, 0.9)',
                    borderRadius: '50%',
                    width: '56px',
                    height: '56px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                    opacity: isPlayingAudio ? 0.7 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!isPlayingAudio) {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.95)';
                      e.currentTarget.style.borderColor = 'white';
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.5)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isPlayingAudio) {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.9)';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
                    }
                  }}
                  title="Listen to description"
                >
                  🔊
                </button>
              )}
            </div>
          )}
          
          {analysisResult && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">{analysisResult.landmark_name}</h3>
              <p className="text-sm text-muted-foreground">
                {analysisResult.description}
              </p>
              
              {analysisResult.additional_info && (
                <p className="text-sm text-muted-foreground">
                  {analysisResult.additional_info}
                </p>
              )}
              
              {currentLocation && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>Photo location: {currentLocation[1].toFixed(6)}, {currentLocation[0].toFixed(6)}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageAnalysis;
