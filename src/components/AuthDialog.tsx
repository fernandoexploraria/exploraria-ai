
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from './AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { setPostAuthAction, PostAuthAction } from '@/utils/authActions';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postAuthAction?: PostAuthAction;
}

const AuthDialog: React.FC<AuthDialogProps> = ({ 
  open, 
  onOpenChange, 
  postAuthAction = 'none' 
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Set the post-auth action before attempting authentication
    if (postAuthAction !== 'none') {
      setPostAuthAction(postAuthAction);
    }

    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        toast({
          title: "Authentication Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        if (isSignUp) {
          toast({
            title: "Check your email",
            description: "We've sent you a confirmation email. Please check your inbox and click the link to activate your account.",
          });
          setEmail('');
          setPassword('');
        } else {
          toast({
            title: "Success",
            description: "Signed in successfully!",
          });
          onOpenChange(false);
          setEmail('');
          setPassword('');
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    
    // Set the post-auth action before initiating OAuth
    if (postAuthAction !== 'none') {
      setPostAuthAction(postAuthAction);
    }
    
    // Check if we're in a Capacitor app
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    
    // Use app scheme for Capacitor, web URL for browser
    const redirectTo = isCapacitor 
      ? 'app.lovable.exploraria://auth-callback'
      : window.location.origin;
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo
        }
      });

      if (error) {
        toast({
          title: "Google Sign In Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        // OAuth will redirect, so we close the dialog
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign in with Google.",
        variant: "destructive"
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    
    // Set the post-auth action before initiating OAuth
    if (postAuthAction !== 'none') {
      setPostAuthAction(postAuthAction);
    }
    
    // Check if we're in a Capacitor app
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    
    // Use app scheme for Capacitor, web URL for browser
    const redirectTo = isCapacitor 
      ? 'app.lovable.exploraria://auth-callback'
      : window.location.origin;
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo
        }
      });

      if (error) {
        toast({
          title: "Apple Sign In Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        // OAuth will redirect, so we close the dialog
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign in with Apple.",
        variant: "destructive"
      });
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[99999]" style={{ zIndex: 99999 }}>
        <DialogHeader>
          <DialogTitle>{isSignUp ? 'Sign Up' : 'Sign In'}</DialogTitle>
          <DialogDescription>
            {isSignUp 
              ? 'Create an account to save your tours, conversations, and access premium features.'
              : 'Sign in to access your saved tours, conversation history, and premium features.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full bg-black text-white hover:bg-gray-800 border-black"
            onClick={handleAppleSignIn}
            disabled={appleLoading}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            {appleLoading ? 'Signing in...' : 'Continue with Apple'}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
