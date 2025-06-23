
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, MapPin, Bell, BellOff, AlertTriangle, AlertCircle } from 'lucide-react';
import ProximitySettingsDialog from './ProximitySettingsDialog';
import ProximityAlertsList from './ProximityAlertsList';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { usePermissionMonitor } from '@/hooks/usePermissionMonitor';
import { formatDistance } from '@/utils/proximityUtils';

const ProximityControlPanel: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { proximitySettings, proximityAlerts, isLoading } = useProximityAlerts();
  const { permissionState } = usePermissionMonitor();

  const activeAlertsCount = proximityAlerts.filter(alert => alert.is_enabled).length;
  const isProximityEnabled = proximitySettings?.is_enabled || false;
  const isRecoveryMode = isProximityEnabled && permissionState.state === 'denied';

  if (isLoading && !proximitySettings) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Loading proximity settings...
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusInfo = () => {
    if (!isProximityEnabled) {
      return {
        icon: <BellOff className="h-5 w-5 text-muted-foreground" />,
        title: 'Proximity Alerts',
        status: 'Disabled',
        variant: 'outline' as const
      };
    }

    if (isRecoveryMode) {
      return {
        icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
        title: 'Proximity Alerts',
        status: 'Enabled (Permission Required)',
        variant: 'secondary' as const
      };
    }

    if (permissionState.state === 'denied') {
      return {
        icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
        title: 'Proximity Alerts',
        status: 'Permission Denied',
        variant: 'destructive' as const
      };
    }

    return {
      icon: <Bell className="h-5 w-5 text-primary" />,
      title: 'Proximity Alerts',
      status: 'Enabled',
      variant: 'default' as const
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="space-y-4">
      {/* Proximity Status Overview */}
      <Card className={isRecoveryMode ? 'border-amber-200 bg-amber-50/50' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {statusInfo.icon}
              {statusInfo.title}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Warning banner for recovery mode */}
          {isRecoveryMode && (
            <div className="mb-4 p-3 bg-amber-100 border border-amber-300 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium text-amber-800 mb-1">
                    Location Permission Required
                  </div>
                  <div className="text-amber-700">
                    Your proximity alerts are enabled but need location access to work. 
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="p-0 h-auto text-amber-700 underline ml-1"
                      onClick={() => setIsSettingsOpen(true)}
                    >
                      Fix this now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Status: 
                </p>
                <Badge variant={statusInfo.variant} className="text-xs">
                  {statusInfo.status}
                </Badge>
              </div>
              {proximitySettings && (
                <p className="text-sm text-muted-foreground">
                  Default distance: {formatDistance(proximitySettings.default_distance)}
                </p>
              )}
            </div>
            <div className="text-right">
              <Badge variant={activeAlertsCount > 0 ? "default" : "secondary"}>
                {activeAlertsCount} active alert{activeAlertsCount !== 1 ? 's' : ''}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {proximityAlerts.length} total
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proximity Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Proximity Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <ProximityAlertsList />
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <ProximitySettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
};

export default ProximityControlPanel;
