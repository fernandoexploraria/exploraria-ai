
import { useState, useEffect } from 'react';
import { InstagramService, InstagramPost, InstagramUser } from '@/services/instagramService';
import { toast } from 'sonner';

export const useInstagram = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<InstagramUser | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user has stored Instagram token
    const storedToken = localStorage.getItem('instagram_access_token');
    if (storedToken) {
      setAccessToken(storedToken);
      setIsConnected(true);
      loadUserData(storedToken);
    }
  }, []);

  const connectInstagram = () => {
    const authUrl = InstagramService.getAuthUrl();
    window.location.href = authUrl;
  };

  const handleAuthCallback = async (code: string) => {
    try {
      setIsLoading(true);
      const token = await InstagramService.exchangeCodeForToken(code);
      
      localStorage.setItem('instagram_access_token', token);
      setAccessToken(token);
      setIsConnected(true);
      
      await loadUserData(token);
      toast.success('Instagram connected successfully!');
    } catch (error) {
      console.error('Instagram auth error:', error);
      toast.error('Failed to connect Instagram');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserData = async (token: string) => {
    try {
      const [userProfile, userPosts] = await Promise.all([
        InstagramService.getUserProfile(token),
        InstagramService.getUserMedia(token)
      ]);

      setUser(userProfile);
      setPosts(userPosts);
    } catch (error) {
      console.error('Failed to load Instagram data:', error);
      toast.error('Failed to load Instagram data');
    }
  };

  const disconnect = () => {
    localStorage.removeItem('instagram_access_token');
    setAccessToken(null);
    setIsConnected(false);
    setUser(null);
    setPosts([]);
    toast.success('Instagram disconnected');
  };

  const refreshPosts = async () => {
    if (!accessToken) return;
    
    try {
      setIsLoading(true);
      const userPosts = await InstagramService.getUserMedia(accessToken);
      setPosts(userPosts);
    } catch (error) {
      console.error('Failed to refresh posts:', error);
      toast.error('Failed to refresh posts');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isConnected,
    user,
    posts,
    isLoading,
    connectInstagram,
    handleAuthCallback,
    disconnect,
    refreshPosts
  };
};
