
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, MapPin } from 'lucide-react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { formatDistance } from '@/utils/proximityUtils';
import { landmarks } from '@/data/landmarks';

const ProximityAlertsList: React.FC = () => {
  const { proximityAlerts, proximitySettings, setProximityAlerts } = useProximityAlerts();

  const handleToggleAlert = async (alertId: string, enabled: boolean) => {
    setProximityAlerts(prevAlerts =>
      prevAlerts.map(alert =>
        alert.id === alertId
          ? { ...alert, is_enabled: enabled, updated_at: new Date().toISOString() }
          : alert
      )
    );
  };

  const handleRemoveAlert = async (alertId: string) => {
    setProximityAlerts(prevAlerts =>
      prevAlerts.filter(alert => alert.id !== alertId)
    );
  };

  const getLandmarkName = (landmarkId: string) => {
    const landmark = landmarks.find(l => l.id === landmarkId);
    return landmark?.name || 'Unknown Landmark';
  };

  if (proximityAlerts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No proximity alerts set up yet.</p>
            <p className="text-sm">Alerts will appear here when you create them.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {proximityAlerts.map((alert) => (
        <Card key={alert.id} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {getLandmarkName(alert.landmark_id)}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={alert.is_enabled ? "default" : "secondary"}>
                  {formatDistance(alert.distance, alert.unit)}
                </Badge>
                <Switch
                  checked={alert.is_enabled}
                  onCheckedChange={(checked) => handleToggleAlert(alert.id, checked)}
                  size="sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {alert.is_enabled ? 'Alert active' : 'Alert disabled'}
                {alert.last_triggered && (
                  <span className="ml-2">
                    • Last triggered: {new Date(alert.last_triggered).toLocaleDateString()}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveAlert(alert.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProximityAlertsList;
