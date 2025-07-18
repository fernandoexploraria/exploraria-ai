
import React from 'react';
import { HelpCircle, MapPin, DollarSign, Users, Check, Star } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const TravelExpertHelp: React.FC = () => {
  const { user, profile, upgradeToTravelExpert, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = React.useState(false);
  const [isUpgrading, setIsUpgrading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
  });

  const handleUpgrade = async () => {
    if (!user) return;

    setIsUpgrading(true);
    
    try {
      // Update profile information first
      if (formData.full_name || formData.bio) {
        const { error: profileError } = await updateProfile({
          full_name: formData.full_name,
          bio: formData.bio,
        });

        if (profileError) {
          throw profileError;
        }
      }

      // Upgrade role to travel_expert
      const { error: upgradeError } = await upgradeToTravelExpert();
      
      if (upgradeError) {
        throw upgradeError;
      }

      // Initialize Stripe Connect onboarding
      try {
        const { data, error } = await supabase.functions.invoke('create-onboarding-link', {
          body: {}
        });

        if (error) {
          console.error('Error creating onboarding link:', error);
          // Don't throw - the upgrade was successful, just Stripe onboarding failed
          toast({
            title: "Upgraded to Travel Expert!",
            description: "You can set up payments later from the curator portal.",
          });
        } else if (data?.url) {
          // Open Stripe Connect onboarding in new tab
          window.open(data.url, '_blank');
          
          toast({
            title: "Upgraded to Travel Expert!",
            description: "Complete your Stripe setup to start earning from your experiences.",
          });
        }
      } catch (stripeError) {
        console.error('Stripe onboarding error:', stripeError);
        toast({
          title: "Upgraded to Travel Expert!",
          description: "You can set up payments later from the curator portal.",
        });
      }

      setIsUpgradeDialogOpen(false);
      
    } catch (error) {
      console.error('Error upgrading to travel expert:', error);
      toast({
        title: "Upgrade Failed",
        description: "There was an error upgrading your account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  if (profile?.role === 'travel_expert') {
    return null; // Don't show anything for travel experts
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
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
              onClick={() => setIsUpgradeDialogOpen(true)} 
              className="w-full" 
              size="sm"
            >
              <Star className="mr-2 h-3 w-3" />
              Upgrade Now
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
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
              onClick={handleUpgrade}
              disabled={isUpgrading || !formData.full_name}
              className="w-full"
            >
              {isUpgrading ? "Upgrading..." : "Complete Upgrade"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
