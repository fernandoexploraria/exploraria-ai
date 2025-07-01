
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Star, StarOff, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth }  from './AuthProvider';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  is_favorite: boolean;
  created_at: string;
  similarity?: number;
}

interface VoiceSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VoiceSearchDialog: React.FC<VoiceSearchDialogProps> = ({ open, onOpenChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Interaction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to search your conversations.",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      console.log('Starting search with query:', searchQuery);

      // First try the vector search function if available
      try {
        const { data, error } = await supabase.functions.invoke('search-interactions', {
          body: { query: searchQuery }
        });

        if (error) {
          console.error('Vector search error:', error);
          throw error;
        }

        if (data && data.results) {
          console.log('Vector search results:', data.results);
          setSearchResults(data.results);
          
          if (data.results.length === 0) {
            toast({
              title: "No results found",
              description: "Try searching with different keywords.",
            });
          }
          return;
        }
      } catch (vectorError) {
        console.log('Vector search not available, falling back to text search:', vectorError);
      }

      // Fallback to simple text search
      const { data: interactions, error: searchError } = await supabase
        .from('interactions')
        .select('*')
        .or(`user_input.ilike.%${searchQuery}%,assistant_response.ilike.%${searchQuery}%,destination.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchError) {
        console.error('Text search error:', searchError);
        toast({
          title: "Search failed",
          description: "There was an error searching your conversations.",
          variant: "destructive"
        });
        return;
      }

      console.log('Text search results:', interactions);
      setSearchResults(interactions || []);
      
      if (!interactions || interactions.length === 0) {
        toast({
          title: "No results found",
          description: "Try searching with different keywords.",
        });
      }

    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: "There was an error searching your conversations.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleFavorite = async (interaction: Interaction) => {
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
        .update({ is_favorite: !interaction.is_favorite })
        .eq('id', interaction.id);

      if (error) {
        console.error('Error updating favorite:', error);
        toast({
          title: "Update failed",
          description: "Could not update favorite status.",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      setSearchResults(prev => 
        prev.map(item => 
          item.id === interaction.id 
            ? { ...item, is_favorite: !item.is_favorite }
            : item
        )
      );

      toast({
        title: interaction.is_favorite ? "Removed from favorites" : "Added to favorites",
        description: "Conversation updated successfully.",
      });
    } catch (error) {
      console.error('Error updating favorite:', error);
      toast({
        title: "Update failed",
        description: "Could not update favorite status.",
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
          <DialogTitle>Search Interactions</DialogTitle>
          <DialogDescription>
            Search through your previous interactions with the tour assistant. Find specific topics, questions, or destinations you've discussed before.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Search your previous interactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
            <Search className="w-4 h-4 mr-2" />
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {searchResults.length > 0 ? (
            searchResults.map((interaction) => (
              <div key={interaction.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{interaction.destination}</Badge>
                    {interaction.similarity && (
                      <Badge variant="secondary">
                        {Math.round(interaction.similarity * 100)}% match
                      </Badge>
                    )}
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(interaction.created_at)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFavorite(interaction)}
                  >
                    {interaction.is_favorite ? (
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    ) : (
                      <StarOff className="w-4 h-4" />
                    )}
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
          ) : searchQuery && !isSearching ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No interactions found matching your search.</p>
              <p className="text-sm">Try different keywords or check your spelling.</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Enter a search query to find your previous interactions.</p>
              <p className="text-sm">You can search by topics, questions, or destinations.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceSearchDialog;
