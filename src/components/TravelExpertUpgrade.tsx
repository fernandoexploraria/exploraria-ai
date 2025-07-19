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
import { Star, MapPin, DollarSign, Users, ArrowRight, Check, X, HelpCircle, ArrowLeft, CreditCard, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface TravelExpertUpgradeProps {
  onUpgradeComplete?: () => void;
  displayMode?: 'full' | 'badge';
}

type WizardStep = 'profile' | 'stripe' | 'complete';

export const TravelExpertUpgrade: React.FC<TravelExpertUpgradeProps> = ({ 
  onUpgradeComplete, 
  displayMode = 'full' 
}) => {
  const { user, profile, upgradeToTravelExpert, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHelpPopoverOpen, setIsHelpPopoverOpen] = useState(false);
  const [shouldShowFullCard, setShouldShowFullCard] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(true);
  const [currentStep, setCurrentStep] = useState<WizardStep>('profile');
  const [stripeOnboardingUrl, setStripeOnboardingUrl] = useState<string | null>(null);
  const [isCreatingOnboardingLink, setIsCreatingOnboardingLink] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
  });

  // Determine card visibility based on user profile data
  useEffect(() => {
    if (!user || !profile) return;

    const checkCardVisibility = async () => {
      try {
        // Get current profile data with session tracking fields
        const { data: currentProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('session_count, first_login_at, upgrade_card_dismissed_at')
          .eq('id', user.id)
          .single();

        if (fetchError) {
          console.error('Error fetching profile for card visibility:', fetchError);
          return;
        }

        // Determine if we should show full card
        const daysSinceSignup = currentProfile?.first_login_at 
          ? (Date.now() - new Date(currentProfile.first_login_at).getTime()) / (1000 * 60 * 60 * 24)
          : 0;
        
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

  // Add click-outside detection
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

    // Only add listeners when full card is visible
    if (shouldShowFullCard && isCardVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [shouldShowFullCard, isCardVisible]);

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
        const { error } = await supabase
          .from('profiles')
          .update({ upgrade_card_dismissed_at: new Date().toISOString() })
          .eq('id', user.id);

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

  const handleProfileSubmit = async () => {
    if (!user || !formData.full_name) return;

    setIsUpgrading(true);
    
    try {
      // Update profile information
      const { error: profileError } = await updateProfile({
        full_name: formData.full_name,
        bio: formData.bio,
      });

      if (profileError) {
        throw profileError;
      }

      // Upgrade role to travel_expert
      const { error: upgradeError } = await upgradeToTravelExpert();
      
      if (upgradeError) {
        throw upgradeError;
      }

      // Move to Stripe setup step
      setCurrentStep('stripe');
      
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Profile Update Failed",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleStripeOnboarding = async () => {
    if (!user) return;

    setIsCreatingOnboardingLink(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-onboarding-link', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Error creating onboarding link:', error);
        toast({
          title: "Stripe Setup Error",
          description: "Failed to create Stripe onboarding link. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data?.onboarding_url) {
        setStripeOnboardingUrl(data.onboarding_url);
        
        // Open Stripe Connect onboarding in new tab
        const stripeWindow = window.open(data.onboarding_url, '_blank');
        
        if (!stripeWindow) {
          toast({
            title: "Pop-up Blocked",
            description: "Please allow pop-ups for this site and click the link below.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Stripe Setup Opened",
            description: "Complete your Stripe setup in the new tab, then return here.",
          });
          
          // Move to completion step after a delay
          setTimeout(() => {
            setCurrentStep('complete');
          }, 2000);
        }
      } else {
        throw new Error('No onboarding URL returned');
      }
    } catch (error) {
      console.error('Stripe onboarding error:', error);
      toast({
        title: "Stripe Setup Failed",
        description: "There was an error setting up Stripe. You can complete this later from the curator portal.",
        variant: "destructive",
      });
      
      // Still move to complete step but with a warning
      setCurrentStep('complete');
    } finally {
      setIsCreatingOnboardingLink(false);
    }
  };

  const handleComplete = () => {
    toast({
      title: "Welcome, Travel Expert!",
      description: "You can now create experiences and start earning from your expertise.",
    });
    
    setIsDialogOpen(false);
    setIsHelpPopoverOpen(false);
    onUpgradeComplete?.();
    
    // Reset wizard state
    setCurrentStep('profile');
    setStripeOnboardingUrl(null);
  };

  const handleHelpClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsHelpPopoverOpen(!isHelpPopoverOpen);
  };

  const getStepProgress = () => {
    switch (currentStep) {
      case 'profile': return 33;
      case 'stripe': return 66;
      case 'complete': return 100;
      default: return 0;
    }
  };

  if (profile?.role === 'travel_expert') {
    return null; // Don't show anything for travel experts
  }

  // Determine which display mode to use
  const actualDisplayMode = displayMode === 'full' ? 'full' : 
                          displayMode === 'badge' ? 'badge' : 
                          shouldShowFullCard ? 'full' : 'badge';

  // Badge mode - compact display with embedded help
  if (actualDisplayMode === 'badge') {
    return (
      <div className="relative">
        <Popover open={isHelpPopoverOpen} onOpenChange={setIsHelpPopoverOpen}>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            
            {/* Multi-step Upgrade Dialog */}
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Become a Travel Expert
                </DialogTitle>
                <DialogDescription>
                  {currentStep === 'profile' && "Let's set up your profile to get started"}
                  {currentStep === 'stripe' && "Set up payments to start earning from your experiences"}
                  {currentStep === 'complete' && "You're all set! Welcome to Travel Expert"}
                </DialogDescription>
              </DialogHeader>
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Step {currentStep === 'profile' ? '1' : currentStep === 'stripe' ? '2' : '3'} of 3</span>
                  <span>{getStepProgress()}% complete</span>
                </div>
                <Progress value={getStepProgress()} className="h-2" />
              </div>

              {/* Step Content */}
              <div className="space-y-4">
                {currentStep === 'profile' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name *</Label>
                      <Input
                        id="full_name"
                        placeholder="Your full name"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio (Optional)</Label>
                      <Textarea
                        id="bio"
                        placeholder="Tell us about your travel expertise and local knowledge..."
                        value={formData.bio}
                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={handleProfileSubmit}
                      disabled={isUpgrading || !formData.full_name}
                      className="w-full"
                    >
                      {isUpgrading ? "Setting up..." : "Continue"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}

                {currentStep === 'stripe' && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Payment Setup Required</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            To earn money from your experiences, you'll need to connect a Stripe account. 
                            This is secure and takes just a few minutes.
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h5 className="font-medium">What you'll need:</h5>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            Bank account information
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            Government-issued ID
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            Basic business information
                          </li>
                        </ul>
                      </div>

                      {stripeOnboardingUrl && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-800">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Pop-up blocked?</span>
                          </div>
                          <p className="text-sm text-yellow-700 mt-1">
                            <a 
                              href={stripeOnboardingUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="underline hover:no-underline inline-flex items-center gap-1"
                            >
                              Click here to open Stripe setup
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep('profile')}
                        className="flex-1"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        onClick={handleStripeOnboarding}
                        disabled={isCreatingOnboardingLink}
                        className="flex-1"
                      >
                        {isCreatingOnboardingLink ? "Setting up..." : "Set up Stripe"}
                        <CreditCard className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentStep('complete')}
                      className="w-full text-sm text-muted-foreground"
                    >
                      Skip for now (set up later in curator portal)
                    </Button>
                  </>
                )}

                {currentStep === 'complete' && (
                  <>
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <Check className="h-8 w-8 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Welcome, Travel Expert!</h3>
                        <p className="text-muted-foreground">
                          You can now create AI-powered experiences and start earning from your expertise.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
                        <h4 className="font-medium text-blue-900 mb-2">Next steps:</h4>
                        <ul className="space-y-1 text-sm text-blue-700">
                          <li>• Visit the Curator Portal to create your first experience</li>
                          <li>• Complete Stripe setup if you haven't already</li>
                          <li>• Share your experiences with travelers</li>
                        </ul>
                      </div>
                    </div>
                    
                    <Button onClick={handleComplete} className="w-full">
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Help Popover */}
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
                Upgrade Now
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Don't render if card was dismissed with animation
  if (!shouldShowFullCard) {
    return null;
  }

  // Full card mode - prominent display with enhanced UX
  return (
    <div
      ref={cardRef}
      className={`transform transition-all duration-300 ease-in-out ${
        isCardVisible 
          ? 'translate-y-0 opacity-100 scale-100' 
          : 'translate-y-2 opacity-0 scale-95'
      }`}
    >
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

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" size="lg">
                <Star className="mr-2 h-4 w-4" />
                Upgrade to Travel Expert
              </Button>
            </DialogTrigger>
            
            {/* Multi-step Upgrade Dialog - same content as badge mode */}
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Become a Travel Expert
                </DialogTitle>
                <DialogDescription>
                  {currentStep === 'profile' && "Let's set up your profile to get started"}
                  {currentStep === 'stripe' && "Set up payments to start earning from your experiences"}
                  {currentStep === 'complete' && "You're all set! Welcome to Travel Expert"}
                </DialogDescription>
              </DialogHeader>
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Step {currentStep === 'profile' ? '1' : currentStep === 'stripe' ? '2' : '3'} of 3</span>
                  <span>{getStepProgress()}% complete</span>
                </div>
                <Progress value={getStepProgress()} className="h-2" />
              </div>

              {/* Step Content - same as badge mode */}
              <div className="space-y-4">
                {currentStep === 'profile' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name *</Label>
                      <Input
                        id="full_name"
                        placeholder="Your full name"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio (Optional)</Label>
                      <Textarea
                        id="bio"
                        placeholder="Tell us about your travel expertise and local knowledge..."
                        value={formData.bio}
                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={handleProfileSubmit}
                      disabled={isUpgrading || !formData.full_name}
                      className="w-full"
                    >
                      {isUpgrading ? "Setting up..." : "Continue"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}

                {currentStep === 'stripe' && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Payment Setup Required</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            To earn money from your experiences, you'll need to connect a Stripe account. 
                            This is secure and takes just a few minutes.
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h5 className="font-medium">What you'll need:</h5>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            Bank account information
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            Government-issued ID
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            Basic business information
                          </li>
                        </ul>
                      </div>

                      {stripeOnboardingUrl && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-800">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Pop-up blocked?</span>
                          </div>
                          <p className="text-sm text-yellow-700 mt-1">
                            <a 
                              href={stripeOnboardingUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="underline hover:no-underline inline-flex items-center gap-1"
                            >
                              Click here to open Stripe setup
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep('profile')}
                        className="flex-1"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        onClick={handleStripeOnboarding}
                        disabled={isCreatingOnboardingLink}
                        className="flex-1"
                      >
                        {isCreatingOnboardingLink ? "Setting up..." : "Set up Stripe"}
                        <CreditCard className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentStep('complete')}
                      className="w-full text-sm text-muted-foreground"
                    >
                      Skip for now (set up later in curator portal)
                    </Button>
                  </>
                )}

                {currentStep === 'complete' && (
                  <>
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <Check className="h-8 w-8 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Welcome, Travel Expert!</h3>
                        <p className="text-muted-foreground">
                          You can now create AI-powered experiences and start earning from your expertise.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
                        <h4 className="font-medium text-blue-900 mb-2">Next steps:</h4>
                        <ul className="space-y-1 text-sm text-blue-700">
                          <li>• Visit the Curator Portal to create your first experience</li>
                          <li>• Complete Stripe setup if you haven't already</li>
                          <li>• Share your experiences with travelers</li>
                        </ul>
                      </div>
                    </div>
                    
                    <Button onClick={handleComplete} className="w-full">
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};
