import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, Loader2, Mic } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Voice {
  voice_id: string;
  name: string;
  description?: string;
  category?: string;
  labels?: {
    gender?: string;
    age?: string;
    accent?: string;
    language?: string;
    use_case?: string;
    descriptive?: string;
  };
  preview_url?: string;
  samples?: Array<{
    sample_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    hash: string;
  }>;
}

interface VoiceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceSelect: (voice: Voice) => void;
  selectedVoiceId?: string;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  isOpen,
  onClose,
  onVoiceSelect,
  selectedVoiceId
}) => {
  const { toast } = useToast();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  
  const [filterOptions, setFilterOptions] = useState({
    gender: [],
    age: [],
    accent: [],
    category: [],
    language: [],
    use_cases: [],
    descriptives: []
  });
  
  const [filters, setFilters] = useState({
    gender: '',
    age: '',
    accent: '',
    category: '',
    language: '',
    use_cases: '',
    descriptives: ''
  });

  const fetchVoices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-api-test', {
        body: { action: 'list_voices' }
      });

      if (error) throw error;

      if (data.success) {
        setVoices(data.voices || []);
        await fetchFilterOptions();
      } else {
        throw new Error(data.error || 'Failed to fetch voices');
      }
    } catch (error) {
      console.error('Error fetching voices:', error);
      setError(error.message || 'Failed to fetch voices');
      toast({
        title: "Error",
        description: "Failed to fetch voices from ElevenLabs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-api-test', {
        body: { action: 'get_filter_options' }
      });

      if (error) throw error;

      if (data.success) {
        setFilterOptions(data.filterOptions || {
          gender: [],
          age: [],
          accent: [],
          category: [],
          language: [],
          use_cases: [],
          descriptives: []
        });
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const playVoiceSample = async (voice: Voice) => {
    if (!voice.samples || voice.samples.length === 0) {
      toast({
        title: "No Sample Available",
        description: "This voice doesn't have a preview sample",
        variant: "default"
      });
      return;
    }

    setPlayingVoiceId(voice.voice_id);

    try {
      // Use the first sample available
      const sampleUrl = `https://api.elevenlabs.io/v1/voices/${voice.voice_id}/samples/${voice.samples[0].sample_id}/audio`;
      
      const audio = new Audio(sampleUrl);
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => {
        setPlayingVoiceId(null);
        toast({
          title: "Playback Error",
          description: "Could not play voice sample",
          variant: "destructive"
        });
      };
      
      await audio.play();
    } catch (error) {
      console.error('Error playing voice sample:', error);
      setPlayingVoiceId(null);
      toast({
        title: "Playback Error",
        description: "Could not play voice sample",
        variant: "destructive"
      });
    }
  };

  const filteredVoices = voices.filter(voice => {
    // Apply text search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        voice.name.toLowerCase().includes(searchLower) ||
        (voice.description && voice.description.toLowerCase().includes(searchLower)) ||
        (voice.labels?.descriptive && voice.labels.descriptive.toLowerCase().includes(searchLower));
      
      if (!matchesSearch) return false;
    }

    // Apply filters
    if (filters.gender && voice.labels?.gender !== filters.gender) return false;
    if (filters.age && voice.labels?.age !== filters.age) return false;
    if (filters.accent && voice.labels?.accent !== filters.accent) return false;
    if (filters.category && voice.category !== filters.category) return false;
    if (filters.language && voice.labels?.language !== filters.language) return false;
    if (filters.use_cases && voice.labels?.use_case !== filters.use_cases) return false;
    if (filters.descriptives && voice.labels?.descriptive !== filters.descriptives) return false;

    return true;
  });

  useEffect(() => {
    if (isOpen && voices.length === 0) {
      fetchVoices();
    }
  }, [isOpen]);

  const clearFilters = () => {
    setFilters({
      gender: '',
      age: '',
      accent: '',
      category: '',
      language: '',
      use_cases: '',
      descriptives: ''
    });
    setSearchTerm('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Select Voice
          </DialogTitle>
          <DialogDescription>
            Choose from {voices.length} available ElevenLabs voices
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Search and Filters */}
          <div className="flex flex-col gap-4 p-2 border rounded-lg bg-muted/30">
            <div className="flex gap-2">
              <Input
                placeholder="Search voices by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={clearFilters} size="sm">
                Clear Filters
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(filterOptions).map(([filterKey, options]) => (
                <Select
                  key={filterKey}
                  value={filters[filterKey]}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, [filterKey]: value }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={filterKey.replace('_', ' ')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All {filterKey.replace('_', ' ')}</SelectItem>
                    {options.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredVoices.length} of {voices.length} voices
          </div>

          {/* Voice Grid */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading voices...</span>
              </div>
            ) : error ? (
              <div className="text-center text-destructive py-8">
                <p>Error: {error}</p>
                <Button onClick={fetchVoices} variant="outline" className="mt-2">
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredVoices.map((voice) => (
                  <Card 
                    key={voice.voice_id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedVoiceId === voice.voice_id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => onVoiceSelect(voice)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">{voice.name}</CardTitle>
                        {voice.samples && voice.samples.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              playVoiceSample(voice);
                            }}
                            disabled={playingVoiceId === voice.voice_id}
                          >
                            {playingVoiceId === voice.voice_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      {voice.description && (
                        <CardDescription className="text-xs">
                          {voice.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-1">
                        {voice.category && (
                          <Badge variant="secondary" className="text-xs">
                            {voice.category}
                          </Badge>
                        )}
                        {voice.labels?.gender && (
                          <Badge variant="outline" className="text-xs">
                            {voice.labels.gender}
                          </Badge>
                        )}
                        {voice.labels?.age && (
                          <Badge variant="outline" className="text-xs">
                            {voice.labels.age}
                          </Badge>
                        )}
                        {voice.labels?.accent && (
                          <Badge variant="outline" className="text-xs">
                            {voice.labels.accent}
                          </Badge>
                        )}
                        {voice.labels?.descriptive && (
                          <Badge variant="default" className="text-xs">
                            {voice.labels.descriptive}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};