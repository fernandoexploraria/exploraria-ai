
import React, { useRef, useState } from 'react';
import { Camera, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraCaptureProps {
  onImageCapture: (imageData: string) => void;
  isLoading?: boolean;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCapture, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsOpen(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please try uploading an image instead.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsOpen(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        onImageCapture(imageData);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        onImageCapture(imageData);
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
        disabled={isLoading}
      >
        <Camera className="w-3 h-3 mr-1" />
        Camera
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
