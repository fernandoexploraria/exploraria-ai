
import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, LogOut, Star, HelpCircle, BookOpen, Apple, Monitor, Smartphone, Copy } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '@/components/AuthProvider';
import { Link, useNavigate } from 'react-router-dom';
import { ProfileBackfillUtility } from '@/components/ProfileBackfillUtility';
import { TravelExpertUpgrade } from '@/components/TravelExpertUpgrade';
import { AppleOAuthJWTDialog } from '@/components/AppleOAuthJWTDialog';
import { useDemoMode } from '@/hooks/useDemoMode';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboardingControl } from '@/hooks/useOnboardingControl';
import { useToast } from '@/hooks/use-toast';

interface UserControlsProps {
  user: SupabaseUser | null;
  onSignOut: () => Promise<void>;
  onAuthDialogOpen: () => void;
  onShowOnboarding?: () => void;
}

const UserControls: React.FC<UserControlsProps> = ({ user, onSignOut, onAuthDialogOpen, onShowOnboarding }) => {
  const { profile } = useAuth();
  const { isDemoMode } = useDemoMode();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { completeOnboarding } = useOnboardingControl();
  const [isAppleJWTDialogOpen, setIsAppleJWTDialogOpen] = useState(false);
  const [isTravelExpertMobileDialogOpen, setIsTravelExpertMobileDialogOpen] = useState(false);
  const navigate = useNavigate();
  
  // Detect if running in native app
  const isNativeApp = Capacitor.isNativePlatform();
  const shouldShowMobileDialog = isMobile || isNativeApp;
  const desktopUrl = 'https://lovable.exploraria.ai/curator-portal';
  
  // Check if user has access to Apple OAuth JWT functionality
  const hasAppleOAuthAccess = isDemoMode;
  
  // Copy URL to clipboard handler
  const copyUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(desktopUrl);
      toast({
        title: "URL Copied!",
        description: "The curator portal link has been copied to your clipboard."
      });
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast({
        title: "Copy Failed",
        description: "Please manually copy the URL above.",
        variant: "destructive"
      });
    }
  };

  // Travel Expert button click handler
  const handleTravelExpertClick = () => {
    if (shouldShowMobileDialog) {
      setIsTravelExpertMobileDialogOpen(true);
    } else {
      navigate('/curator-portal');
    }
  };

  const handleSignOut = async () => {
    console.log('Sign out button clicked');
    try {
      await onSignOut();
      console.log('Sign out completed successfully');
      // Force page reload to clear any remaining state
      window.location.reload();
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, try to reload the page to clear state
      window.location.reload();
    }
  };

  const handleShowTutorial = () => {
    // Use the new manual onboarding trigger if available, otherwise fallback to reload
    if (onShowOnboarding) {
      onShowOnboarding();
    } else {
      // Fallback to the old method
      localStorage.removeItem('onboarding-completed');
      window.location.reload();
    }
  };

  // Apply safe area padding only in native app
  const containerClasses = isNativeApp
    ? "absolute top-[10px] right-[45px] z-20 flex items-start gap-2 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)]"
    : "absolute top-[10px] right-[45px] z-20 flex items-start gap-2";

  return (
    <>
      <div className={containerClasses}>
        {/* Help Button - Available for all users */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleShowTutorial}
          className="bg-background/80 backdrop-blur-sm shadow-lg border border-input text-foreground hover:bg-accent hover:text-accent-foreground h-10 w-10 p-0"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>

        {user ? (
          <div className="flex items-center gap-2">
            {/* Apple OAuth JWT Generator - only for specific user */}
            {hasAppleOAuthAccess && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAppleJWTDialogOpen(true)}
                className="bg-background/80 backdrop-blur-sm shadow-lg border border-input text-foreground hover:bg-accent hover:text-accent-foreground h-10"
              >
                <Apple className="w-4 h-4 mr-2" />
                Apple JWT
              </Button>
            )}
            
            {/* Travel Expert Portal Link or Upgrade Badge */}
            {profile?.role === 'travel_expert' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTravelExpertClick}
                className="bg-primary/10 backdrop-blur-sm shadow-lg border border-primary/20 text-primary hover:bg-primary/20 hover:text-primary h-10"
              >
                <Star className="w-4 h-4 mr-2" />
                Travel Expert
              </Button>
            ) : (
              <TravelExpertUpgrade displayMode="badge" />
            )}
            
            {/* User Profile */}
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-md px-3 py-2 shadow-lg border border-input h-10">
              <Avatar className="w-6 h-6 cursor-pointer" onClick={() => navigate('/account')}>
                <AvatarFallback className="text-xs">
                  {(profile?.full_name || user.email)?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isMobile && (
                <span className="text-sm font-medium text-foreground max-w-[100px] truncate">
                  {profile?.full_name || user.email}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground relative z-30 ml-1"
              >
                <LogOut className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={onAuthDialogOpen}
            variant="outline"
            size="default"
            className="bg-background/80 backdrop-blur-sm shadow-lg border border-input text-foreground hover:bg-accent hover:text-accent-foreground h-10"
          >
            <User className="w-4 h-4 mr-2" />
            Sign In
          </Button>
        )}
      </div>
      
      {/* Profile Backfill Utility - only when demo mode is on */}
      {user && isDemoMode && (
        <div className={isNativeApp 
          ? "absolute top-[70px] right-[45px] z-20 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)]"
          : "absolute top-[70px] right-[45px] z-20"
        }>
          <ProfileBackfillUtility />
        </div>
      )}

      {/* Apple OAuth JWT Dialog */}
      <AppleOAuthJWTDialog 
        open={isAppleJWTDialogOpen} 
        onOpenChange={setIsAppleJWTDialogOpen} 
      />

      {/* Travel Expert Mobile Dialog */}
      <Dialog open={isTravelExpertMobileDialogOpen} onOpenChange={setIsTravelExpertMobileDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Continue on Desktop
            </DialogTitle>
            <DialogDescription>
              The Travel Expert portal is optimized for desktop browsers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Monitor className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-amber-800 text-sm">Desktop Required</h4>
                  <p className="text-amber-700 text-xs mt-1">
                    For the best experience with experience management, analytics, and business tools, please access the curator portal from a desktop computer.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Visit on Desktop:</h4>
                <div className="bg-muted rounded-lg p-3 border">
                  <code className="text-sm font-mono break-all">{desktopUrl}</code>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={copyUrlToClipboard}
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL to Clipboard
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Copy this link and paste it in your desktop browser
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 text-sm mb-2">What you can do in the portal:</h4>
              <ul className="text-blue-700 text-xs space-y-1">
                <li>• Create and manage travel experiences</li>
                <li>• View analytics and earnings</li>
                <li>• Manage your Stripe Connected Account</li>
                <li>• Configure expert profile and pricing</li>
                <li>• Handle business operations and taxes</li>
              </ul>
            </div>

            <Button 
              onClick={() => setIsTravelExpertMobileDialogOpen(false)}
              className="w-full"
              variant="outline"
            >
              Got it, I'll continue on desktop
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserControls;
