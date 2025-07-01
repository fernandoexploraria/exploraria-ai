
import { useState } from 'react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useIsMobile } from './use-mobile';
import { useToast } from './use-toast';

export const useImageDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const downloadImage = async (imageUrl: string, filename: string) => {
    if (!imageUrl) {
      toast({
        title: "Download failed",
        description: "No image available to download.",
        variant: "destructive"
      });
      return;
    }

    setIsDownloading(true);

    try {
      // Clean filename for safe file operations
      const cleanFilename = `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;

      if (isMobile && Capacitor.isNativePlatform()) {
        // Native mobile download using Capacitor
        await downloadMobileNative(imageUrl, cleanFilename);
      } else {
        // Desktop/web download
        await downloadWeb(imageUrl, cleanFilename);
      }

      toast({
        title: "Download successful",
        description: `Image saved as ${cleanFilename}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "Could not download the image. Opening in new tab instead.",
        variant: "destructive"
      });
      
      // Fallback: open in new tab
      window.open(imageUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadMobileNative = async (imageUrl: string, filename: string) => {
    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            
            await Filesystem.writeFile({
              path: filename,
              data: base64Data,
              directory: Directory.Documents,
              encoding: Encoding.UTF8,
            });
            
            resolve(true);
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error(`Mobile download failed: ${error}`);
    }
  };

  const downloadWeb = async (imageUrl: string, filename: string) => {
    try {
      // For mobile web or desktop, use traditional download approach
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        // Mobile web - open in new tab for manual save
        window.open(imageUrl, '_blank');
      } else {
        // Desktop - try direct download
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      throw new Error(`Web download failed: ${error}`);
    }
  };

  return {
    downloadImage,
    isDownloading
  };
};
