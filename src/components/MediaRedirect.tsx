
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShortUrl, getShortUrlInfo } from '@/utils/urlShortener';

const MediaRedirect: React.FC = () => {
  const { shortCode } = useParams<{ shortCode: string }>();

  useEffect(() => {
    if (shortCode) {
      const originalUrl = resolveShortUrl(shortCode);
      const urlInfo = getShortUrlInfo(shortCode);
      
      if (originalUrl && urlInfo) {
        // Log analytics if needed
        console.log(`Redirecting to ${urlInfo.type} for ${urlInfo.destination}`);
        
        // Redirect to the original URL
        window.location.href = originalUrl;
      } else {
        // Handle invalid short code
        console.error('Short URL not found:', shortCode);
        window.location.href = '/';
      }
    }
  }, [shortCode]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p>Redirecting to media...</p>
      </div>
    </div>
  );
};

export default MediaRedirect;
