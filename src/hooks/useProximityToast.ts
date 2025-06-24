
import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { Landmark } from '@/data/landmarks';

export const useProximityToast = (
  userLocation: UserLocation | null,
  landmarks: Landmark[],
  maxDistance?: number
) => {
  const { toast } = useToast();
  const sortedLandmarks = useSortedLandmarks(userLocation, landmarks, maxDistance);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousClosestId = useRef<string | null>(null);

  // Create notification sound
  useEffect(() => {
    // Create a simple notification sound using Web Audio API
    const createNotificationSound = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playNotificationSound = () => {
        // Create a pleasant notification sound (two-tone chime)
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Connect oscillators to gain node and then to destination
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Set frequencies for a pleasant chime (C and E notes)
        oscillator1.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
        
        // Set volume envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        // Start and stop oscillators
        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.8);
        oscillator2.stop(audioContext.currentTime + 0.8);
      };
      
      return playNotificationSound;
    };

    try {
      const playSound = createNotificationSound();
      audioRef.current = { play: playSound } as any;
    } catch (error) {
      console.log('Web Audio API not supported, notifications will be silent');
    }
  }, []);

  // Show toast with sound when closest landmark changes
  useEffect(() => {
    if (userLocation && sortedLandmarks.length > 0) {
      const closestLandmark = sortedLandmarks[0];
      
      // Only show toast if the closest landmark ID is different from the previous one
      if (closestLandmark.landmark.id !== previousClosestId.current) {
        // Play notification sound
        if (audioRef.current?.play) {
          try {
            audioRef.current.play();
          } catch (error) {
            console.log('Could not play notification sound:', error);
          }
        }
        
        // Show toast with proximity icon
        toast({
          title: "📍 Closest Landmark",
          description: `${closestLandmark.landmark.name} - ${(closestLandmark.distance * 1000).toFixed(0)}m away`,
          duration: 4000,
        });
        
        console.log('🔔 Proximity toast shown with sound for:', closestLandmark.landmark.name);
        
        // Update the stored ID to the current closest landmark
        previousClosestId.current = closestLandmark.landmark.id;
      }
    }
  }, [userLocation, sortedLandmarks, toast]);

  return sortedLandmarks;
};
