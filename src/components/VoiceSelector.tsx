import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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

  const fetchVoices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-api-test', {
        body: { action: 'list_voices' }
      });

      if (error) throw error;

      if (data.success) {
        console.log('Fetched voices:', data.voices);
        setVoices(data.voices || []);
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

  const playVoiceSample = async (voice: Voice) => {
    setPlayingVoiceId(voice.voice_id);

    // Use the voice description, or fallback to the voice name if no description
    const textToSpeak = voice.description || `Hello, I'm ${voice.name}. This is how I sound.`;

    try {
      // Call edge function to generate TTS audio sample
      const { data, error } = await supabase.functions.invoke('elevenlabs-api-test', {
        body: { 
          action: 'generate_voice_sample',
          voice_id: voice.voice_id,
          text: textToSpeak
        }
      });

      if (error) throw error;

      if (data.success && data.audioUrl) {
        const audio = new Audio(data.audioUrl);
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
      } else {
        throw new Error(data.error || 'Failed to generate audio sample');
      }
    } catch (error) {
      console.error('Error playing voice sample:', error);
      setPlayingVoiceId(null);
      toast({
        title: "Playback Error",
        description: "Could not generate or play voice sample",
        variant: "destructive"
      });
    }
  };

  const filteredVoices = voices.filter(voice => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        voice.name.toLowerCase().includes(searchLower) ||
        (voice.description && voice.description.toLowerCase().includes(searchLower)) ||
        (voice.labels?.descriptive && voice.labels.descriptive.toLowerCase().includes(searchLower)) ||
        (voice.labels?.use_case && voice.labels.use_case.toLowerCase().includes(searchLower)) ||
        (voice.labels?.gender && voice.labels.gender.toLowerCase().includes(searchLower)) ||
        (voice.labels?.age && voice.labels.age.toLowerCase().includes(searchLower)) ||
        (voice.labels?.accent && voice.labels.accent.toLowerCase().includes(searchLower));
      
      return matchesSearch;
    }
    return true;
  });

  useEffect(() => {
    if (isOpen && voices.length === 0) {
      fetchVoices();
    }
  }, [isOpen]);

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
          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search voices by name, description, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button 
              variant="outline" 
              onClick={() => setSearchTerm('')} 
              size="sm"
              disabled={!searchTerm}
            >
              Clear
            </Button>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            {searchTerm ? `Found ${filteredVoices.length} voices matching "${searchTerm}"` : `Showing all ${voices.length} voices`}
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
            ) : filteredVoices.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>No voices found matching your search.</p>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            playVoiceSample(voice);
                          }}
                          disabled={playingVoiceId === voice.voice_id}
                          title="Play voice sample"
                        >
                          {playingVoiceId === voice.voice_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
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
                        {voice.labels?.language && (
                          <Badge variant="outline" className="text-xs">
                            {voice.labels.language}
                          </Badge>
                        )}
                        {voice.labels?.use_case && (
                          <Badge variant="default" className="text-xs">
                            {voice.labels.use_case.replace('_', ' ')}
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