
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi, Signal, SignalLow } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = '',
  showDetails = false
}) => {
  const { isOnline, isSlowConnection, effectiveType, downlink } = useNetworkStatus();

  if (isOnline && !showDetails && !isSlowConnection) {
    return null;
  }

  const getIcon = () => {
    if (!isOnline) return <WifiOff className="h-3 w-3" />;
    if (isSlowConnection) return <SignalLow className="h-3 w-3" />;
    return <Signal className="h-3 w-3" />;
  };

  const getVariant = () => {
    if (!isOnline) return 'destructive';
    if (isSlowConnection) return 'secondary';
    return 'default';
  };

  const getText = () => {
    if (!isOnline) return 'Offline';
    if (isSlowConnection) return `Slow (${effectiveType})`;
    if (showDetails) return `${effectiveType} • ${downlink.toFixed(1)} Mbps`;
    return 'Online';
  };

  return (
    <Badge 
      variant={getVariant() as any} 
      className={`flex items-center gap-1 ${className}`}
    >
      {getIcon()}
      <span className="text-xs">{getText()}</span>
    </Badge>
  );
};

export default OfflineIndicator;
