
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { TTSProvider } from "@/contexts/TTSContext";
import { StripeProvider } from "@/contexts/StripeProvider";
import { PostAuthAction } from "@/utils/authActions";
import Index from "./pages/Index";
import CuratorPortal from "./pages/CuratorPortal";
import ElevenLabsPlayground from "./pages/ElevenLabsPlayground";
import TermsOfUse from "./pages/TermsOfUse";
import AccountPrivacyPolicy from "./pages/AccountPrivacyPolicy";
import Account from "./pages/Account";
import ResetPassword from "./pages/ResetPassword";
import EmailTest from "./pages/EmailTest";
import { PaymentSuccess } from "./components/PaymentSuccess";
import { PaymentFailure } from "./components/PaymentFailure";
import { useState } from "react";

const queryClient = new QueryClient();

const App = () => {
  const [postAuthActions, setPostAuthActions] = useState<{
    onSmartTour?: () => void;
    onIntelligentTour?: () => void;
  }>({});
  const [isVoiceAgentActive, setIsVoiceAgentActive] = useState(false);

  const handlePostAuthAction = (action: PostAuthAction) => {
    console.log('🎯 App handling post-auth action:', action);
    
    switch (action) {
      case 'smart-tour':
        if (postAuthActions.onSmartTour) {
          postAuthActions.onSmartTour();
        }
        break;
      case 'intelligent-tour':
        if (postAuthActions.onIntelligentTour) {
          postAuthActions.onIntelligentTour();
        }
        break;
      default:
        break;
    }
  };

  // Add console logging to detect StrictMode double-mounting
  console.log('🔧 App component mounting/rendering at:', new Date().toISOString());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StripeProvider>
          <TTSProvider isVoiceAgentActive={isVoiceAgentActive}>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider onPostAuthAction={handlePostAuthAction}>
                <Routes>
                  <Route 
                    path="/" 
                    element={
                      <Index 
                        onRegisterPostAuthActions={setPostAuthActions}
                        onVoiceAgentStateChange={setIsVoiceAgentActive}
                      />
                    }
                  />
                  <Route 
                    path="/curator-portal" 
                    element={<CuratorPortal />} 
                  />
                   <Route 
                     path="/elevenlabs-playground" 
                     element={<ElevenLabsPlayground />} 
                   />
                   <Route 
                     path="/terms-of-use" 
                     element={<TermsOfUse />} 
                   />
                   <Route 
                     path="/account-privacy-policy" 
                     element={<AccountPrivacyPolicy />} 
                   />
                   <Route 
                     path="/account" 
                     element={<Account />} 
                   />
                   <Route 
                     path="/reset-password" 
                     element={<ResetPassword />} 
                   />
                   <Route 
                     path="/payment-success" 
                     element={<PaymentSuccess />} 
                   />
                   <Route 
                     path="/payment-failed" 
                     element={<PaymentFailure />} 
                   />
                   <Route 
                     path="/email-test" 
                     element={<EmailTest />} 
                   />
                 </Routes>
              </AuthProvider>
            </BrowserRouter>
          </TTSProvider>
        </StripeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
