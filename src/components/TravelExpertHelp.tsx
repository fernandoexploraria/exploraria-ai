
import React from 'react';
import { HelpCircle, MapPin, DollarSign, Users, Check, Star } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TravelExpertUpgrade } from '@/components/TravelExpertUpgrade';

export const TravelExpertHelp: React.FC = () => {
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = React.useState(false);

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
              Upgrade your account to start creating and monetizing travel experiences
            </DialogDescription>
          </DialogHeader>
          <TravelExpertUpgrade 
            displayMode="badge" 
            onUpgradeComplete={() => setIsUpgradeDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
