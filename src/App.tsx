import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider, QueryClient } from 'react-query';
import { AuthProvider } from '@/components/AuthProvider';
import Index from '@/pages';
import LandmarkInfoPage from '@/pages/LandmarkInfo';

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <div className="min-h-screen bg-background font-sans antialiased">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/landmark-info" element={<LandmarkInfoPage />} />
            </Routes>
            <Toaster />
          </div>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
