
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi, Signal, SignalLow, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
  showConnectionHealth?: boolean;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = '',
  showDetails = false,
  showConnectionHealth = true
}) => {
  const { isOnline, isSlowConnection, effectiveType, downlink } = useNetworkStatus();
  const { connectionHealth } = useConnectionMonitor();

  const networkIcon = () => {
    if (!isOnline) return <WifiOff className="h-3 w-3" />;
    if (isSlowConnection) return <SignalLow className="h-3 w-3" />;
    return <Signal className="h-3 w-3" />;
  };

  const networkVariant = () => {
    if (!isOnline) return 'destructive';
    if (isSlowConnection) return 'secondary';
    return 'default';
  };

  const networkText = () => {
    if (!isOnline) return 'Offline';
    if (isSlowConnection) return `Slow (${effectiveType})`;
    if (showDetails) return `${effectiveType} • ${downlink.toFixed(1)} Mbps`;
    return 'Online';
  };

  const shouldShow = !isOnline || showDetails || isSlowConnection || 
    (showConnectionHealth && !connectionHealth.isHealthy);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Network Status */}
      <Badge 
        variant={networkVariant() as any} 
        className="flex items-center gap-1"
      >
        {networkIcon()}
        <span className="text-xs">{networkText()}</span>
      </Badge>

      {/* Connection Health */}
      {showConnectionHealth && !connectionHealth.isHealthy && (
        <Badge 
          variant="destructive" 
          className="flex items-center gap-1"
        >
          <AlertTriangle className="h-3 w-3" />
          <span className="text-xs">
            {connectionHealth.issues.length} connection issue{connectionHealth.issues.length !== 1 ? 's' : ''}
          </span>
        </Badge>
      )}
    </div>
  );
};

export default OfflineIndicator;
