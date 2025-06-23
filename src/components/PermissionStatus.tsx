import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, HelpCircle, Settings, RotateCcw, Smartphone, AlertCircle } from 'lucide-react';
import { usePermissionMonitor } from '@/hooks/usePermissionMonitor';

interface PermissionStatusProps {
  onRetryPermission?: () => void;
  showRetryButton?: boolean;
  compact?: boolean;
  isProximityEnabled?: boolean;
}

const PermissionStatus: React.FC<PermissionStatusProps> = ({
  onRetryPermission,
  showRetryButton = true,
  compact = false,
  isProximityEnabled = false,
}) => {
  const { permissionState, requestPermission } = usePermissionMonitor();

  const handleRetryPermission = async () => {
    const granted = await requestPermission();
    if (granted && onRetryPermission) {
      onRetryPermission();
    }
  };

  const getStatusInfo = () => {
    // Enhanced messaging when proximity is enabled but permission is denied
    const isRecoveryMode = isProximityEnabled && permissionState.state === 'denied';
    
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
          icon: isRecoveryMode ? <AlertCircle className="h-4 w-4 text-amber-600" /> : <AlertTriangle className="h-4 w-4 text-destructive" />,
          text: isRecoveryMode ? 'Permission Required for Active Alerts' : 'Permission Denied',
          variant: isRecoveryMode ? 'secondary' as const : 'destructive' as const,
          description: isRecoveryMode 
            ? 'Your proximity alerts are enabled but need location permission to work. Fix this to resume notifications.'
            : 'Location access was denied. Please reset browser permissions to enable proximity alerts.',
          showRetry: true,
          isRecoveryMode,
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

  // Detect if user is on mobile Safari
  const isMobileSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={statusInfo.variant} className="flex items-center gap-1">
          {statusInfo.icon}
          <span className="hidden sm:inline">{statusInfo.text}</span>
        </Badge>
        {showRetryButton && statusInfo.showRetry && (
          <Button
            variant={statusInfo.isRecoveryMode ? "default" : "outline"}
            size="sm"
            onClick={handleRetryPermission}
            className="h-6 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            {statusInfo.isRecoveryMode ? 'Fix' : 'Retry'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${statusInfo.isRecoveryMode ? 'border-amber-200 bg-amber-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusInfo.icon}
          <span className="font-medium">{statusInfo.text}</span>
        </div>
        <Badge variant={statusInfo.variant}>
          {statusInfo.isRecoveryMode ? 'Needs Fix' : permissionState.state.charAt(0).toUpperCase() + permissionState.state.slice(1)}
        </Badge>
      </div>
      
      <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
      
      {statusInfo.isRecoveryMode && (
        <div className="rounded-lg bg-amber-100 border border-amber-300 p-3">
          <div className="text-sm font-medium text-amber-800 mb-2">
            🔧 Quick Fix Required
          </div>
          <div className="text-xs text-amber-700">
            Your proximity alerts are turned on but can't work without location permission. 
            Use the button below to fix this and resume getting notifications near landmarks.
          </div>
        </div>
      )}
      
      {permissionState.state === 'denied' && !statusInfo.isRecoveryMode && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <div className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
            {isMobileSafari && <Smartphone className="h-4 w-4" />}
            How to Reset Location Permission:
          </div>
          
          {isMobileSafari ? (
            <div className="text-xs text-destructive/80 space-y-2">
              <div className="font-medium">Method 1 - Clear Website Data:</div>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Tap the "aA" icon in Safari's address bar</li>
                <li>Select "Website Settings"</li>
                <li>Tap "Clear Website Data"</li>
                <li>Refresh this page and try again</li>
              </ol>
              
              <div className="font-medium mt-3">Method 2 - Safari Settings:</div>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to Settings → Safari → Privacy & Security</li>
                <li>Tap "Manage Website Data"</li>
                <li>Find this website and swipe left to delete</li>
                <li>Refresh this page and try again</li>
              </ol>
            </div>
          ) : (
            <div className="text-xs text-destructive/80 space-y-2">
              <div><strong>Desktop Browsers:</strong></div>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Chrome/Edge:</strong> Click the location icon in the address bar → Reset</li>
                <li><strong>Firefox:</strong> Click the shield icon → Permissions → Reset Location</li>
                <li><strong>Safari:</strong> Go to Website Settings in the address bar → Reset</li>
              </ul>
              
              <div className="mt-2"><strong>Mobile Browsers:</strong></div>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Check your browser's site permissions in settings</li>
                <li>Clear website data for this site and refresh</li>
              </ul>
            </div>
          )}
          
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <strong>Note:</strong> Browsers don't re-prompt for location after initial denial. 
            You must manually reset the permission using the steps above.
          </div>
        </div>
      )}
      
      {showRetryButton && statusInfo.showRetry && (
        <Button
          variant={statusInfo.isRecoveryMode ? 'default' : permissionState.state === 'denied' ? 'destructive' : 'outline'}
          size="sm"
          onClick={handleRetryPermission}
          className="w-full"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {statusInfo.isRecoveryMode ? 'Fix Location Permission' : permissionState.state === 'denied' ? 'Check If Permission Reset' : 'Request Permission'}
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
