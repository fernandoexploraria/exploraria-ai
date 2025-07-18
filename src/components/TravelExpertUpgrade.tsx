import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Star, MapPin, DollarSign, Users, ArrowRight, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TravelExpertUpgradeProps {
  onUpgradeComplete?: () => void;
}

export const TravelExpertUpgrade: React.FC<TravelExpertUpgradeProps> = ({ onUpgradeComplete }) => {
  const { user, profile, upgradeToTravelExpert, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
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

      setIsDialogOpen(false);
      onUpgradeComplete?.();
      
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
    return (
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/20 rounded-full">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Travel Expert</h3>
              <p className="text-sm text-muted-foreground">
                You're already a Travel Expert! Access your dashboard to manage experiences.
              </p>
            </div>
          </div>
          <Button asChild className="w-full">
            <a href="/curator-portal">
              <ArrowRight className="mr-2 h-4 w-4" />
              Go to Curator Portal
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/10">
      <CardHeader>
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
      </CardContent>
    </Card>
  );
};