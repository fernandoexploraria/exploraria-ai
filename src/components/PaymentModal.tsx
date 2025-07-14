import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StripePaymentForm } from './StripePaymentForm';
import { Experience } from '@/hooks/useExperiences';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  experience: Experience | null;
  clientSecret: string | null;
  onPaymentSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  experience,
  clientSecret,
  onPaymentSuccess
}) => {
  if (!experience || !clientSecret) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Secure Payment</DialogTitle>
        </DialogHeader>
        <StripePaymentForm
          experience={experience}
          clientSecret={clientSecret}
          onSuccess={onPaymentSuccess}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};