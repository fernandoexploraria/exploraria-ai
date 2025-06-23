
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff, Loader2, Plus, Check } from 'lucide-react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { formatDistance } from '@/utils/proximityUtils';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from '@/data/landmarks';

interface CreateProximityAlertProps {
  landmark: Landmark;
  onSuccess?: () => void;
}

const PRESET_DISTANCES = [50, 100, 250, 500, 1000];

const CreateProximityAlert: React.FC<CreateProximityAlertProps> = ({
  landmark,
  onSuccess
}) => {
  const { proximitySettings, proximityAlerts, createProximityAlert } = useProximityAlerts();
  const { toast } = useToast();
  
  const [isCreating, setIsCreating] = useState(false);
  const [distance, setDistance] = useState(proximitySettings?.default_distance || 100);
  const [showCustomDistance, setShowCustomDistance] = useState(false);

  // Check if alert already exists for this landmark
  const existingAlert = proximityAlerts.find(alert => alert.landmark_id === landmark.id);

  const handleCreateAlert = async () => {
    if (!proximitySettings) {
      toast({
        title: "Settings Required",
        description: "Please configure proximity settings first.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      await createProximityAlert(landmark.id, distance);
      toast({
        title: "Alert Created",
        description: `You'll be notified when within ${formatDistance(distance)} of ${landmark.name}.`,
      });
      onSuccess?.();
    } catch (error) {
      console.error('Error creating alert:', error);
      toast({
        title: "Error",
        description: "Failed to create proximity alert. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDistanceChange = (value: number[]) => {
    setDistance(value[0]);
  };

  const handlePresetDistance = (presetDistance: number) => {
    setDistance(presetDistance);
  };

  if (!proximitySettings) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        <p className="text-sm">Proximity settings not available</p>
      </div>
    );
  }

  if (existingAlert) {
    return (
      <div className="text-center p-4 space-y-2">
        <div className="flex items-center justify-center gap-2 text-green-600">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">Alert Already Set</span>
        </div>
        <p className="text-xs text-muted-foreground">
          You have an alert for this landmark at {formatDistance(existingAlert.distance)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-medium mb-2">Create Proximity Alert</h3>
        <p className="text-sm text-muted-foreground">
          Get notified when you're near {landmark.name}
        </p>
      </div>

      <div className="space-y-3">
        {/* Quick distance selection */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Alert Distance</div>
          <div className="flex flex-wrap gap-2">
            {PRESET_DISTANCES.map((presetDistance) => (
              <Badge
                key={presetDistance}
                variant={distance === presetDistance ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80"
                onClick={() => handlePresetDistance(presetDistance)}
              >
                {formatDistance(presetDistance)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Custom distance toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm">Custom distance</span>
          <Switch
            checked={showCustomDistance}
            onCheckedChange={setShowCustomDistance}
          />
        </div>

        {/* Custom distance slider */}
        {showCustomDistance && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Custom: {formatDistance(distance)}
            </div>
            <Slider
              min={25}
              max={2000}
              step={25}
              value={[distance]}
              onValueChange={handleDistanceChange}
              className="w-full"
            />
          </div>
        )}
      </div>

      <Button
        onClick={handleCreateAlert}
        disabled={isCreating || !proximitySettings.is_enabled}
        className="w-full"
      >
        {isCreating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Alert...
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Create Alert
          </>
        )}
      </Button>

      {!proximitySettings.is_enabled && (
        <p className="text-xs text-amber-600 text-center">
          Enable proximity alerts in settings first
        </p>
      )}
    </div>
  );
};

export default CreateProximityAlert;
