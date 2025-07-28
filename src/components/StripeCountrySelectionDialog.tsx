import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Flag, DollarSign } from 'lucide-react';

interface StripeCountrySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCountrySelect: (country: string) => void;
  isLoading?: boolean;
}

export const StripeCountrySelectionDialog: React.FC<StripeCountrySelectionDialogProps> = ({
  open,
  onOpenChange,
  onCountrySelect,
  isLoading = false
}) => {
  const [selectedCountry, setSelectedCountry] = useState<string>('US');

  const countries = [
    {
      code: 'US',
      name: 'United States',
      currency: 'USD',
      description: 'For US-based travel experts'
    },
    {
      code: 'MX',
      name: 'Mexico',
      currency: 'MXN',
      description: 'For Mexico-based travel experts'
    }
  ];

  const handleContinue = () => {
    onCountrySelect(selectedCountry);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Select Your Country
          </DialogTitle>
          <DialogDescription>
            Choose the country where you'll be operating as a travel expert. This will set up your Stripe account for the correct region and currency.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup 
            value={selectedCountry} 
            onValueChange={setSelectedCountry}
            className="space-y-3"
          >
            {countries.map((country) => (
              <div key={country.code} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                <RadioGroupItem value={country.code} id={country.code} />
                <Label htmlFor={country.code} className="flex-1 cursor-pointer">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{country.name}</span>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        {country.currency}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {country.description}
                    </p>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={isLoading}>
            {isLoading ? 'Setting up...' : 'Continue to Stripe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};