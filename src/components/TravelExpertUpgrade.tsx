import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Star, MapPin, DollarSign, Users, ArrowRight, Check, X, HelpCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TravelExpertUpgradeProps {
  onUpgradeComplete?: () => void;
  displayMode?: 'full' | 'badge';
}

export const TravelExpertUpgrade: React.FC<TravelExpertUpgradeProps> = ({
  onUpgradeComplete,
  displayMode = 'full'
}) => {
  const {
    user,
    profile,
    upgradeToTravelExpert,
    updateProfile
  } = useAuth();
  const {
    toast
  } = useToast();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHelpPopoverOpen, setIsHelpPopoverOpen] = useState(false);
  const [shouldShowFullCard, setShouldShowFullCard] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(true);
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    bio: profile?.bio || ''
  });

  // Determine card visibility based on user profile data
  useEffect(() => {
    if (!user || !profile) return;
    const checkCardVisibility = async () => {
      try {
        // Get current profile data with session tracking fields
        const {
          data: currentProfile,
          error: fetchError
        } = await supabase.from('profiles').select('session_count, first_login_at, upgrade_card_dismissed_at').eq('id', user.id).single();
        if (fetchError) {
          console.error('Error fetching profile for card visibility:', fetchError);
          return;
        }

        // Determine if we should show full card
        const daysSinceSignup = currentProfile?.first_login_at ? (Date.now() - new Date(currentProfile.first_login_at).getTime()) / (1000 * 60 * 60 * 24) : 0;
        const sessionCount = currentProfile?.session_count || 0;
        const wasDismissed = currentProfile?.upgrade_card_dismissed_at;
        console.log('📊 Card visibility check:', {
          daysSinceSignup,
          sessionCount,
          wasDismissed: !!wasDismissed
        });

        // Show full card if: within first 7 days OR first 3 sessions AND not dismissed
        const shouldShow = !wasDismissed && (daysSinceSignup <= 7 || sessionCount <= 3);
        setShouldShowFullCard(shouldShow);
      } catch (error) {
        console.error('Error checking card visibility:', error);
        // Fallback to localStorage for session tracking
        const localSessions = parseInt(localStorage.getItem('travelExpertSessions') || '0');
        const dismissed = localStorage.getItem('travelExpertDismissed');
        setShouldShowFullCard(!dismissed && localSessions <= 3);
      }
    };
    checkCardVisibility();
  }, [user, profile]);

  // Add click-outside detection with fixed condition
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        console.log('🎯 Travel Expert Card: Click detected outside card, dismissing');
        handleDismiss();
      }
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('🎯 Travel Expert Card: Escape key pressed, dismissing');
        handleDismiss();
      }
    };

    // Only add listeners when full card is visible AND dialog is NOT open
    if (shouldShowFullCard && isCardVisible && !isDialogOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [shouldShowFullCard, isCardVisible, isDialogOpen]);

  const handleDismiss = async (event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    console.log('🎯 Travel Expert Card: Dismissing card');
    if (!user) return;

    // Animate out first
    setIsCardVisible(false);

    // Wait for animation to complete before updating database
    setTimeout(async () => {
      try {
        const {
          error
        } = await supabase.from('profiles').update({
          upgrade_card_dismissed_at: new Date().toISOString()
        }).eq('id', user.id);
        if (error) {
          console.error('Error dismissing card:', error);
          // Fallback to localStorage
          localStorage.setItem('travelExpertDismissed', 'true');
        }
        setShouldShowFullCard(false);
      } catch (error) {
        console.error('Error dismissing card:', error);
        localStorage.setItem('travelExpertDismissed', 'true');
        setShouldShowFullCard(false);
      }
    }, 300); // Match animation duration
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setIsUpgrading(true);
    try {
      // Update profile information first
      if (formData.full_name || formData.bio) {
        const {
          error: profileError
        } = await updateProfile({
          full_name: formData.full_name,
          bio: formData.bio
        });
        if (profileError) {
          throw profileError;
        }
      }

      // Upgrade role to travel_expert
      const {
        error: upgradeError
      } = await upgradeToTravelExpert();
      if (upgradeError) {
        throw upgradeError;
      }

      // Set redirecting state and show appropriate UI
      setIsRedirectingToStripe(true);

      // Initialize Stripe Connect onboarding
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke('create-onboarding-link', {
          body: {}
        });
        if (error) {
          console.error('Error creating onboarding link:', error);
          // Fallback: Complete upgrade without Stripe
          toast({
            title: "Upgraded to Travel Expert!",
            description: "You can set up payments later from the curator portal."
          });
          setIsDialogOpen(false);
          onUpgradeComplete?.();
        } else if (data?.url) {
          // Store current state to resume after Stripe redirect
          sessionStorage.setItem('stripe_onboarding_in_progress', 'true');
          sessionStorage.setItem('upgrade_dialog_was_open', 'true');

          // Show user they're being redirected
          toast({
            title: "Redirecting to Stripe...",
            description: "Complete your setup to start earning from experiences."
          });

          // Redirect in same tab after a brief delay for UX
          setTimeout(() => {
            window.location.href = data.url;
          }, 1500);
        } else {
          // Fallback: Complete upgrade without Stripe
          toast({
            title: "Upgraded to Travel Expert!",
            description: "You can set up payments later from the curator portal."
          });
          setIsDialogOpen(false);
          onUpgradeComplete?.();
        }
      } catch (stripeError) {
        console.error('Stripe onboarding error:', stripeError);
        // Fallback: Complete upgrade without Stripe
        toast({
          title: "Upgraded to Travel Expert!",
          description: "You can set up payments later from the curator portal."
        });
        setIsDialogOpen(false);
        onUpgradeComplete?.();
      }
    } catch (error) {
      console.error('Error upgrading to travel expert:', error);
      toast({
        title: "Upgrade Failed",
        description: "There was an error upgrading your account. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUpgrading(false);
      setIsRedirectingToStripe(false);
    }
  };

  const handleHelpClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsHelpPopoverOpen(!isHelpPopoverOpen);
  };

  if (profile?.role === 'travel_expert') {
    return null; // Don't show anything for travel experts
  }

  // Determine which display mode to use
  const actualDisplayMode = displayMode === 'full' ? 'full' : displayMode === 'badge' ? 'badge' : shouldShowFullCard ? 'full' : 'badge';

  // Don't render if card was dismissed with animation
  if (!shouldShowFullCard && actualDisplayMode === 'full') {
    return null;
  }

  return (
    <>
      {/* Single consolidated dialog for both modes */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Become a Travel Expert</DialogTitle>
            <DialogDescription>
              Help us personalize your experience as a Travel Expert
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input 
                id="full_name" 
                placeholder="Your full name" 
                value={formData.full_name} 
                onChange={e => setFormData(prev => ({
                  ...prev,
                  full_name: e.target.value
                }))} 
                disabled={isUpgrading} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio (Optional)</Label>
              <Textarea 
                id="bio" 
                placeholder="Tell us about your travel expertise and local knowledge..." 
                value={formData.bio} 
                onChange={e => setFormData(prev => ({
                  ...prev,
                  bio: e.target.value
                }))} 
                rows={3} 
                disabled={isUpgrading} 
              />
            </div>
            
            {isRedirectingToStripe && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-sm font-medium">Redirecting to Stripe...</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  You'll be redirected to complete your payout setup. This may take a moment.
                </p>
              </div>
            )}
            
            <Button 
              onClick={handleUpgrade} 
              disabled={isUpgrading || !formData.full_name} 
              className="w-full"
            >
              {isRedirectingToStripe ? (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Redirecting...
                </>
              ) : isUpgrading ? "Setting up..." : "Setup Stripe Connected Account"}
            </Button>
          </div>
        </DialogContent>

        {/* Badge mode - compact display with embedded help */}
        {actualDisplayMode === 'badge' && (
          <div className="relative">
            <Popover open={isHelpPopoverOpen} onOpenChange={setIsHelpPopoverOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-gradient-to-r from-primary/10 to-secondary/10 backdrop-blur-sm border-primary/20 text-primary hover:from-primary/20 hover:to-secondary/20 relative pr-8"
                >
                  Travel Expert
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground z-10" 
                      onClick={handleHelpClick}
                    >
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                </Button>
              </DialogTrigger>
              
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      Travel Expert Benefits
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Share your local knowledge and create AI-powered guided experiences
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-primary/20 rounded-full mt-0.5">
                        <MapPin className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <h5 className="font-medium text-xs">Create Experiences</h5>
                        <p className="text-xs text-muted-foreground">
                          Build AI-powered tours of your favorite places
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-primary/20 rounded-full mt-0.5">
                        <DollarSign className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <h5 className="font-medium text-xs">Earn Revenue</h5>
                        <p className="text-xs text-muted-foreground">
                          Monetize your expertise with every experience
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-primary/20 rounded-full mt-0.5">
                        <Users className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <h5 className="font-medium text-xs">Build Community</h5>
                        <p className="text-xs text-muted-foreground">
                          Connect with travelers and share your passion
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-primary/20 rounded-full mt-0.5">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <h5 className="font-medium text-xs">Full Access</h5>
                        <p className="text-xs text-muted-foreground">
                          Access all tourist features plus curator tools
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setIsHelpPopoverOpen(false);
                      setIsDialogOpen(true);
                    }} 
                    className="w-full" 
                    size="sm"
                  >
                    <Star className="mr-2 h-3 w-3" />
                    Enroll Now
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Full card mode - prominent display with enhanced UX */}
        {actualDisplayMode === 'full' && (
          <div ref={cardRef} className={`transform transition-all duration-300 ease-in-out ${isCardVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-95'}`}>
            <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/10 relative shadow-lg hover:shadow-xl transition-shadow duration-200">
              {/* Enhanced dismiss button with better visibility */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute top-3 right-3 h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive z-20 rounded-full bg-background/80 backdrop-blur-sm shadow-sm border border-border/50" 
                onClick={handleDismiss} 
                aria-label="Close travel expert upgrade card"
              >
                <X className="h-5 w-5" />
              </Button>
              
              <CardHeader className="pr-12">
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Become a Travel Expert
                </CardTitle>
                <CardDescription>
                  Share your local knowledge and create AI-powered guided experiences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Benefits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-primary/20 rounded-full mt-1">
                      <MapPin className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Create Experiences</h4>
                      <p className="text-xs text-muted-foreground">
                        Build AI-powered tours of your favorite places
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-primary/20 rounded-full mt-1">
                      <DollarSign className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Earn Revenue</h4>
                      <p className="text-xs text-muted-foreground">
                        Monetize your expertise with every experience
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-primary/20 rounded-full mt-1">
                      <Users className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Build Community</h4>
                      <p className="text-xs text-muted-foreground">
                        Connect with travelers and share your passion
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-primary/20 rounded-full mt-1">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Full Access</h4>
                      <p className="text-xs text-muted-foreground">
                        Access all tourist features plus curator tools
                      </p>
                    </div>
                  </div>
                </div>

                <DialogTrigger asChild>
                  <Button className="w-full" size="lg">
                    <Star className="mr-2 h-4 w-4" />
                    Enroll Now
                  </Button>
                </DialogTrigger>
              </CardContent>
            </Card>
          </div>
        )}
      </Dialog>
    </>
  );
};
