
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { PostAuthAction, getPostAuthAction, clearPostAuthAction, getPostAuthLandmark, clearPostAuthLandmark } from '@/utils/authActions';
import { toast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  email: string;
  role: 'tourist' | 'travel_expert';
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  stripe_account_id?: string;
  stripe_account_status?: string;
  stripe_payouts_enabled?: boolean;
  stripe_charges_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  signUp: (email: string, password: string, termsAccepted?: boolean) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
  upgradeToTravelExpert: () => Promise<{ error: any }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
  onPostAuthAction?: (action: PostAuthAction) => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, onPostAuthAction }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Track browser sessions using localStorage + sessionStorage
  const trackUserSession = async (userId: string) => {
    try {
      console.log('🔄 Tracking user session for:', userId);
      
      // Check if this is a new browser session
      const currentSessionId = sessionStorage.getItem('current_session_id');
      const storedSessionId = localStorage.getItem('last_session_id');
      
      console.log('📊 Session IDs:', { currentSessionId, storedSessionId });
      
      if (!currentSessionId || currentSessionId !== storedSessionId) {
        // This is a new browser session
        const newSessionId = `session_${Date.now()}`;
        sessionStorage.setItem('current_session_id', newSessionId);
        localStorage.setItem('last_session_id', newSessionId);
        
        console.log('✨ New browser session detected, updating database');
        
        // Get current profile data
        const { data: currentProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('session_count, first_login_at')
          .eq('id', userId)
          .single();

        if (fetchError) {
          console.error('Error fetching profile for session tracking:', fetchError);
          return;
        }

        // Update session count and first_login_at if needed
        const { error } = await supabase
          .from('profiles')
          .update({
            session_count: (currentProfile?.session_count || 0) + 1,
            first_login_at: currentProfile?.first_login_at || new Date().toISOString()
          })
          .eq('id', userId);

        if (error) {
          console.error('Error updating session count:', error);
        } else {
          console.log('✅ Session count updated to:', (currentProfile?.session_count || 0) + 1);
        }
      } else {
        console.log('🔄 Same browser session, no database update needed');
      }
    } catch (error) {
      console.error('Error in session tracking:', error);
    }
  };

  // Fetch user profile when user changes
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile and track session when user signs in
        if (session?.user) {
          fetchProfile(session.user.id);
          
          // Track session only for authenticated users
          // Use setTimeout to avoid blocking the auth state change
          setTimeout(() => {
            trackUserSession(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
        
        // Handle post-auth actions for successful sign-ins
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('Sign in detected, checking for pending actions');
          const pendingAction = getPostAuthAction();
          
          if (pendingAction !== 'none') {
            console.log('Executing pending post-auth action:', pendingAction);
            clearPostAuthAction();
            
            // If it's a smart-tour action, check if it's an experience-based tour or simple Smart Tour
            if (pendingAction === 'smart-tour') {
              const pendingLandmark = getPostAuthLandmark();
              if (pendingLandmark && pendingLandmark.tourId) {
                console.log('🎯 Restoring landmark for post-auth experience tour:', pendingLandmark.name);
                
                // This is an experience-based tour, check if already paid
                setTimeout(async () => {
                  try {
                    // Check if user has already paid for this experience
                    const { data: existingPayment, error: paymentError } = await supabase
                      .from('payments')
                      .select('id')
                      .eq('tour_id', pendingLandmark.tourId)
                      .eq('tourist_user_id', session.user.id)
                      .eq('status', 'succeeded')
                      .maybeSingle();
                    
                    if (paymentError) {
                      console.error('Error checking existing payment:', paymentError);
                      return;
                    }
                    
                    if (existingPayment) {
                      console.log('✅ User has already paid for this experience, starting tour directly');
                      
                      // User has already paid, go directly to tour generation
                      (window as any).pendingLandmarkDestination = pendingLandmark;
                      clearPostAuthLandmark();
                      
                      // Close drawer before triggering intelligent tour
                      setTimeout(() => {
                        if (onPostAuthAction) {
                          onPostAuthAction('intelligent-tour');
                        }
                      }, 100);
                      return;
                    }
                    
                    // User hasn't paid yet, create payment intent
                    const { data, error } = await supabase.functions.invoke('create-experience-payment', {
                      body: { 
                        experienceId: pendingLandmark.tourId,
                        price: 999 // $9.99 in cents
                      }
                    });

                    if (error) {
                      console.error('Post-auth payment creation failed:', error);
                      return;
                    }

                    if (data?.client_secret) {
                      console.log('✅ Post-auth payment created successfully');
                      
                      // Store the client secret and experience for payment dialog
                      (window as any).pendingExperiencePayment = {
                        clientSecret: data.client_secret,
                        experience: {
                          id: pendingLandmark.tourId,
                          destination: pendingLandmark.name,
                          destination_details: pendingLandmark
                        }
                      };
                      
                      clearPostAuthLandmark();
                      
                      // Trigger the payment dialog instead of direct tour generation
                      if (onPostAuthAction) {
                        onPostAuthAction(pendingAction);
                      }
                    }
                  } catch (error) {
                    console.error('Post-auth payment error:', error);
                  }
                }, 1000);
                return;
              } else {
                // This is a simple Smart Tour (subscription-based), no payment needed
                console.log('🎯 Simple Smart Tour post-auth, no payment required');
                setTimeout(() => {
                  if (onPostAuthAction) {
                    onPostAuthAction(pendingAction);
                  }
                }, 500);
                return;
              }
            }
            
            // Handle intelligent-tour action for Top 100 landmarks
            if (pendingAction === 'intelligent-tour') {
              const pendingLandmark = getPostAuthLandmark();
              if (pendingLandmark) {
                console.log('🎯 Restoring Top 100 landmark for Intelligent Tour:', pendingLandmark.name);
                // Set the landmark context for the Intelligent Tour dialog
                (window as any).pendingLandmarkDestination = pendingLandmark;
                clearPostAuthLandmark();
                
                setTimeout(() => {
                  if (onPostAuthAction) {
                    onPostAuthAction(pendingAction);
                  }
                }, 500);
                return;
              }
            }
            
            // Handle navigate-main action
            if (pendingAction === 'navigate-main') {
              const pendingLandmark = getPostAuthLandmark();
              console.log('🎯 Navigating to main page after auth');
              
              if (pendingLandmark) {
                console.log('🎯 Showing synthetic landmark on main page:', pendingLandmark.name);
                clearPostAuthLandmark();
                
                setTimeout(() => {
                  // Show the synthetic landmark again after navigation
                  toast({
                    title: "Post-Auth: Synthetic City Landmark Retrieved",
                    description: `${pendingLandmark.name}: ${JSON.stringify(pendingLandmark, null, 2)}`,
                    duration: 8000,
                  });
                }, 1000); // Wait 1 second after navigation
              }
              
              setTimeout(() => {
                window.location.href = '/';
              }, 500);
              return;
            }
            
            // For other actions or if no payment needed, proceed normally
            setTimeout(() => {
              if (onPostAuthAction) {
                onPostAuthAction(pendingAction);
              }
            }, 500);
          }
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Fetch profile for existing session
      if (session?.user) {
        fetchProfile(session.user.id);
        // Track session for existing authenticated users
        setTimeout(() => {
          trackUserSession(session.user.id);
        }, 0);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [onPostAuthAction]);

  const signUp = async (email: string, password: string, termsAccepted?: boolean) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          terms_accepted: termsAccepted || false,
          terms_accepted_at: termsAccepted ? new Date().toISOString() : null
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: 'No user logged in' };
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        return { error };
      }

      setProfile(data);
      return { error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { error };
    }
  };

  const upgradeToTravelExpert = async () => {
    if (!user) return { error: 'No user logged in' };
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'travel_expert' })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error upgrading to travel expert:', error);
        return { error };
      }

      setProfile(data);
      return { error: null };
    } catch (error) {
      console.error('Error upgrading to travel expert:', error);
      return { error };
    }
  };

  const value = {
    user,
    session,
    profile,
    signUp,
    signIn,
    signOut,
    updateProfile,
    upgradeToTravelExpert,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
