
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, MapPin, Bell, BellOff } from 'lucide-react';
import ProximitySettingsDialog from './ProximitySettingsDialog';
import ProximityAlertsList from './ProximityAlertsList';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { formatDistance } from '@/utils/proximityUtils';

const ProximityControlPanel: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { proximitySettings, proximityAlerts, isLoading } = useProximityAlerts();

  const activeAlertsCount = proximityAlerts.filter(alert => alert.is_enabled).length;
  const isProximityEnabled = proximitySettings?.is_enabled || false;

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

  return (
    <div className="space-y-4">
      {/* Proximity Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isProximityEnabled ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              Proximity Alerts
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
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Status: {isProximityEnabled ? 'Enabled' : 'Disabled'}
              </p>
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
