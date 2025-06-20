
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Calendar, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  is_favorite: boolean;
  created_at: string;
}

interface FavoritesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FavoritesDialog: React.FC<FavoritesDialogProps> = ({ open, onOpenChange }) => {
  const [favorites, setFavorites] = useState<Interaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchFavorites = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to view your favorites.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: interactions, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('is_favorite', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching favorites:', error);
        toast({
          title: "Failed to load favorites",
          description: "There was an error loading your favorite conversations.",
          variant: "destructive"
        });
        return;
      }

      setFavorites(interactions || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast({
        title: "Failed to load favorites",
        description: "There was an error loading your favorite conversations.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchFavorites();
    }
  }, [open, user]);

  const removeFavorite = async (interaction: Interaction) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to update favorites.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('interactions')
        .update({ is_favorite: false })
        .eq('id', interaction.id);

      if (error) {
        console.error('Error removing favorite:', error);
        toast({
          title: "Update failed",
          description: "Could not remove from favorites.",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      setFavorites(prev => prev.filter(item => item.id !== interaction.id));

      toast({
        title: "Removed from favorites",
        description: "Conversation removed from favorites successfully.",
      });
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast({
        title: "Update failed",
        description: "Could not remove from favorites.",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-current" />
            Favorite Conversations
          </DialogTitle>
          <DialogDescription>
            View and manage your saved conversations with the tour assistant. These are the conversations you've marked as favorites for easy reference.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading your favorite conversations...</p>
            </div>
          ) : favorites.length > 0 ? (
            favorites.map((interaction) => (
              <div key={interaction.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{interaction.destination}</Badge>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(interaction.created_at)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFavorite(interaction)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-blue-400">You asked:</p>
                    <p className="text-sm text-white">{interaction.user_input}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-400">Assistant replied:</p>
                    <p className="text-sm text-white">{interaction.assistant_response}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No favorite conversations yet.</p>
              <p className="text-sm">Mark conversations as favorites during your tour to see them here.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FavoritesDialog;
