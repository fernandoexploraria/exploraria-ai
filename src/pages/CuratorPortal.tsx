import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, BookOpen, Users, TrendingUp, Zap } from 'lucide-react';
import { ExperienceCreationWizard } from '@/components/ExperienceCreationWizard';
import { Link } from 'react-router-dom';

const CuratorPortal: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showCreateExperience, setShowCreateExperience] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Experience Curator Portal</CardTitle>
            <CardDescription>
              Please sign in to access the curator portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Main App
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showCreateExperience) {
    return (
      <ExperienceCreationWizard
        onClose={() => setShowCreateExperience(false)}
        onExperienceCreated={() => {
          setShowCreateExperience(false);
          // TODO: Refresh experiences list
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Main App
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Experience Curator Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome, {user.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Experiences Created</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">$0</p>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Experience Section */}
        <div className="flex flex-col items-center justify-center space-y-6 py-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">Create Your First Experience</h2>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Transform your local expertise into AI-powered guided experiences. 
              Create immersive tours that blend your knowledge with cutting-edge AI technology.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => setShowCreateExperience(true)}
              size="lg"
              className="px-8 py-6 text-lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create New Experience
            </Button>
            <Link to="/elevenlabs-playground">
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-6 text-lg"
              >
                <Zap className="mr-2 h-5 w-5" />
                ElevenLabs Playground
              </Button>
            </Link>
          </div>
        </div>

        {/* Coming Soon Features */}
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Features we're building to enhance your curator experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-border rounded-lg">
                <h3 className="font-semibold mb-2">Analytics Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  Track user engagement, popular landmarks, and experience performance metrics.
                </p>
              </div>
              <div className="p-4 border border-border rounded-lg">
                <h3 className="font-semibold mb-2">Revenue Sharing</h3>
                <p className="text-sm text-muted-foreground">
                  Monetize your experiences with automatic payouts and transparent earnings tracking.
                </p>
              </div>
              <div className="p-4 border border-border rounded-lg">
                <h3 className="font-semibold mb-2">Experience Marketplace</h3>
                <p className="text-sm text-muted-foreground">
                  Showcase your experiences in our public marketplace for maximum visibility.
                </p>
              </div>
              <div className="p-4 border border-border rounded-lg">
                <h3 className="font-semibold mb-2">Advanced AI Tools</h3>
                <p className="text-sm text-muted-foreground">
                  Enhanced prompt engineering tools and AI personality customization options.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CuratorPortal;