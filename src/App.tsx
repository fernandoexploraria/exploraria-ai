
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { TTSProvider } from "@/contexts/TTSContext";
import { PostAuthAction } from "@/utils/authActions";
import Index from "./pages/Index";
import CuratorPortal from "./pages/CuratorPortal";
import ElevenLabsPlayground from "./pages/ElevenLabsPlayground";
import { useState } from "react";

const queryClient = new QueryClient();

const App = () => {
  const [postAuthActions, setPostAuthActions] = useState<{
    onSmartTour?: () => void;
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
      default:
        break;
    }
  };

  // Add console logging to detect StrictMode double-mounting
  console.log('🔧 App component mounting/rendering at:', new Date().toISOString());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TTSProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
