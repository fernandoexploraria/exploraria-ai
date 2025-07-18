import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileStats {
  totalUsers: number;
  existingProfiles: number;
  missingProfiles: number;
  missingUsers: Array<{ id: string; email: string }>;
  profilesMissingFields: number;
  missingFieldsProfiles: Array<{ id: string }>;
}

export const ProfileBackfillUtility = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-profiles', {
        method: 'GET',
      });

      if (error) {
        throw error;
      }

      setStats(data);
    } catch (error) {
      console.error('Error fetching profile stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch profile statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createMissingProfiles = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-profiles', {
        method: 'POST',
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Created ${data.created} missing profiles`,
      });

      // Refresh stats
      await fetchStats();
    } catch (error) {
      console.error('Error creating profiles:', error);
      toast({
        title: "Error",
        description: "Failed to create missing profiles",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const updateExistingProfiles = async () => {
    setUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-profiles', {
        method: 'PUT',
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Updated ${data.updated} profiles with tracking fields`,
      });

      // Refresh stats
      await fetchStats();
    } catch (error) {
      console.error('Error updating profiles:', error);
      toast({
        title: "Error",
        description: "Failed to update profile tracking fields",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Profile Backfill Utility
        </CardTitle>
        <CardDescription>
          Manage user profiles for existing users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button
            onClick={fetchStats}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              'Check Profile Status'
            )}
          </Button>
        </div>

        {stats && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalUsers}</div>
                <div className="text-sm text-muted-foreground">Total Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.existingProfiles}</div>
                <div className="text-sm text-muted-foreground">With Profiles</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <Badge 
                  variant={stats.missingProfiles > 0 ? "destructive" : "default"}
                  className="text-sm"
                >
                  {stats.missingProfiles} Missing
                </Badge>
              </div>
              <div className="text-center">
                <Badge 
                  variant={stats.profilesMissingFields > 0 ? "secondary" : "default"}
                  className="text-sm"
                >
                  {stats.profilesMissingFields} Missing Fields
                </Badge>
              </div>
            </div>

            {stats.missingProfiles > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Missing profiles for:
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {stats.missingUsers.map((user) => (
                    <div key={user.id} className="text-xs bg-muted p-2 rounded">
                      {user.email}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={createMissingProfiles}
                  disabled={creating || updating}
                  className="w-full"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Create Missing Profiles
                    </>
                  )}
                </Button>
              </div>
            )}

            {stats.profilesMissingFields > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {stats.profilesMissingFields} profiles need tracking field updates
                </div>
                <Button
                  onClick={updateExistingProfiles}
                  disabled={creating || updating}
                  variant="outline"
                  className="w-full"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Update Tracking Fields
                    </>
                  )}
                </Button>
              </div>
            )}

            {stats.missingProfiles === 0 && stats.profilesMissingFields === 0 && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                All profiles are up to date
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};