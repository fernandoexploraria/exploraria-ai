import { useState } from 'react';
import { Experience } from '@/hooks/useExperiences';
import { toast } from 'sonner';

export const usePaymentFlow = (onTourGeneration?: () => void) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [currentExperience, setCurrentExperience] = useState<Experience | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const openPaymentModal = (experience: Experience, clientSecret: string) => {
    setCurrentExperience(experience);
    setClientSecret(clientSecret);
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setCurrentExperience(null);
    setClientSecret(null);
  };

  const handlePaymentSuccess = () => {
    toast.success('Payment successful! Generating your tour...');
    closePaymentModal();
    
    if (currentExperience && onTourGeneration) {
      // Convert experience to landmark format for tour generation
      const landmark = {
        id: currentExperience.id,
        name: currentExperience.destination,
        description: currentExperience.description,
        coordinates: currentExperience.destination_details ? 
          [currentExperience.destination_details.location.longitude, currentExperience.destination_details.location.latitude] :
          [0, 0],
        placeId: currentExperience.destination_details?.placeId,
        formattedAddress: currentExperience.destination_details?.address,
        types: currentExperience.destination_details?.types || ['tourist_attraction'],
        rating: currentExperience.destination_details?.rating,
        tourId: currentExperience.id,
        experience: true
      };

      // Store landmark as pending destination for IntelligentTourDialog
      (window as any).pendingLandmarkDestination = landmark;
      
      // Trigger tour generation
      onTourGeneration();
    }
  };

  return {
    isPaymentModalOpen,
    currentExperience,
    clientSecret,
    openPaymentModal,
    closePaymentModal,
    handlePaymentSuccess
  };
};