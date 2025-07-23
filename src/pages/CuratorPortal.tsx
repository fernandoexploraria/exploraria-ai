import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, BookOpen, Users, TrendingUp, Zap, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { ExperienceCreationWizard } from '@/components/ExperienceCreationWizard';
import { Link, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CuratorPortal: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [showCreateExperience, setShowCreateExperience] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{
    accountStatus?: string;
    payoutsEnabled?: boolean;
    chargesEnabled?: boolean;
  }>({});
  const [isAccessingStripe, setIsAccessingStripe] = useState(false);

  // Handle Stripe Connect return flow
  useEffect(() => {
    const handleStripeReturn = async () => {
      const urlParams = new URLSearchParams(location.search);
      const stripeSuccess = urlParams.get('stripe_success');
      const stripeRefresh = urlParams.get('stripe_refresh');
      const onboardingInProgress = sessionStorage.getItem('stripe_onboarding_in_progress');

      // Clear session storage
      sessionStorage.removeItem('stripe_onboarding_in_progress');
      sessionStorage.removeItem('upgrade_dialog_was_open');

      if (stripeSuccess === 'true' && onboardingInProgress) {
        toast({
          title: "Stripe Setup Successful!",
          description: "Your payout account has been configured. You can now earn from your experiences.",
        });
        
        // Refresh profile to get updated Stripe status
        if (user) {
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .select('stripe_account_status, stripe_payouts_enabled, stripe_charges_enabled')
            .eq('id', user.id)
            .single();
          
          if (updatedProfile) {
            setStripeStatus({
              accountStatus: updatedProfile.stripe_account_status,
              payoutsEnabled: updatedProfile.stripe_payouts_enabled,
              chargesEnabled: updatedProfile.stripe_charges_enabled,
            });
          }
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, location.pathname);
      } else if (stripeRefresh === 'true' && onboardingInProgress) {
        toast({
          title: "Setup Incomplete",
          description: "Your Stripe setup needs to be completed. You can continue from where you left off.",
          variant: "destructive",
        });
        
        // Clean up URL
        window.history.replaceState({}, document.title, location.pathname);
      }
    };

    handleStripeReturn();
  }, [location.search, user, toast]);

  // Fetch current Stripe status on component mount
  useEffect(() => {
    const fetchStripeStatus = async () => {
      if (user && profile) {
        setStripeStatus({
          accountStatus: profile.stripe_account_status,
          payoutsEnabled: profile.stripe_payouts_enabled,
          chargesEnabled: profile.stripe_charges_enabled,
        });
      }
    };

    fetchStripeStatus();
  }, [user, profile]);

  const getStripeStatusDisplay = () => {
    const { accountStatus, payoutsEnabled } = stripeStatus;
    
    if (accountStatus === 'active' && payoutsEnabled) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-600" />,
        text: "Payouts Active",
        description: "You're all set to receive payments!",
        variant: "success" as const
      };
    } else if (accountStatus === 'pending_verification') {
      return {
        icon: <Clock className="h-4 w-4 text-yellow-600" />,
        text: "Verification Pending",
        description: "Stripe is reviewing your account. You'll be notified when complete.",
        variant: "warning" as const
      };
    } else if (accountStatus === 'pending_info') {
      return {
        icon: <AlertCircle className="h-4 w-4 text-orange-600" />,
        text: "Setup Incomplete",
        description: "Complete your Stripe setup to receive payments.",
        variant: "warning" as const
      };
    } else {
      return {
        icon: <AlertCircle className="h-4 w-4 text-gray-600" />,
        text: "Setup Required",
        description: "Set up your payout account to start earning.",
        variant: "default" as const
      };
    }
  };

  const handleStripeSetup = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-onboarding-link', {
        body: {}
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        // Store state for return flow
        sessionStorage.setItem('stripe_onboarding_in_progress', 'true');
        
        toast({
          title: "Redirecting to Stripe...",
          description: "Complete your setup to start earning from experiences.",
        });
        
        setTimeout(() => {
          window.location.href = data.url;
        }, 1000);
      }
    } catch (error) {
      console.error('Error creating Stripe onboarding link:', error);
      toast({
        title: "Setup Error",
        description: "Unable to start Stripe setup. Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleStripeAccountAccess = async () => {
    try {
      setIsAccessingStripe(true);
      
      const { data, error } = await supabase.functions.invoke('create-express-login-link', {
        body: {}
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        toast({
          title: "Redirecting to Stripe...",
          description: "Opening your Stripe Express dashboard.",
        });
        
        // Open Stripe Express dashboard in new tab
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating Express login link:', error);
      toast({
        title: "Access Error",
        description: "Unable to access Stripe dashboard. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsAccessingStripe(false);
    }
  };

  // Check if experience creation should be enabled
  const canCreateExperiences = stripeStatus.accountStatus === 'active' && stripeStatus.payoutsEnabled;

  if (showCreateExperience) {
    return (
      <ExperienceCreationWizard
        onClose={() => setShowCreateExperience(false)}
        onExperienceCreated={() => {
          setShowCreateExperience(false);
          // TODO: Refresh experiences list
        }}
      />
    );
  }

  const stripeStatusDisplay = getStripeStatusDisplay();

  return (
    <ProtectedRoute requiredRole="travel_expert">
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Main App
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Experience Curator Portal</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome, {profile?.full_name || user?.email}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 space-y-8">
          {/* Stripe Status Banner */}
          {stripeStatusDisplay.variant !== 'success' && (
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {stripeStatusDisplay.icon}
                    <div>
                      <h3 className="font-semibold text-sm">{stripeStatusDisplay.text}</h3>
                      <p className="text-sm text-muted-foreground">
                        {stripeStatusDisplay.description}
                      </p>
                    </div>
                  </div>
                  {(stripeStatus.accountStatus === 'not_started' || stripeStatus.accountStatus === 'pending_info') && (
                    <Button onClick={handleStripeSetup} size="sm">
                      Complete Setup
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <BookOpen className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Experiences Created</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">$0</p>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <div className="flex items-center gap-2 mt-2">
                      {stripeStatusDisplay.variant === 'success' && (
                        <div className="flex items-center gap-1">
                          {stripeStatusDisplay.icon}
                          <span className="text-xs text-green-600">Ready to earn</span>
                        </div>
                      )}
                      {stripeStatus.accountStatus === 'active' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleStripeAccountAccess}
                          disabled={isAccessingStripe}
                          className="h-6 text-xs"
                        >
                          {isAccessingStripe ? (
                            "Loading..."
                          ) : (
                            <>
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Manage Payouts
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Create Experience Section */}
          <div className="flex flex-col items-center justify-center space-y-6 py-12">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-foreground">Create Your First Experience</h2>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Transform your local expertise into AI-powered guided experiences. 
                Create immersive tours that blend your knowledge with cutting-edge AI technology.
              </p>
            </div>
            
            {canCreateExperiences ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => setShowCreateExperience(true)}
                  size="lg"
                  className="px-8 py-6 text-lg"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Create New Experience
                </Button>
                <Link to="/elevenlabs-playground">
                  <Button
                    variant="outline"
                    size="lg"
                    className="px-8 py-6 text-lg"
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    ElevenLabs Playground
                  </Button>
                </Link>
              </div>
            ) : (
              <Card className="max-w-lg mx-auto">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto" />
                    <div>
                      <h3 className="font-semibold text-lg">Payout Setup Required</h3>
                      <p className="text-sm text-muted-foreground">
                        Complete your Stripe payout setup to start creating experiences and earning from your expertise.
                      </p>
                    </div>
                    {(stripeStatus.accountStatus === 'not_started' || stripeStatus.accountStatus === 'pending_info') && (
                      <Button onClick={handleStripeSetup} className="w-full">
                        Complete Stripe Setup
                      </Button>
                    )}
                    {stripeStatus.accountStatus === 'pending_verification' && (
                      <div className="text-sm text-muted-foreground">
                        Your account is under review. You'll be able to create experiences once verification is complete.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coming Soon Features */}
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>
                Features we're building to enhance your curator experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-border rounded-lg">
                  <h3 className="font-semibold mb-2">Analytics Dashboard</h3>
                  <p className="text-sm text-muted-foreground">
                    Track user engagement, popular landmarks, and experience performance metrics.
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <h3 className="font-semibold mb-2">Revenue Sharing</h3>
                  <p className="text-sm text-muted-foreground">
                    Monetize your experiences with automatic payouts and transparent earnings tracking.
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <h3 className="font-semibold mb-2">Experience Marketplace</h3>
                  <p className="text-sm text-muted-foreground">
                    Showcase your experiences in our public marketplace for maximum visibility.
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <h3 className="font-semibold mb-2">Advanced AI Tools</h3>
                  <p className="text-sm text-muted-foreground">
                    Enhanced prompt engineering tools and AI personality customization options.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default CuratorPortal;
