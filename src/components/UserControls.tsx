
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Star, HelpCircle, BookOpen, Apple } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import { ProfileBackfillUtility } from '@/components/ProfileBackfillUtility';
import { TravelExpertUpgrade } from '@/components/TravelExpertUpgrade';
import { AppleOAuthJWTDialog } from '@/components/AppleOAuthJWTDialog';
import { useDemoMode } from '@/hooks/useDemoMode';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboardingControl } from '@/hooks/useOnboardingControl';

interface UserControlsProps {
  user: SupabaseUser | null;
  onSignOut: () => Promise<void>;
  onAuthDialogOpen: () => void;
  onShowOnboarding?: () => void;
}

const UserControls: React.FC<UserControlsProps> = ({ user, onSignOut, onAuthDialogOpen, onShowOnboarding }) => {
  const { profile } = useAuth();
  const { isDemoMode } = useDemoMode();
  const isMobile = useIsMobile();
  const { completeOnboarding } = useOnboardingControl();
  const [isAppleJWTDialogOpen, setIsAppleJWTDialogOpen] = useState(false);
  
  // Check if user has access to Apple OAuth JWT functionality
  const hasAppleOAuthAccess = user?.email === 'fobregona@yahoo.com';
  
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

  return (
    <>
      <div className="absolute top-4 right-[45px] z-20 flex items-start gap-2 safe-area-top safe-area-right">
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
              <Link to="/curator-portal">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-primary/10 backdrop-blur-sm shadow-lg border border-primary/20 text-primary hover:bg-primary/20 hover:text-primary h-10"
                >
                  <Star className="w-4 h-4 mr-2" />
                  Travel Expert
                </Button>
              </Link>
            ) : (
              <TravelExpertUpgrade displayMode="badge" />
            )}
            
            {/* User Profile */}
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-md px-3 py-2 shadow-lg border border-input h-10">
              <Avatar className="w-6 h-6">
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
      
      {/* Profile Backfill Utility - only when demo mode is off */}
      {user && !isDemoMode && (
        <div className="absolute right-[45px] z-20 safe-area-top safe-area-right" style={{ top: 'calc(4rem + 60px)' }}>
          <ProfileBackfillUtility />
        </div>
      )}

      {/* Apple OAuth JWT Dialog */}
      <AppleOAuthJWTDialog 
        open={isAppleJWTDialogOpen} 
        onOpenChange={setIsAppleJWTDialogOpen} 
      />
    </>
  );
};

export default UserControls;
