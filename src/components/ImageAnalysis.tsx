import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, MapPin, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import CameraCapture from './CameraCapture';
import { Landmark } from '@/data/landmarks';
import { useAuth } from '@/components/AuthProvider';
import { useEnhancedPhotos, PhotoData } from '@/hooks/useEnhancedPhotos';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import PhotoCarousel from './photo-carousel/PhotoCarousel';
import { useTTSContext } from '@/contexts/TTSContext';

interface ImageAnalysisProps {
  smartTourLandmarks: Landmark[];
}

interface AnalysisResult {
  landmark_name: string;
  confidence: number;
  description: string;
  is_from_tour: boolean;
  additional_info?: string;
  place_id?: string; // Enhanced with place_id for photo fetching
}

const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ smartTourLandmarks }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedImagePhoto, setCapturedImagePhoto] = useState<PhotoData | null>(null);
  const [landmarkPhotos, setLandmarkPhotos] = useState<PhotoData[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const { user } = useAuth();
  const { fetchPhotos } = useEnhancedPhotos();
  const { speak: speakTTS, stop: stopTTS, isPlaying: isTTSPlaying } = useTTSContext();

  // Don't render the button if there are no smart tour landmarks
  if (smartTourLandmarks.length === 0) {
    return null;
  }

  // Convert captured image to PhotoData format
  const createPhotoFromImage = (imageUrl: string): PhotoData => ({
    id: Date.now(),
    photoReference: 'captured',
    urls: {
      thumb: imageUrl,
      medium: imageUrl,
      large: imageUrl
    },
    attributions: [],
    width: 800,
    height: 600,
    qualityScore: 70
  });

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
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  // Function to fetch enhanced photos for recognized landmark
  const fetchLandmarkPhotos = async (placeId: string) => {
    if (!placeId) return;
    
    setIsLoadingPhotos(true);
    try {
      console.log(`🖼️ Fetching enhanced photos for recognized landmark: ${placeId}`);
      const photosResponse = await fetchPhotos(placeId, 800, 'medium');
      
      if (photosResponse && photosResponse.photos.length > 0) {
        console.log(`✅ Found ${photosResponse.photos.length} photos for recognized landmark`);
        setLandmarkPhotos(photosResponse.photos);
      } else {
        console.log('ℹ️ No additional photos found for recognized landmark');
        setLandmarkPhotos([]);
      }
    } catch (error) {
      console.error('❌ Error fetching landmark photos:', error);
      setLandmarkPhotos([]);
    } finally {
      setIsLoadingPhotos(false);
    }
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
        landmarkImageUrl: imageUrl,
        place_id: result.place_id // Include place_id for future photo fetching
      };

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

  // Use centralized TTS function
  const handleTextToSpeech = async () => {
    if (!analysisResult || isTTSPlaying) {
      return;
    }

    const text = `${analysisResult.landmark_name}. ${analysisResult.description}${analysisResult.additional_info ? '. ' + analysisResult.additional_info : ''}`;
    await speakTTS(text, false, 'image-analysis');
  };

  const handleCapture = async (imageData: string) => {
    setCapturedImage(imageData);
    setCapturedImagePhoto(createPhotoFromImage(imageData));
    setIsAnalyzing(true);
    
    try {
      let coordinates: [number, number] | undefined;
      try {
        coordinates = await getCurrentLocation();
        setCurrentLocation(coordinates);
        console.log('Location captured:', coordinates);
      } catch (locationError) {
        console.warn('Could not capture location:', locationError);
      }

      const base64Data = imageData.split(',')[1];
      
      const { data, error } = await supabase.functions.invoke('analyze-landmark-image', {
        body: {
          image: base64Data,
          plannedLandmarks: smartTourLandmarks
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
        
        // Fetch additional photos if place_id is available
        if (data.place_id) {
          await fetchLandmarkPhotos(data.place_id);
        }
        
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

  const openCamera = () => {
    setIsCameraOpen(true);
  };

  const closeResult = () => {
    stopTTS();
    setIsResultOpen(false);
    setAnalysisResult(null);
    setCapturedImage(null);
    setCapturedImagePhoto(null);
    setLandmarkPhotos([]);
    setCurrentLocation(null);
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          
          {/* Captured Image Display */}
          {capturedImagePhoto && (
            <div className="mb-4 relative">
              <EnhancedProgressiveImage
                photo={capturedImagePhoto}
                alt="Captured image"
                className="w-full h-48 rounded-lg"
                showAttribution={false}
              />
              {analysisResult && (
                <button 
                  onClick={handleTextToSpeech}
                  disabled={isTTSPlaying}
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
                    opacity: isTTSPlaying ? 0.7 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!isTTSPlaying) {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.95)';
                      e.currentTarget.style.borderColor = 'white';
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.5)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isTTSPlaying) {
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
          
          {/* Analysis Result */}
          {analysisResult && (
            <div className="space-y-4">
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

              {/* Enhanced Photos from Places API */}
              {isLoadingPhotos && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading additional photos...
                </div>
              )}

              {landmarkPhotos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span className="text-sm font-medium">Additional Photos ({landmarkPhotos.length})</span>
                  </div>
                  <PhotoCarousel
                    photos={landmarkPhotos}
                    initialIndex={0}
                    className="h-64 rounded-lg"
                    showThumbnails={landmarkPhotos.length > 1}
                    allowZoom={true}
                  />
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
