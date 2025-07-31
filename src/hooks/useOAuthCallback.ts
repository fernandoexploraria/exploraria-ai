import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseOAuthCallback } from '@/utils/oauthUtils';
import { useToast } from '@/hooks/use-toast';
import { Browser } from '@capacitor/browser';

interface UseOAuthCallbackOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const useOAuthCallback = (options: UseOAuthCallbackOptions = {}) => {
  const { toast } = useToast();

  const processOAuthCallback = useCallback(async (url: string) => {
    console.log('🔗 Processing OAuth callback');
    
    // Close any open browser first
    try {
      await Browser.close();
    } catch (e) {
      console.log('Browser was already closed');
    }
    
    // Parse the OAuth callback URL
    const result = parseOAuthCallback(url);
    
    if (!result.success || !result.tokens) {
      console.error('OAuth callback parsing failed:', result.error);
      toast({
        title: "Authentication Error",
        description: result.error || "Invalid authentication response",
        variant: "destructive"
      });
      options.onError?.(result.error || "Invalid authentication response");
      return;
    }
    
    // Set the session using the extracted tokens
    try {
      console.log('🔗 Setting session from OAuth tokens');
      const { data: { session }, error } = await supabase.auth.setSession({
        access_token: result.tokens.accessToken,
        refresh_token: result.tokens.refreshToken,
      });
      
      if (error) {
        console.error('Error setting session from tokens:', error);
        toast({
          title: "Authentication Error",
          description: "Failed to complete authentication",
          variant: "destructive"
        });
        options.onError?.("Failed to complete authentication");
      } else if (session) {
        console.log('✅ OAuth authentication successful:', session.user?.email);
        toast({
          title: "Success",
          description: "Successfully signed in!",
        });
        options.onSuccess?.();
      }
    } catch (authError) {
      console.error('Error processing OAuth callback:', authError);
      toast({
        title: "Authentication Error",
        description: "Failed to process authentication",
        variant: "destructive"
      });
      options.onError?.("Failed to process authentication");
    }
  }, [toast, options]);

  return { processOAuthCallback };
};