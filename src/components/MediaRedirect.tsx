
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShortUrl, getShortUrlInfo } from '@/utils/urlShortener';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft } from 'lucide-react';

const MediaRedirect: React.FC = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [urlInfo, setUrlInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    console.log('MediaRedirect loaded with shortCode:', shortCode);
    
    if (shortCode) {
      const originalUrl = resolveShortUrl(shortCode);
      const info = getShortUrlInfo(shortCode);
      
      console.log('Original URL:', originalUrl);
      console.log('URL Info:', info);
      
      if (originalUrl && info) {
        console.log(`Loading ${info.type} for ${info.destination}`);
        setMediaUrl(originalUrl);
        setUrlInfo(info);
      } else {
        console.error('Short URL not found:', shortCode);
        setError(true);
      }
      setLoading(false);
    }
  }, [shortCode]);

  const handleDownload = () => {
    if (mediaUrl) {
      window.open(mediaUrl, '_blank');
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading media...</p>
        </div>
      </div>
    );
  }

  if (error || !mediaUrl || !urlInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Media Not Found</h1>
          <p className="mb-2">The media you're looking for could not be found.</p>
          <p className="mb-6 text-sm text-gray-400">Short code: {shortCode}</p>
          <Button onClick={handleGoHome} className="bg-blue-600 hover:bg-blue-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  console.log('Rendering media with URL:', mediaUrl);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {urlInfo.type === 'image' ? '📸' : '🎵'} {urlInfo.destination}
            </h1>
            <p className="text-gray-400">
              {urlInfo.type === 'image' ? 'Photo' : 'Audio'} from Exploraria AI
            </p>
            <p className="text-xs text-gray-500 mt-1">URL: {mediaUrl}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleDownload}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button 
              onClick={handleGoHome}
              variant="outline"
              className="border-gray-600 text-white hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Home
            </Button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          {urlInfo.type === 'image' ? (
            <div className="text-center">
              <img 
                src={mediaUrl} 
                alt={`${urlInfo.destination} landmark`}
                className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
                onLoad={() => console.log('Image loaded successfully')}
                onError={(e) => {
                  console.error('Image failed to load:', e);
                  setError(true);
                }}
              />
            </div>
          ) : (
            <div className="text-center">
              <div className="bg-gray-700 rounded-lg p-8 mb-4">
                <div className="text-6xl mb-4">🎵</div>
                <h3 className="text-xl font-semibold mb-2">Audio from {urlInfo.destination}</h3>
              </div>
              <audio 
                controls 
                className="w-full max-w-md mx-auto"
                src={mediaUrl}
                onLoadedData={() => console.log('Audio loaded successfully')}
                onError={(e) => {
                  console.error('Audio failed to load:', e);
                  setError(true);
                }}
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaRedirect;
