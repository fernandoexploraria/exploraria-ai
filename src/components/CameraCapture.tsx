
import React, { useRef, useState } from 'react';
import { Camera, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface CameraCaptureProps {
  onImageCapture: (imageData: string) => void;
  isLoading?: boolean;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCapture, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const startCamera = async () => {
    console.log('Starting camera...');
    setIsStartingCamera(true);
    
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      // Request camera permissions
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log('Camera stream obtained successfully');
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          setIsOpen(true);
          setIsStartingCamera(false);
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsStartingCamera(false);
      
      let errorMessage = 'Could not access camera.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera is not supported in this browser.';
      }
      
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped');
      });
      setStream(null);
    }
    setIsOpen(false);
  };

  const captureImage = () => {
    console.log('Capturing image...');
    
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        toast({
          title: "Capture Error",
          description: "Could not initialize canvas for image capture.",
          variant: "destructive"
        });
        return;
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
      
      console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
      
      // Draw the video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 image data
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      console.log('Image captured, data length:', imageData.length);
      
      // Pass the image data to parent component
      onImageCapture(imageData);
      
      // Close camera
      stopCamera();
      
      toast({
        title: "Image Captured",
        description: "Photo captured successfully!",
      });
    } else {
      toast({
        title: "Capture Error",
        description: "Camera not ready for capture.",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.type);
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file.",
          variant: "destructive"
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        console.log('File loaded, data length:', imageData.length);
        onImageCapture(imageData);
        
        toast({
          title: "Image Uploaded",
          description: "Image uploaded successfully!",
        });
      };
      reader.onerror = () => {
        toast({
          title: "Upload Error",
          description: "Failed to read the selected file.",
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    }
  };

  if (isOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
        <div className="relative w-full h-full max-w-md max-h-md">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-lg"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
            <Button
              onClick={captureImage}
              className="bg-white text-black hover:bg-gray-200 rounded-full w-16 h-16"
              disabled={isLoading}
            >
              <Camera className="w-8 h-8" />
            </Button>
            <Button
              onClick={stopCamera}
              variant="outline"
              className="bg-red-500 text-white hover:bg-red-600 rounded-full w-16 h-16"
            >
              <X className="w-8 h-8" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={startCamera}
        variant="outline"
        size="sm"
        className="text-xs"
        disabled={isLoading || isStartingCamera}
      >
        <Camera className="w-3 h-3 mr-1" />
        {isStartingCamera ? 'Starting...' : 'Camera'}
      </Button>
      <Button
        onClick={() => fileInputRef.current?.click()}
        variant="outline"
        size="sm"
        className="text-xs"
        disabled={isLoading}
      >
        <Upload className="w-3 h-3 mr-1" />
        Upload
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default CameraCapture;
