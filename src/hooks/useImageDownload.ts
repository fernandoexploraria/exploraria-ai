
import { useState } from 'react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useIsMobile } from './use-mobile';
import { useToast } from './use-toast';

export const useImageDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Utility function to detect if URL is base64 data URL
  const isBase64DataUrl = (url: string): boolean => {
    return url.startsWith('data:image/');
  };

  // Utility function to extract MIME type and extension from base64 data URL
  const parseBase64DataUrl = (dataUrl: string) => {
    const matches = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 data URL format');
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    
    // Map MIME types to file extensions
    const extensionMap: Record<string, string> = {
      'jpeg': 'jpg',
      'jpg': 'jpg',
      'png': 'png',
      'webp': 'webp',
      'gif': 'gif',
      'bmp': 'bmp',
      'svg+xml': 'svg'
    };
    
    const extension = extensionMap[mimeType] || 'jpg';
    
    return {
      mimeType: `image/${mimeType}`,
      extension,
      base64Data
    };
  };

  // Convert base64 to blob
  const base64ToBlob = (base64Data: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

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
      let cleanFilename: string;
      let finalImageUrl = imageUrl;
      
      // Handle base64 data URLs differently
      if (isBase64DataUrl(imageUrl)) {
        const { extension } = parseBase64DataUrl(imageUrl);
        cleanFilename = `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
      } else {
        cleanFilename = `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      }

      if (isMobile && Capacitor.isNativePlatform()) {
        // Native mobile download using Capacitor
        await downloadMobileNative(finalImageUrl, cleanFilename);
      } else {
        // Desktop/web download
        await downloadWeb(finalImageUrl, cleanFilename);
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
      
      // Fallback: open in new tab (only works for HTTP URLs)
      if (!isBase64DataUrl(imageUrl)) {
        window.open(imageUrl, '_blank');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadMobileNative = async (imageUrl: string, filename: string) => {
    try {
      let base64Data: string;
      
      if (isBase64DataUrl(imageUrl)) {
        // For base64 data URLs, extract the base64 data directly
        const parsed = parseBase64DataUrl(imageUrl);
        base64Data = parsed.base64Data;
      } else {
        // For HTTP URLs, fetch and convert to base64
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('Failed to fetch image');
        
        const blob = await response.blob();
        const reader = new FileReader();
        
        base64Data = await new Promise((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = () => reject(new Error('Failed to read image'));
          reader.readAsDataURL(blob);
        });
      }
      
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      
    } catch (error) {
      throw new Error(`Mobile download failed: ${error}`);
    }
  };

  const downloadWeb = async (imageUrl: string, filename: string) => {
    try {
      if (isBase64DataUrl(imageUrl)) {
        // For base64 data URLs, create blob and download
        const { mimeType, base64Data } = parseBase64DataUrl(imageUrl);
        const blob = base64ToBlob(base64Data, mimeType);
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL
        URL.revokeObjectURL(blobUrl);
      } else {
        // For HTTP URLs, use existing logic
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
