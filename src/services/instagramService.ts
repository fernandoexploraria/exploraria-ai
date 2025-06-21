
const INSTAGRAM_CLIENT_ID = 'your_instagram_client_id'; // This will be set from Supabase secrets
const REDIRECT_URI = `${window.location.origin}/auth/instagram/callback`;

export interface InstagramPost {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  permalink: string;
  caption?: string;
  timestamp: string;
  location?: {
    name: string;
    latitude: number;
    longitude: number;
  };
}

export interface InstagramUser {
  id: string;
  username: string;
  account_type: string;
  media_count: number;
}

export class InstagramService {
  static getAuthUrl(): string {
    const scopes = 'user_profile,user_media';
    const params = new URLSearchParams({
      client_id: INSTAGRAM_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: scopes,
      response_type: 'code'
    });
    
    return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  }

  static async exchangeCodeForToken(code: string): Promise<string> {
    const response = await fetch(`https://ejqgdmbuabrcjxbhpxup.supabase.co/functions/v1/instagram-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    return data.access_token;
  }

  static async getUserProfile(accessToken: string): Promise<InstagramUser> {
    const response = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    return response.json();
  }

  static async getUserMedia(accessToken: string): Promise<InstagramPost[]> {
    const response = await fetch(
      `https://graph.instagram.com/me/media?fields=id,media_type,media_url,permalink,caption,timestamp&access_token=${accessToken}&limit=50`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch user media');
    }

    const data = await response.json();
    return data.data || [];
  }

  static async getMediaLocation(mediaId: string, accessToken: string): Promise<any> {
    // Note: Location data requires Instagram Graph API and business account
    // This is a placeholder for the structure
    try {
      const response = await fetch(
        `https://graph.instagram.com/${mediaId}?fields=location&access_token=${accessToken}`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.location;
      }
    } catch (error) {
      console.log('Location data not available for this post');
    }
    return null;
  }
}
