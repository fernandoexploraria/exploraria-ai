
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, HelpCircle, Settings, RotateCcw } from 'lucide-react';
import { usePermissionMonitor } from '@/hooks/usePermissionMonitor';

interface PermissionStatusProps {
  onRetryPermission?: () => void;
  showRetryButton?: boolean;
  compact?: boolean;
}

const PermissionStatus: React.FC<PermissionStatusProps> = ({
  onRetryPermission,
  showRetryButton = true,
  compact = false,
}) => {
  const { permissionState, requestPermission } = usePermissionMonitor();

  const handleRetryPermission = async () => {
    const granted = await requestPermission();
    if (granted && onRetryPermission) {
      onRetryPermission();
    }
  };

  const getStatusInfo = () => {
    switch (permissionState.state) {
      case 'granted':
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
          text: 'Location Access Granted',
          variant: 'default' as const,
          description: 'Location services are working properly',
          showRetry: false,
        };
      case 'denied':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
          text: 'Permission Denied',
          variant: 'destructive' as const,
          description: 'Please enable location access in your browser settings',
          showRetry: true,
        };
      case 'prompt':
        return {
          icon: <HelpCircle className="h-4 w-4 text-blue-600" />,
          text: 'Permission Required',
          variant: 'secondary' as const,
          description: 'Click to allow location access',
          showRetry: true,
        };
      default:
        return {
          icon: <Settings className="h-4 w-4 text-muted-foreground" />,
          text: 'Checking Permission...',
          variant: 'outline' as const,
          description: 'Verifying location access status',
          showRetry: false,
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={statusInfo.variant} className="flex items-center gap-1">
          {statusInfo.icon}
          <span className="hidden sm:inline">{statusInfo.text}</span>
        </Badge>
        {showRetryButton && statusInfo.showRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryPermission}
            className="h-6 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusInfo.icon}
          <span className="font-medium">{statusInfo.text}</span>
        </div>
        <Badge variant={statusInfo.variant}>
          {permissionState.state.charAt(0).toUpperCase() + permissionState.state.slice(1)}
        </Badge>
      </div>
      
      <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
      
      {permissionState.state === 'denied' && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>To enable location access:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Chrome/Edge:</strong> Click the location icon in the address bar</li>
            <li><strong>Firefox:</strong> Click the shield icon, then "Permissions"</li>
            <li><strong>Safari:</strong> Go to Website Settings in the address bar</li>
            <li><strong>Mobile:</strong> Check your browser's site permissions in settings</li>
          </ul>
        </div>
      )}
      
      {showRetryButton && statusInfo.showRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetryPermission}
          className="w-full"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {permissionState.state === 'denied' ? 'Check Permission Again' : 'Request Permission'}
        </Button>
      )}
      
      {permissionState.lastChecked && (
        <p className="text-xs text-muted-foreground">
          Last checked: {permissionState.lastChecked.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

export default PermissionStatus;
