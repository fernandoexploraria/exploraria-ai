
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, MapPin, Loader2 } from 'lucide-react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { formatDistance } from '@/utils/proximityUtils';
import { landmarks } from '@/data/landmarks';
import { useToast } from '@/hooks/use-toast';

const ProximityAlertsList: React.FC = () => {
  const { proximityAlerts, updateProximityAlert, deleteProximityAlert } = useProximityAlerts();
  const { toast } = useToast();
  const [loadingStates, setLoadingStates] = React.useState<{ [key: string]: boolean }>({});

  const handleToggleAlert = async (alertId: string, enabled: boolean) => {
    setLoadingStates(prev => ({ ...prev, [alertId]: true }));
    
    try {
      await updateProximityAlert(alertId, { is_enabled: enabled });
      toast({
        title: enabled ? "Alert Enabled" : "Alert Disabled",
        description: enabled ? "You'll be notified when near this landmark." : "Notifications disabled for this landmark.",
      });
    } catch (error) {
      console.error('Error toggling alert:', error);
      toast({
        title: "Error",
        description: "Failed to update alert. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const handleRemoveAlert = async (alertId: string) => {
    setLoadingStates(prev => ({ ...prev, [alertId]: true }));
    
    try {
      await deleteProximityAlert(alertId);
      toast({
        title: "Alert Removed",
        description: "Proximity alert has been deleted.",
      });
    } catch (error) {
      console.error('Error removing alert:', error);
      toast({
        title: "Error",
        description: "Failed to remove alert. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [alertId]: false }));
    }
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
            <p className="text-sm">Alerts will appear here when you create them from landmarks.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {proximityAlerts.map((alert) => {
        const isLoading = loadingStates[alert.id] || false;
        
        return (
          <Card key={alert.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {getLandmarkName(alert.landmark_id)}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={alert.is_enabled ? "default" : "secondary"}>
                    {formatDistance(alert.distance)}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    <Switch
                      checked={alert.is_enabled}
                      onCheckedChange={(checked) => handleToggleAlert(alert.id, checked)}
                      disabled={isLoading}
                    />
                  </div>
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
                  disabled={isLoading}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ProximityAlertsList;
