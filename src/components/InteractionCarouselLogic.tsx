import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';
import { Interaction } from '@/types/interaction';

export const useInteractionCarouselLogic = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [searchResults, setSearchResults] = useState<Interaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  const [currentLimit, setCurrentLimit] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const loadAllInteractions = async (limit: number = currentLimit) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error loading interactions:', error);
        toast({
          title: "Failed to load history",
          description: "Could not retrieve your interaction history.",
          variant: "destructive"
        });
        return;
      }

      setInteractions(data || []);
    } catch (error) {
      console.error('Error loading interactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreInteractions = async () => {
    setIsLoadingMore(true);
    const nextLimit = currentLimit === 10 ? 20 : 50;
    
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(nextLimit);

      if (error) {
        console.error('Error loading more interactions:', error);
        toast({
          title: "Failed to load more",
          description: "Could not retrieve additional interactions.",
          variant: "destructive"
        });
        return;
      }

      setInteractions(data || []);
      setCurrentLimit(nextLimit);
    } catch (error) {
      console.error('Error loading more interactions:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

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

      // Try vector search first
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
          setShowingSearchResults(true);
          
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

      // Fallback to text search
      const { data: textResults, error: searchError } = await supabase
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

      console.log('Text search results:', textResults);
      setSearchResults(textResults || []);
      setShowingSearchResults(true);
      
      if (!textResults || textResults.length === 0) {
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

  const handleBackToHistory = () => {
    setShowingSearchResults(false);
    setSearchResults([]);
    setSearchQuery('');
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

      const updateInteraction = (item: Interaction) => 
        item.id === interaction.id 
          ? { ...item, is_favorite: !item.is_favorite }
          : item;

      setInteractions(prev => prev.map(updateInteraction));
      if (showingSearchResults) {
        setSearchResults(prev => prev.map(updateInteraction));
      }

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

  return {
    searchQuery,
    setSearchQuery,
    interactions,
    searchResults,
    isLoading,
    isSearching,
    showingSearchResults,
    currentLimit,
    isLoadingMore,
    loadAllInteractions,
    loadMoreInteractions,
    handleSearch,
    handleBackToHistory,
    toggleFavorite
  };
};

export type { Interaction };
