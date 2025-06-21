
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
    // Updated scopes for Instagram Graph API
    const scopes = 'instagram_basic,instagram_content_publish';
    const params = new URLSearchParams({
      client_id: INSTAGRAM_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: scopes,
      response_type: 'code'
    });
    
    // Use Facebook OAuth endpoint for Instagram Graph API
    return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
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
    // First get the Instagram Business Account ID
    const fbUserResponse = await fetch(
      `https://graph.facebook.com/me?fields=id&access_token=${accessToken}`
    );

    if (!fbUserResponse.ok) {
      throw new Error('Failed to fetch Facebook user');
    }

    const fbUser = await fbUserResponse.json();

    // Get Instagram Business Account
    const igAccountResponse = await fetch(
      `https://graph.facebook.com/${fbUser.id}?fields=instagram_business_account&access_token=${accessToken}`
    );

    if (!igAccountResponse.ok) {
      throw new Error('Failed to fetch Instagram business account');
    }

    const igAccountData = await igAccountResponse.json();
    
    if (!igAccountData.instagram_business_account) {
      throw new Error('No Instagram Business Account found. Please convert to a Business or Creator account.');
    }

    const igAccountId = igAccountData.instagram_business_account.id;

    // Get Instagram account details
    const response = await fetch(
      `https://graph.facebook.com/${igAccountId}?fields=id,username,account_type,media_count&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Instagram profile');
    }

    return response.json();
  }

  static async getUserMedia(accessToken: string): Promise<InstagramPost[]> {
    // First get the Instagram Business Account ID
    const fbUserResponse = await fetch(
      `https://graph.facebook.com/me?fields=id&access_token=${accessToken}`
    );

    if (!fbUserResponse.ok) {
      throw new Error('Failed to fetch Facebook user');
    }

    const fbUser = await fbUserResponse.json();

    // Get Instagram Business Account
    const igAccountResponse = await fetch(
      `https://graph.facebook.com/${fbUser.id}?fields=instagram_business_account&access_token=${accessToken}`
    );

    if (!igAccountResponse.ok) {
      throw new Error('Failed to fetch Instagram business account');
    }

    const igAccountData = await igAccountResponse.json();
    
    if (!igAccountData.instagram_business_account) {
      throw new Error('No Instagram Business Account found');
    }

    const igAccountId = igAccountData.instagram_business_account.id;

    // Get media
    const response = await fetch(
      `https://graph.facebook.com/${igAccountId}/media?fields=id,media_type,media_url,permalink,caption,timestamp&access_token=${accessToken}&limit=50`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch user media');
    }

    const data = await response.json();
    return data.data || [];
  }

  static async getMediaLocation(mediaId: string, accessToken: string): Promise<any> {
    // Location data is available for Instagram Graph API
    try {
      const response = await fetch(
        `https://graph.facebook.com/${mediaId}?fields=location&access_token=${accessToken}`
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
