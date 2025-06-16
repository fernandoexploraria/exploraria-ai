
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Cloud, ExternalLink, Loader2 } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LandmarkToolsProps {
  landmark: Landmark;
}

interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
}

interface CalendarEvent {
  title: string;
  startTime: string;
  endTime: string;
  description: string;
  location: string;
  coordinates: [number, number];
}

const LandmarkTools: React.FC<LandmarkToolsProps> = ({ landmark }) => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null);
  const [calendarUrls, setCalendarUrls] = useState<any>(null);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  
  // Calendar form state
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [duration, setDuration] = useState('2');
  const [eventDescription, setEventDescription] = useState('');

  const fetchWeather = async () => {
    setIsLoadingWeather(true);
    try {
      const { data, error } = await supabase.functions.invoke('weather-tool', {
        body: {
          latitude: landmark.coordinates[1],
          longitude: landmark.coordinates[0],
          landmarkName: landmark.name
        }
      });

      if (error) throw error;

      setWeatherData(data.weather);
      toast.success(`Weather data fetched for ${landmark.name}`);
    } catch (error) {
      console.error('Error fetching weather:', error);
      toast.error('Failed to fetch weather data. Please try again.');
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const createCalendarEvent = async () => {
    if (!eventDate || !eventTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const startDateTime = new Date(`${eventDate}T${eventTime}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60 * 60 * 1000);

      const { data, error } = await supabase.functions.invoke('calendar-tool', {
        body: {
          landmarkName: landmark.name,
          description: eventDescription || `Visit to ${landmark.name}. ${landmark.description}`,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          location: landmark.name,
          coordinates: landmark.coordinates
        }
      });

      if (error) throw error;

      setCalendarEvent(data.event);
      setCalendarUrls(data.calendarUrls);
      toast.success(`Calendar event created for ${landmark.name}`);
    } catch (error) {
      console.error('Error creating calendar event:', error);
      toast.error('Failed to create calendar event. Please try again.');
    }
  };

  const openCalendarUrl = (provider: string) => {
    if (calendarUrls) {
      if (provider === 'google' || provider === 'outlook') {
        window.open(calendarUrls[provider], '_blank');
      } else if (provider === 'apple') {
        // For Apple Calendar, we'll copy the event details to clipboard
        const eventText = `Title: ${calendarUrls.apple.title}\nDate: ${calendarUrls.apple.startDate}\nLocation: ${calendarUrls.apple.location}\nDescription: ${calendarUrls.apple.description}`;
        navigator.clipboard.writeText(eventText);
        toast.success('Event details copied to clipboard. You can add this to your Apple Calendar manually.');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Weather Tool */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Cloud className="h-4 w-4" />
            Weather Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!weatherData ? (
            <Button 
              onClick={fetchWeather} 
              disabled={isLoadingWeather}
              size="sm"
              className="w-full"
            >
              {isLoadingWeather && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Get Current Weather
            </Button>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Temperature:</span>
                <span>{weatherData.temperature}°C</span>
              </div>
              <div className="flex justify-between">
                <span>Condition:</span>
                <span className="capitalize">{weatherData.description}</span>
              </div>
              <div className="flex justify-between">
                <span>Feels like:</span>
                <span>{weatherData.feelsLike}°C</span>
              </div>
              <div className="flex justify-between">
                <span>Humidity:</span>
                <span>{weatherData.humidity}%</span>
              </div>
              <Button 
                onClick={fetchWeather} 
                disabled={isLoadingWeather}
                size="sm"
                variant="outline"
                className="w-full mt-2"
              >
                Refresh Weather
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Tool */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            Schedule Visit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog open={isCalendarDialogOpen} onOpenChange={setIsCalendarDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full">
                Add to Calendar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule Visit to {landmark.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventTime">Time</Label>
                  <Input
                    id="eventTime"
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (hours)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="12"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventDescription">Notes (optional)</Label>
                  <Textarea
                    id="eventDescription"
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="Add any additional notes for your visit..."
                  />
                </div>
                <Button onClick={createCalendarEvent} className="w-full">
                  Create Event
                </Button>
                
                {calendarUrls && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Add to your calendar:</Label>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCalendarUrl('google')}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Google Calendar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCalendarUrl('outlook')}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Outlook Calendar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCalendarUrl('apple')}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Copy for Apple Calendar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default LandmarkTools;
