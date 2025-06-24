
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AuthProvider } from '@/components/AuthProvider';
import { TTSProvider } from '@/contexts/TTSContext';
import Index from '@/pages/Index';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <TTSProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
            </Routes>
            <Toaster />
            <SonnerToaster />
          </AuthProvider>
        </TTSProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
