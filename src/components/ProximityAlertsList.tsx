
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Bell } from 'lucide-react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { formatDistance } from '@/utils/proximityUtils';

const ProximityAlertsList: React.FC = () => {
  const { notifications, notificationsLoading } = useProximityAlerts();

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (notificationsLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Loading recent notifications...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No proximity notifications yet.</p>
            <p className="text-sm">Notifications will appear here when you get near landmarks.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold mb-3">Recent Proximity Notifications</h3>
      {notifications.map((notification) => (
        <Card key={notification.id} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {notification.landmark_name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {formatDistance(notification.distance)}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {formatTimeAgo(notification.created_at)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              You were {formatDistance(notification.distance)} away from this landmark
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProximityAlertsList;
