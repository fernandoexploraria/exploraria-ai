
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { PostAuthAction, getPostAuthAction, clearPostAuthAction, getPostAuthLandmark, clearPostAuthLandmark } from '@/utils/authActions';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle post-auth actions for successful sign-ins
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('Sign in detected, checking for pending actions');
          const pendingAction = getPostAuthAction();
          
          if (pendingAction !== 'none') {
            console.log('Executing pending post-auth action:', pendingAction);
            clearPostAuthAction();
            
            // If it's a smart-tour action, also handle landmark restoration
            if (pendingAction === 'smart-tour') {
              const pendingLandmark = getPostAuthLandmark();
              if (pendingLandmark) {
                console.log('🎯 Restoring landmark for post-auth tour:', pendingLandmark.name);
                // Store the landmark for the dialog to use
                (window as any).pendingLandmarkDestination = pendingLandmark;
                clearPostAuthLandmark();
              }
            }
            
            // Delay execution to ensure UI is ready
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
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [onPostAuthAction]);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
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
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    signOut,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
