import { supabase } from '@/integrations/supabase/client';

export interface TimezoneInfo {
  timeZoneId: string;
  timeZoneName: string;
  rawOffset: number;
  dstOffset: number;
}

/**
 * Get timezone information for given coordinates using Google Time Zone API
 */
export async function getTimezoneInfo(
  coordinates: [number, number],
  timestamp?: number
): Promise<TimezoneInfo> {
  const [lng, lat] = coordinates;
  const timestampParam = timestamp || Math.floor(Date.now() / 1000);

  console.log('🌍 Getting timezone info for coordinates:', { lat, lng, timestamp: timestampParam });

  try {
    const { data, error } = await supabase.functions.invoke('google-timezone', {
      body: {
        location: `${lat},${lng}`,
        timestamp: timestampParam
      }
    });

    if (error) {
      console.error('❌ Timezone API error:', error);
      throw new Error(`Timezone API error: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to get timezone information');
    }

    console.log('✅ Timezone info retrieved:', data.timezone);
    return data.timezone;
  } catch (err) {
    console.error('❌ Failed to get timezone info:', err);
    // Fallback to UTC if timezone detection fails
    return {
      timeZoneId: 'UTC',
      timeZoneName: 'Coordinated Universal Time',
      rawOffset: 0,
      dstOffset: 0
    };
  }
}

/**
 * Convert local time input to destination timezone and format for API
 */
export async function convertToDestinationTime(
  timeInput: string, // HH:MM format
  destinationCoordinates: [number, number],
  date?: Date
): Promise<string> {
  const targetDate = date || new Date();
  
  // Get timezone info for destination
  const timezoneInfo = await getTimezoneInfo(
    destinationCoordinates,
    Math.floor(targetDate.getTime() / 1000)
  );

  console.log('🕐 Converting time to destination timezone:', {
    timeInput,
    destinationCoordinates,
    targetTimezone: timezoneInfo.timeZoneId
  });

  // Parse the time input
  const [hours, minutes] = timeInput.split(':').map(Number);
  
  // Create a date object for the destination timezone
  // We assume the user wants this time "today" in the destination timezone
  const destinationDate = new Date(targetDate);
  destinationDate.setHours(hours, minutes, 0, 0);
  
  // Calculate the total offset from UTC (raw + DST)
  const totalOffsetSeconds = timezoneInfo.rawOffset + timezoneInfo.dstOffset;
  const totalOffsetMs = totalOffsetSeconds * 1000;
  
  // Adjust for the destination timezone
  const utcTime = destinationDate.getTime() - totalOffsetMs;
  const adjustedDate = new Date(utcTime);
  
  const isoString = adjustedDate.toISOString();
  
  console.log('✅ Time converted:', {
    originalTime: timeInput,
    destinationTimezone: timezoneInfo.timeZoneId,
    finalIsoString: isoString
  });
  
  return isoString;
}

/**
 * Format time for display in destination timezone
 */
export function formatTimeInTimezone(
  isoString: string,
  timezoneInfo: TimezoneInfo
): string {
  const date = new Date(isoString);
  const totalOffsetMs = (timezoneInfo.rawOffset + timezoneInfo.dstOffset) * 1000;
  const localTime = new Date(date.getTime() + totalOffsetMs);
  
  return localTime.toTimeString().slice(0, 5); // HH:MM format
}