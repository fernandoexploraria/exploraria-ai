
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
    console.log('=== STARTING CAMERA ===');
    setIsStartingCamera(true);
    
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      console.log('Requesting camera access...');
      
      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log('Camera stream obtained successfully');
      setStream(mediaStream);
      
      // Show the camera overlay immediately
      setIsOpen(true);
      
      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log('Video element configured');
        
        // Ensure video plays
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, starting playback');
          if (videoRef.current) {
            videoRef.current.play().catch(console.error);
          }
        };
      }
      
      setIsStartingCamera(false);
      
    } catch (error) {
      console.error('Camera error:', error);
      setIsStartingCamera(false);
      
      let errorMessage = 'Could not access camera.';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Camera is not supported in this browser.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
        }
      }
      
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    console.log('=== STOPPING CAMERA ===');
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped');
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsOpen(false);
  };

  const captureImage = () => {
    console.log('=== CAPTURING IMAGE ===');
    
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.error('Could not get canvas context');
        toast({
          title: "Capture Error",
          description: "Could not initialize canvas for image capture.",
          variant: "destructive"
        });
        return;
      }
      
      // Set canvas dimensions to match video
      const videoWidth = video.videoWidth || video.clientWidth;
      const videoHeight = video.videoHeight || video.clientHeight;
      
      console.log('Video dimensions:', { videoWidth, videoHeight });
      
      if (videoWidth === 0 || videoHeight === 0) {
        console.error('Invalid video dimensions');
        toast({
          title: "Capture Error",
          description: "Camera not ready. Please wait a moment and try again.",
          variant: "destructive"
        });
        return;
      }
      
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // Draw the video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 image data
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      console.log('Image captured successfully');
      
      // Pass the image data to parent component
      onImageCapture(imageData);
      
      // Close camera
      stopCamera();
      
      toast({
        title: "Image Captured",
        description: "Photo captured successfully!",
      });
    } else {
      console.error('Video or canvas ref is null');
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
      console.log('File selected:', file.name);
      
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
        console.log('File loaded successfully');
        onImageCapture(imageData);
        
        toast({
          title: "Image Uploaded",
          description: "Image uploaded successfully!",
        });
      };
      reader.onerror = () => {
        console.error('FileReader error');
        toast({
          title: "Upload Error",
          description: "Failed to read the selected file.",
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Camera view overlay
  if (isOpen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Controls overlay */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-6">
            <Button
              onClick={captureImage}
              className="bg-white text-black hover:bg-gray-200 rounded-full w-20 h-20 p-0"
              disabled={isLoading}
            >
              <Camera className="w-8 h-8" />
            </Button>
            <Button
              onClick={stopCamera}
              variant="outline"
              className="bg-red-500 border-red-500 text-white hover:bg-red-600 rounded-full w-16 h-16 p-0"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Camera and upload buttons
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
        onClick={() => {
          console.log('Upload button clicked');
          fileInputRef.current?.click();
        }}
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
