import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'tourist' | 'travel_expert';
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole = 'tourist',
  redirectTo = '/'
}) => {
  const { user, profile, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user, redirect to login
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // If profile not loaded yet, show loading
  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Check if user has required role
  if (requiredRole === 'travel_expert' && profile.role !== 'travel_expert') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Restricted
            </CardTitle>
            <CardDescription>
              You need to be a Travel Expert to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This page is only available to Travel Experts. If you're interested in becoming a Travel Expert, 
              please upgrade your account from the main app.
            </p>
            <Link to="/">
              <Button className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Main App
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has required role, render children
  return <>{children}</>;
};