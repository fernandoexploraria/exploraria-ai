import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Wifi, 
  WifiOff, 
  RefreshCcw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Activity,
  Sparkles
} from 'lucide-react';
import { useTourStats } from '@/hooks/useTourStats';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { formatDistanceToNow } from 'date-fns';
import IntelligentTourDialog from './IntelligentTourDialog';
import AuthDialog from './AuthDialog';
import { useAuth } from '@/components/AuthProvider';
import { PostAuthAction } from '@/utils/authActions';

interface ConnectionStatusProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  className = '',
  showDetails = false,
  compact = false
}) => {
  const { user } = useAuth();
  const [isIntelligentTourOpen, setIsIntelligentTourOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  
  const { 
    connectionStatus: tourConnectionStatus, 
    forceReconnect: tourForceReconnect 
  } = useTourStats();
  
  const { 
    connectionStatus: proximityConnectionStatus, 
    forceReconnect: proximityForceReconnect 
  } = useProximityAlerts();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <RefreshCcw className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'polling':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'disconnected':
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'connected':
        return 'default';
      case 'connecting':
        return 'secondary';
      case 'polling':
        return 'outline';
      case 'failed':
        return 'destructive';
      case 'disconnected':
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'polling':
        return 'Polling';
      case 'failed':
        return 'Failed';
      case 'disconnected':
      default:
        return 'Disconnected';
    }
  };

  const formatLastUpdate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const handleReconnectAll = () => {
    console.log('🔄 Manual reconnection triggered for all services');
    tourForceReconnect();
    proximityForceReconnect();
  };

  const handleSmartTourClick = () => {
    console.log('🎯 Smart Tour clicked, user:', user?.id);
    
    if (!user) {
      console.log('🚨 User not authenticated, opening auth dialog with smart-tour action');
      setIsAuthDialogOpen(true);
    } else {
      console.log('✅ User authenticated, opening smart tour dialog');
      setIsIntelligentTourOpen(true);
    }
  };

  const handlePostAuthAction = (action: PostAuthAction) => {
    console.log('🎯 Executing post-auth action:', action);
    if (action === 'smart-tour') {
      setIsIntelligentTourOpen(true);
    }
  };

  const handleTourGenerated = (landmarks: any[]) => {
    console.log('🗺️ Tour generated with landmarks:', landmarks);
    setIsIntelligentTourOpen(false);
  };

  const handleAuthRequired = () => {
    console.log('🔐 Auth required callback - should not happen in new flow');
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant={getStatusVariant(tourConnectionStatus.status) as any} className="flex items-center gap-1">
          {getStatusIcon(tourConnectionStatus.status)}
          <span className="text-xs">Tour Stats</span>
        </Badge>
        <Badge variant={getStatusVariant(proximityConnectionStatus.status) as any} className="flex items-center gap-1">
          {getStatusIcon(proximityConnectionStatus.status)}
          <span className="text-xs">Proximity</span>
        </Badge>
        {(tourConnectionStatus.status === 'disconnected' || proximityConnectionStatus.status === 'disconnected') && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReconnectAll}
            className="h-6 px-2"
          >
            <RefreshCcw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  if (!showDetails) {
    // Show only if there are connection issues
    const hasIssues = tourConnectionStatus.status === 'disconnected' || 
                     proximityConnectionStatus.status === 'disconnected' ||
                     tourConnectionStatus.status === 'connecting' ||
                     proximityConnectionStatus.status === 'connecting';
    
    if (!hasIssues) return null;
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tour Stats Connection */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(tourConnectionStatus.status)}
              <span className="text-sm font-medium">Tour Stats</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(tourConnectionStatus.status) as any}>
                {getStatusText(tourConnectionStatus.status)}
              </Badge>
              {tourConnectionStatus.status === 'disconnected' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={tourForceReconnect}
                  className="h-6 px-2"
                >
                  <RefreshCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Proximity Alerts Connection */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(proximityConnectionStatus.status)}
              <span className="text-sm font-medium">Proximity Alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(proximityConnectionStatus.status) as any}>
                {getStatusText(proximityConnectionStatus.status)}
              </Badge>
              {proximityConnectionStatus.status === 'disconnected' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={proximityForceReconnect}
                  className="h-6 px-2"
                >
                  <RefreshCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Detailed Information */}
          {showDetails && (
            <div className="pt-2 border-t space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Tour Stats Last Update:</span>
                <span>{formatLastUpdate(tourConnectionStatus.lastDataUpdate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Proximity Last Update:</span>
                <span>{formatLastUpdate(proximityConnectionStatus.lastDataUpdate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tour Stats Status:</span>
                <span>{getStatusText(tourConnectionStatus.status)}</span>
              </div>
              <div className="flex justify-between">
                <span>Proximity Status:</span>
                <span>{getStatusText(proximityConnectionStatus.status)}</span>
              </div>
            </div>
          )}

          {/* Test IntelligentTour Button - Updated to handle auth */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSmartTourClick}
            className="w-full"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Test Smart Tour Dialog
          </Button>

          {/* Reconnect All Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleReconnectAll}
            className="w-full"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reconnect All
          </Button>
        </CardContent>
      </Card>

      {/* IntelligentTourDialog */}
      <IntelligentTourDialog
        open={isIntelligentTourOpen}
        onOpenChange={setIsIntelligentTourOpen}
        onTourGenerated={handleTourGenerated}
        onAuthRequired={handleAuthRequired}
      />

      {/* AuthDialog with success callback */}
      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        postAuthAction="smart-tour"
      />
    </>
  );
};

export default ConnectionStatus;
