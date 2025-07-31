import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

export const useDeepLinkHandler = () => {
  useEffect(() => {
    // Only run in Capacitor environment
    if (!(window as any).Capacitor?.isNativePlatform?.()) {
      return;
    }

    const handleAppUrlOpen = async (data: any) => {
      console.log('Deep link received:', data.url);
      
      // Check if this is an auth callback
      if (data.url.startsWith('app.lovable.exploraria://auth-callback')) {
        try {
          const url = new URL(data.url);
          
          // Extract tokens from URL fragment (Supabase puts tokens in hash)
          const fragment = url.hash.substring(1); // Remove the # character
          const params = new URLSearchParams(fragment);
          
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const tokenType = params.get('token_type');
          const expiresIn = params.get('expires_in');
          
          console.log('Auth callback tokens:', { accessToken: !!accessToken, refreshToken: !!refreshToken });
          
          if (accessToken && refreshToken) {
            // Set the session with the extracted tokens
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('Error setting auth session:', error);
            } else {
              console.log('Auth session set successfully:', data.session?.user?.email);
              
              // Navigate to main app (you might want to customize this route)
              if (typeof window !== 'undefined') {
                window.location.replace('/');
              }
            }
          } else {
            console.warn('No auth tokens found in deep link fragment');
          }
        } catch (error) {
          console.error('Error handling deep link:', error);
        }
      }
    };

    // Add the listener for app URL open events
    App.addListener('appUrlOpen', handleAppUrlOpen);

    // Cleanup
    return () => {
      App.removeAllListeners();
    };
  }, []);
};