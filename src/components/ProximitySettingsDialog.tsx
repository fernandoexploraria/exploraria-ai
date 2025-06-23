
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { formatDistance } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { ProximitySettings } from '@/types/proximityAlerts';

const formSchema = z.object({
  is_enabled: z.boolean(),
  default_distance: z.number().min(50).max(5000),
  unit: z.enum(['metric', 'imperial']),
  notification_enabled: z.boolean(),
  sound_enabled: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface ProximitySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_DISTANCES = {
  metric: [100, 250, 500, 1000, 2000],
  imperial: [328, 820, 1640, 3280, 6560], // feet equivalents
};

const ProximitySettingsDialog: React.FC<ProximitySettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { proximitySettings, saveProximitySettings, isLoading } = useProximityAlerts();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      is_enabled: proximitySettings?.is_enabled || false,
      default_distance: proximitySettings?.default_distance || 100,
      unit: proximitySettings?.unit || 'metric',
      notification_enabled: proximitySettings?.notification_enabled || true,
      sound_enabled: proximitySettings?.sound_enabled || true,
    },
  });

  React.useEffect(() => {
    if (proximitySettings) {
      form.reset({
        is_enabled: proximitySettings.is_enabled,
        default_distance: proximitySettings.default_distance,
        unit: proximitySettings.unit,
        notification_enabled: proximitySettings.notification_enabled,
        sound_enabled: proximitySettings.sound_enabled,
      });
    }
  }, [proximitySettings, form]);

  const onSubmit = async (values: FormValues) => {
    if (!proximitySettings) return;

    const updatedSettings: ProximitySettings = {
      ...proximitySettings,
      ...values,
      updated_at: new Date().toISOString(),
    };

    await saveProximitySettings(updatedSettings);
    onOpenChange(false);
  };

  const watchedUnit = form.watch('unit');
  const watchedDistance = form.watch('default_distance');

  const handlePresetDistance = (distance: number) => {
    form.setValue('default_distance', distance);
  };

  const handleUnitChange = (newUnit: 'metric' | 'imperial') => {
    const currentDistance = form.getValues('default_distance');
    const currentUnit = form.getValues('unit');
    
    if (currentUnit !== newUnit) {
      // Convert distance to new unit
      const convertedDistance = currentUnit === 'metric' && newUnit === 'imperial'
        ? Math.round(currentDistance * 3.28084) // meters to feet
        : Math.round(currentDistance / 3.28084); // feet to meters
      
      form.setValue('unit', newUnit);
      form.setValue('default_distance', convertedDistance);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Proximity Alert Settings</DialogTitle>
          <DialogDescription>
            Configure proximity alerts to get notified when you're near landmarks.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Master Enable/Disable Toggle */}
            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Proximity Alerts
                    </FormLabel>
                    <FormDescription>
                      Turn on proximity alerts for landmarks
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Unit Selection */}
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distance Units</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      value={field.value}
                      onValueChange={(value) => {
                        if (value) handleUnitChange(value as 'metric' | 'imperial');
                      }}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="metric">
                        Metric (m/km)
                      </ToggleGroupItem>
                      <ToggleGroupItem value="imperial">
                        Imperial (ft/mi)
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Distance Selection */}
            <FormField
              control={form.control}
              name="default_distance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Default Alert Distance: {formatDistance(watchedDistance, watchedUnit)}
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <Slider
                        min={watchedUnit === 'metric' ? 50 : 164}
                        max={watchedUnit === 'metric' ? 5000 : 16404}
                        step={watchedUnit === 'metric' ? 50 : 164}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                      />
                      
                      {/* Preset Distance Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
                        {PRESET_DISTANCES[watchedUnit].map((distance) => (
                          <Badge
                            key={distance}
                            variant={watchedDistance === distance ? "default" : "outline"}
                            className="cursor-pointer hover:bg-primary/80"
                            onClick={() => handlePresetDistance(distance)}
                          >
                            {formatDistance(distance, watchedUnit)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Choose the default distance for proximity alerts
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notification Settings */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="notification_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Browser Notifications
                      </FormLabel>
                      <FormDescription>
                        Show notifications in your browser
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sound_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Sound Alerts
                      </FormLabel>
                      <FormDescription>
                        Play sound when alerts are triggered
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProximitySettingsDialog;
