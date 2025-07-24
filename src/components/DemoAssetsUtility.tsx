import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Download, MapPin, Camera, Loader2 } from 'lucide-react';

const DemoAssetsUtility: React.FC = () => {
  const [isStoringAssets, setIsStoringAssets] = useState(false);
  const [storedAssets, setStoredAssets] = useState<{
    mapPhoto?: string;
    thumbnails?: string[];
  }>({});

  // Eiffel Tower Place ID for getting photos
  const EIFFEL_TOWER_PLACE_ID = 'ChIJLU7jZClu5kcR4PcOOO6p3I0';

  const storeMapPhoto = async (): Promise<string> => {
    // Use the uploaded map image as the main photo
    const mapImageUrl = '/lovable-uploads/4e263674-a367-4d9a-b8ce-9a6b7bd55106.png';
    
    // Download the image
    const response = await fetch(mapImageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch map image');
    }
    
    const blob = await response.blob();
    const fileName = `demo-map-eiffel-tower.png`;
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('static-assets')
      .upload(fileName, blob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to upload map image: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('static-assets')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const storeEiffelTowerThumbnails = async (): Promise<string[]> => {
    // Get Eiffel Tower photos using our Google Places API
    const { data, error } = await supabase.functions.invoke('google-places-photos-v2', {
      body: {
        placeId: EIFFEL_TOWER_PLACE_ID,
        maxWidth: 400,
        quality: 'medium'
      }
    });

    if (error) {
      throw new Error(`Failed to fetch Eiffel Tower photos: ${error.message}`);
    }

    if (!data.photos || data.photos.length === 0) {
      throw new Error('No photos found for Eiffel Tower');
    }

    // Take first 3 photos and store them
    const thumbnailUrls: string[] = [];
    const photosToStore = data.photos.slice(0, 3);

    for (let i = 0; i < photosToStore.length; i++) {
      const photo = photosToStore[i];
      const imageUrl = photo.urls.medium; // Use medium size
      
      try {
        // Download the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch photo ${i + 1}, skipping`);
          continue;
        }
        
        const blob = await response.blob();
        const fileName = `demo-eiffel-tower-${i + 1}.jpg`;
        
        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('static-assets')
          .upload(fileName, blob, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.warn(`Failed to upload photo ${i + 1}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('static-assets')
          .getPublicUrl(uploadData.path);

        thumbnailUrls.push(urlData.publicUrl);
      } catch (error) {
        console.warn(`Error processing photo ${i + 1}:`, error);
      }
    }

    if (thumbnailUrls.length === 0) {
      throw new Error('Failed to store any thumbnail images');
    }

    return thumbnailUrls;
  };

  const handleStoreAssets = async () => {
    setIsStoringAssets(true);
    
    try {
      toast.info('Starting demo assets storage...');
      
      // Store map photo
      toast.info('Uploading map photo...');
      const mapPhotoUrl = await storeMapPhoto();
      
      // Store Eiffel Tower thumbnails
      toast.info('Fetching and storing Eiffel Tower photos...');
      const thumbnailUrls = await storeEiffelTowerThumbnails();
      
      setStoredAssets({
        mapPhoto: mapPhotoUrl,
        thumbnails: thumbnailUrls
      });
      
      toast.success(`Demo assets stored successfully! Map photo + ${thumbnailUrls.length} thumbnails`);
      
    } catch (error) {
      console.error('Error storing demo assets:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to store demo assets');
    } finally {
      setIsStoringAssets(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Store demo assets for the landmark animation:
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="w-3 h-3" />
          <span>Map with Eiffel Tower marker (from uploaded image)</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Camera className="w-3 h-3" />
          <span>3 Eiffel Tower thumbnails (from Google Places API)</span>
        </div>
      </div>

      <Button
        onClick={handleStoreAssets}
        disabled={isStoringAssets}
        size="sm"
        className="w-full"
      >
        {isStoringAssets ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Storing Assets...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Store Demo Assets
          </>
        )}
      </Button>

      {storedAssets.mapPhoto && (
        <div className="space-y-2 text-xs">
          <div className="font-semibold text-green-600">✓ Stored Assets:</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              <span className="font-mono bg-muted px-1 rounded text-xs">
                {storedAssets.mapPhoto.split('/').pop()}
              </span>
            </div>
            {storedAssets.thumbnails?.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <Camera className="w-3 h-3" />
                <span className="font-mono bg-muted px-1 rounded text-xs">
                  {url.split('/').pop()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoAssetsUtility;