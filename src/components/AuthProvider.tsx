
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Demo credentials for automatic login
  const DEMO_EMAIL = 'demo@tourguide.com';
  const DEMO_PASSWORD = 'demo123456';

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session first
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('Existing session found:', session.user.email);
          setSession(session);
          setUser(session.user);
          setLoading(false);
        } else {
          console.log('No existing session, attempting auto-login...');
          // Try to sign in with demo credentials
          const { data, error } = await supabase.auth.signInWithPassword({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
          });

          if (error) {
            console.log('Demo user does not exist, creating one...');
            // If demo user doesn't exist, create it
            const { error: signUpError } = await supabase.auth.signUp({
              email: DEMO_EMAIL,
              password: DEMO_PASSWORD,
              options: {
                emailRedirectTo: `${window.location.origin}/`
              }
            });

            if (signUpError) {
              console.error('Failed to create demo user:', signUpError);
            } else {
              console.log('Demo user created successfully');
              // Try to sign in again
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: DEMO_EMAIL,
                password: DEMO_PASSWORD,
              });
              
              if (!signInError && signInData.session) {
                setSession(signInData.session);
                setUser(signInData.session.user);
              }
            }
          } else if (data.session) {
            console.log('Auto-login successful:', data.user.email);
            setSession(data.session);
            setUser(data.user);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    signIn,
    signUp,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
