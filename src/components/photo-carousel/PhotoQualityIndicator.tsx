import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { 
  Wifi, 
  WifiOff, 
  Signal, 
  SignalHigh, 
  SignalMedium, 
  SignalLow,
  Info,
  Zap,
  Clock,
  Database,
  Cloud,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoQualityIndicatorProps {
  photo: PhotoData;
  className?: string;
}

const PhotoQualityIndicator: React.FC<PhotoQualityIndicatorProps> = ({
  photo,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    isOnline, 
    isSlowConnection, 
    effectiveType, 
    downlink,
    getOptimalImageQuality 
  } = useNetworkStatus();

  const currentQuality = getOptimalImageQuality();
  
  // Get photo source information
  const getPhotoSourceInfo = () => {
    const source = photo.photoSource || 'unknown';
    switch (source) {
      case 'database_raw_data':
        return {
          label: 'DB',
          fullName: 'Database Raw Data',
          color: 'bg-blue-500',
          icon: Database,
          description: 'Loaded from cached database raw_data'
        };
      case 'database_photos_field':
        return {
          label: 'DB',
          fullName: 'Database Photos Field',
          color: 'bg-green-500',
          icon: Database,
          description: 'Loaded from database photos field'
        };
      case 'google_places_api':
        return {
          label: 'API',
          fullName: 'Google Places API',
          color: 'bg-orange-500',
          icon: Cloud,
          description: 'Fetched from Google Places API'
        };
      default:
        return {
          label: 'ERR',
          fullName: 'Unknown Source',
          color: 'bg-red-500',
          icon: AlertTriangle,
          description: 'Photo source unknown or error'
        };
    }
  };

  const sourceInfo = getPhotoSourceInfo();
  const SourceIcon = sourceInfo.icon;

  // Estimate data usage for different quality levels
  const getDataUsageEstimate = (quality: 'low' | 'medium' | 'high') => {
    const baseSize = 50; // KB for thumb
    switch (quality) {
      case 'low': return `~${baseSize}KB`;
      case 'medium': return `~${baseSize * 4}KB`;
      case 'high': return `~${baseSize * 12}KB`;
      default: return 'Unknown';
    }
  };

  const getQualityLabel = (quality: 'low' | 'medium' | 'high') => {
    switch (quality) {
      case 'low': return 'Basic';
      case 'medium': return 'Standard';
      case 'high': return 'High';
      default: return 'Auto';
    }
  };

  const getQualityColor = (quality: 'low' | 'medium' | 'high') => {
    switch (quality) {
      case 'low': return 'bg-yellow-500';
      case 'medium': return 'bg-blue-500';
      case 'high': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getNetworkIcon = () => {
    if (!isOnline) return WifiOff;
    if (isSlowConnection) return SignalLow;
    if (effectiveType === '3g') return SignalMedium;
    if (effectiveType === '4g') return SignalHigh;
    return Signal;
  };

  const NetworkIcon = getNetworkIcon();

  const getLoadingTimeEstimate = () => {
    if (!isOnline) return 'Offline';
    if (isSlowConnection) return '3-5s';
    if (effectiveType === '3g') return '1-2s';
    return '<1s';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'text-white hover:bg-white/20 px-2 py-1 h-auto gap-2',
            className
          )}
        >
          <div className="flex items-center gap-1">
            <NetworkIcon className="w-3 h-3" />
            <Badge 
              variant="secondary" 
              className={cn(
                'text-xs text-white border-0 px-1 py-0',
                getQualityColor(currentQuality)
              )}
            >
              {getQualityLabel(currentQuality)}
            </Badge>
          </div>
          
          {/* Visual Source Indicator */}
          <div className="flex items-center gap-1">
            <SourceIcon className="w-3 h-3" />
            <Badge 
              variant="secondary" 
              className={cn(
                'text-xs text-white border-0 px-1 py-0',
                sourceInfo.color
              )}
            >
              {sourceInfo.label}
            </Badge>
          </div>
          
          <Info className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-4">
        <div className="space-y-4">
          {/* Photo Source Information */}
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <SourceIcon className="w-4 h-4" />
              Photo Source
            </h4>
            <div className="flex items-center justify-between mb-2">
              <div>
                <Badge className={cn('text-white', sourceInfo.color)}>
                  {sourceInfo.fullName}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {sourceInfo.description}
                </div>
              </div>
            </div>
          </div>

          {/* Network Status */}
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <NetworkIcon className="w-4 h-4" />
              Network Status
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className={cn(
                  'ml-2 font-medium',
                  isOnline ? 'text-green-600' : 'text-red-600'
                )}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 font-medium capitalize">
                  {effectiveType || 'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Speed:</span>
                <span className="ml-2 font-medium">
                  {downlink ? `${downlink} Mbps` : 'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Quality:</span>
                <span className="ml-2 font-medium">
                  {isSlowConnection ? 'Slow' : 'Fast'}
                </span>
              </div>
            </div>
          </div>

          {/* Current Photo Quality */}
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Current Quality
            </h4>
            <div className="flex items-center justify-between">
              <div>
                <Badge className={cn('text-white', getQualityColor(currentQuality))}>
                  {getQualityLabel(currentQuality)}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {photo.width} × {photo.height}px
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">{getDataUsageEstimate(currentQuality)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {getLoadingTimeEstimate()}
                </div>
              </div>
            </div>
          </div>

          {/* Photo Metadata */}
          <div>
            <h4 className="font-medium text-sm mb-2">Photo Details</h4>
            <div className="space-y-1 text-sm">
              {photo.qualityScore && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quality Score:</span>
                  <span className="font-medium">
                    {Math.round(photo.qualityScore)}/100
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dimensions:</span>
                <span className="font-medium">
                  {photo.width} × {photo.height}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aspect Ratio:</span>
                <span className="font-medium">
                  {(photo.width / photo.height).toFixed(2)}:1
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Photo Reference:</span>
                <span className="font-medium text-xs break-all">
                  {photo.photoReference.length > 20 
                    ? `${photo.photoReference.substring(0, 20)}...` 
                    : photo.photoReference}
                </span>
              </div>
            </div>
          </div>

          {/* Available Qualities */}
          <div>
            <h4 className="font-medium text-sm mb-2">Available Qualities</h4>
            <div className="space-y-2">
              {(['low', 'medium', 'high'] as const).map((quality) => (
                <div key={quality} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      getQualityColor(quality)
                    )} />
                    <span>{getQualityLabel(quality)}</span>
                    {quality === currentQuality && (
                      <Badge variant="outline" className="text-xs py-0">Current</Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {getDataUsageEstimate(quality)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Network Recommendations */}
          {isSlowConnection && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-sm">
                <div className="font-medium text-yellow-800 mb-1">
                  Slow Connection Detected
                </div>
                <div className="text-yellow-700">
                  Using optimized quality to reduce loading times. 
                  Consider connecting to WiFi for better quality.
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PhotoQualityIndicator;
