
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, MapPin } from 'lucide-react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { formatDistance } from '@/utils/proximityUtils';
import { landmarks } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS } from '@/data/tourLandmarks';
import { supabase } from '@/integrations/supabase/client';
import { ProximityAlert } from '@/types/proximityAlerts';

const ProximityAlertsList: React.FC = () => {
  const { proximitySettings } = useProximityAlerts();
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch proximity alerts from Supabase
  useEffect(() => {
    const fetchProximityAlerts = async () => {
      try {
        const { data, error } = await supabase
          .from('proximity_alerts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching proximity alerts:', error);
          return;
        }

        setProximityAlerts(data || []);
      } catch (err) {
        console.error('Failed to fetch proximity alerts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProximityAlerts();
  }, []);

  const handleToggleAlert = async (alertId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('proximity_alerts')
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) {
        console.error('Error updating proximity alert:', error);
        return;
      }

      setProximityAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === alertId
            ? { ...alert, is_enabled: enabled, updated_at: new Date().toISOString() }
            : alert
        )
      );
    } catch (err) {
      console.error('Failed to update proximity alert:', err);
    }
  };

  const handleRemoveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('proximity_alerts')
        .delete()
        .eq('id', alertId);

      if (error) {
        console.error('Error deleting proximity alert:', error);
        return;
      }

      setProximityAlerts(prevAlerts =>
        prevAlerts.filter(alert => alert.id !== alertId)
      );
    } catch (err) {
      console.error('Failed to delete proximity alert:', err);
    }
  };

  const getLandmarkName = (landmarkId: string) => {
    // Enhanced landmark lookup - check all sources with placeId compatibility
    const baseLandmark = landmarks.find(l => l.id === landmarkId || l.placeId === landmarkId);
    if (baseLandmark) return baseLandmark.name;

    const topLandmark = TOP_LANDMARKS.find(l => l.place_id === landmarkId || `top-${l.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}` === landmarkId);
    if (topLandmark) return topLandmark.name;

    const tourLandmark = TOUR_LANDMARKS.find(l => l.placeId === landmarkId || `tour-landmark-${l.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}` === landmarkId);
    if (tourLandmark) return tourLandmark.name;

    return 'Unknown Landmark';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Loading proximity alerts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
                  {formatDistance(alert.distance)}
                </Badge>
                <Switch
                  checked={alert.is_enabled}
                  onCheckedChange={(checked) => handleToggleAlert(alert.id, checked)}
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
