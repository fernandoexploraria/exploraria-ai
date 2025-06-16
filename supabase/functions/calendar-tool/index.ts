
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendarRequest {
  landmarkName: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  coordinates: [number, number];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { landmarkName, description, startTime, endTime, location, coordinates }: CalendarRequest = await req.json();
    
    console.log(`Creating calendar event for ${landmarkName}`);
    
    // Create a Google Calendar event URL (this will open Google Calendar with pre-filled data)
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    // Format dates for Google Calendar URL
    const formatDateForGoogle = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.set('text', `Visit ${landmarkName}`);
    googleCalendarUrl.searchParams.set('dates', `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`);
    googleCalendarUrl.searchParams.set('details', description);
    googleCalendarUrl.searchParams.set('location', location);
    
    // Create an Outlook calendar URL
    const outlookCalendarUrl = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
    outlookCalendarUrl.searchParams.set('subject', `Visit ${landmarkName}`);
    outlookCalendarUrl.searchParams.set('startdt', startDate.toISOString());
    outlookCalendarUrl.searchParams.set('enddt', endDate.toISOString());
    outlookCalendarUrl.searchParams.set('body', description);
    outlookCalendarUrl.searchParams.set('location', location);
    
    // Create an Apple Calendar URL (using webcal protocol)
    const appleCalendarData = {
      title: `Visit ${landmarkName}`,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      description,
      location
    };

    const result = {
      landmark: landmarkName,
      event: {
        title: `Visit ${landmarkName}`,
        startTime,
        endTime,
        description,
        location,
        coordinates
      },
      calendarUrls: {
        google: googleCalendarUrl.toString(),
        outlook: outlookCalendarUrl.toString(),
        apple: appleCalendarData
      },
      timestamp: new Date().toISOString()
    };

    console.log('Calendar event data created successfully:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in calendar-tool function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        landmark: 'Unknown',
        event: null 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
