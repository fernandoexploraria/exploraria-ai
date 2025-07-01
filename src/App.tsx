
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/components/AuthProvider';
import { TTSProvider } from '@/contexts/TTSContext';
import Index from '@/pages/Index';
import LandmarkInfoPage from '@/pages/LandmarkInfo';

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TTSProvider>
            <div className="min-h-screen bg-background font-sans antialiased">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/landmark-info" element={<LandmarkInfoPage />} />
              </Routes>
              <Toaster />
            </div>
          </TTSProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
