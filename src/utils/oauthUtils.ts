export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string;
  providerToken?: string;
  providerRefreshToken?: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  tokens?: OAuthTokens;
  error?: string;
}

/**
 * Extracts OAuth tokens from a deep link callback URL
 * Handles URL fragments by converting them to query parameters for parsing
 */
export const parseOAuthCallback = (url: string): OAuthCallbackResult => {
  try {
    // Convert fragment (#) to query params (?) for easier parsing
    const parsedUrl = new URL(url.replace('#', '?'));
    
    const accessToken = parsedUrl.searchParams.get('access_token');
    const refreshToken = parsedUrl.searchParams.get('refresh_token');
    
    if (!accessToken || !refreshToken) {
      return {
        success: false,
        error: 'Missing required OAuth tokens (access_token or refresh_token)'
      };
    }
    
    const tokens: OAuthTokens = {
      accessToken,
      refreshToken,
      expiresAt: parsedUrl.searchParams.get('expires_at') || undefined,
      providerToken: parsedUrl.searchParams.get('provider_token') || undefined,
      providerRefreshToken: parsedUrl.searchParams.get('provider_refresh_token') || undefined,
    };
    
    return {
      success: true,
      tokens
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse OAuth callback URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Checks if a URL is an OAuth callback URL
 */
export const isOAuthCallback = (url: string): boolean => {
  return url.includes('auth-callback') && (url.includes('#access_token=') || url.includes('?access_token='));
};