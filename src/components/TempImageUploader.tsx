
import React from 'react';
import { useStoreSplashImage } from '@/hooks/useStoreSplashImage';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const TempImageUploader: React.FC = () => {
  const { storeSplashImage, isStoring, error } = useStoreSplashImage();
  const { toast } = useToast();

  const handleStoreSplashImage = async () => {
    try {
      const result = await storeSplashImage();
      toast({
        title: "Success!",
        description: `Splash image stored successfully at ${result.url}`,
      });
      console.log('Image storage result:', result);
    } catch (err) {
      toast({
        title: "Error",
        description: error || "Failed to store splash image",
        variant: "destructive"
      });
      console.error('Failed to store image:', err);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-white p-4 rounded-lg shadow-lg border">
      <h3 className="font-semibold mb-2">Upload Splash Image</h3>
      <Button 
        onClick={handleStoreSplashImage}
        disabled={isStoring}
      >
        {isStoring ? 'Uploading...' : 'Store Splash Image'}
      </Button>
      {error && (
        <p className="text-red-500 text-sm mt-2">{error}</p>
      )}
    </div>
  );
};

export default TempImageUploader;
