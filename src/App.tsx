
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { TTSProvider } from "./contexts/TTSContext";
import Index from "./pages/Index";
import MediaRedirect from "./components/MediaRedirect";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TTSProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/media/:shortCode" element={<MediaRedirect />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TTSProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
