
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { PostAuthAction } from "@/utils/authActions";
import Index from "./pages/Index";
import { useState } from "react";

const queryClient = new QueryClient();

const App = () => {
  const [postAuthActions, setPostAuthActions] = useState<{
    onSmartTour?: () => void;
  }>({});

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
                  />
                } 
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
