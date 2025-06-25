
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Users, Settings, Bell, BellOff, Timer, Activity, MessageSquare, Route, CreditCard } from 'lucide-react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { formatDistance } from '@/utils/proximityUtils';
import ProximitySettingsDialog from '@/components/ProximitySettingsDialog';

interface ProximityControlPanelProps {
  className?: string;
}

const ProximityControlPanel: React.FC<ProximityControlPanelProps> = ({ className }) => {
  const { userLocation, locationState } = useLocationTracking();
  const { proximitySettings, proximityAlerts } = useProximityAlerts();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const activeAlertsCount = proximityAlerts.filter(alert => alert.is_enabled).length;
  const totalAlertsCount = proximityAlerts.length;
  const isProximityEnabled = proximitySettings?.is_enabled || false;

  const handleEnableProximity = () => {
    setIsSettingsOpen(true);
  };

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Proximity Alerts
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnableProximity}
              className="h-8 px-2"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Status</div>
              <Badge variant={isProximityEnabled ? "default" : "secondary"} className="text-xs">
                {isProximityEnabled ? (
                  <>
                    <Bell className="h-3 w-3 mr-1" />
                    Active
                  </>
                ) : (
                  <>
                    <BellOff className="h-3 w-3 mr-1" />
                    Disabled
                  </>
                )}
              </Badge>
            </div>
            
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Personal Alerts</div>
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {activeAlertsCount} / {totalAlertsCount}
              </Badge>
            </div>
          </div>

          {/* Distance Settings Overview */}
          {proximitySettings && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Distance Settings</div>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs">
                    <MessageSquare className="h-3 w-3" />
                    Notification
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {formatDistance(proximitySettings.notification_distance)}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs">
                    <Route className="h-3 w-3" />
                    Outer Zone
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {formatDistance(proximitySettings.outer_distance)}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs">
                    <CreditCard className="h-3 w-3" />
                    Card
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {formatDistance(proximitySettings.card_distance)}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Location Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Location Tracking</span>
              <Badge variant={locationState.isTracking ? "default" : "destructive"} className="text-xs">
                {locationState.isTracking ? (
                  <>
                    <Activity className="h-3 w-3 mr-1" />
                    Active
                  </>
                ) : (
                  <>
                    <Timer className="h-3 w-3 mr-1" />
                    Inactive
                  </>
                )}
              </Badge>
            </div>
            
            {userLocation && (
              <div className="text-xs text-muted-foreground">
                Last update: {locationState.lastUpdate?.toLocaleTimeString() || 'Never'}
                {userLocation.accuracy && (
                  <span className="block">
                    Accuracy: ±{Math.round(userLocation.accuracy)}m
                  </span>
                )}
              </div>
            )}
            
            {locationState.error && (
              <div className="text-xs text-destructive">
                {locationState.error}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant={isProximityEnabled ? "secondary" : "default"}
              size="sm"
              onClick={handleEnableProximity}
              className="flex-1 text-xs h-8"
            >
              {isProximityEnabled ? 'Settings' : 'Enable Alerts'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <ProximitySettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </>
  );
};

export default ProximityControlPanel;
