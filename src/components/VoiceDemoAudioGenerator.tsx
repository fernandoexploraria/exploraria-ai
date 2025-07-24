import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Download, CheckCircle, XCircle, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface GenerationResult {
  filename: string;
  status: 'success' | 'error';
  error?: string;
}

interface GenerationResponse {
  success: boolean;
  message: string;
  results: GenerationResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export const VoiceDemoAudioGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateAudioFiles = async () => {
    setIsGenerating(true);
    setError(null);
    setResults(null);

    try {
      console.log('🎭 Starting audio generation...');
      
      const { data, error: funcError } = await supabase.functions.invoke('generate-voice-demo-audio', {
        body: {}
      });

      if (funcError) {
        throw new Error(`Function error: ${funcError.message}`);
      }

      console.log('🎭 Generation response:', data);
      setResults(data);

    } catch (err) {
      console.error('🚨 Error generating audio files:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Volume2 className="h-6 w-6 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Voice Demo Audio Generator</h3>
          <p className="text-sm text-muted-foreground">
            Generate all 13 MP3 files for the pre-rendered voice demo
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Button
          onClick={generateAudioFiles}
          disabled={isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Audio Files...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Generate All Audio Files
            </>
          )}
        </Button>

        {isGenerating && (
          <div className="text-center text-sm text-muted-foreground">
            <p>This may take 1-2 minutes to complete...</p>
            <p>Using ElevenLabs TTS to generate high-quality audio</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive font-medium mb-2">
              <XCircle className="h-4 w-4" />
              Generation Failed
            </div>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
        )}

        {results && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                <CheckCircle className="h-4 w-4" />
                Generation Results
              </div>
              <p className="text-sm text-green-600 mb-3">{results.message}</p>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-lg">{results.summary.total}</div>
                  <div className="text-muted-foreground">Total Files</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-green-600">{results.summary.successful}</div>
                  <div className="text-muted-foreground">Successful</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-red-600">{results.summary.failed}</div>
                  <div className="text-muted-foreground">Failed</div>
                </div>
              </div>
            </div>

            {/* Individual file results */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <h4 className="font-medium text-sm">File Details:</h4>
              {results.results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded text-sm ${
                    result.status === 'success'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  <span className="font-mono">{result.filename}</span>
                  <div className="flex items-center gap-1">
                    {result.status === 'success' ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    <span className="capitalize">{result.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {results.summary.successful > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  ✅ Audio files are now available in your Supabase storage bucket: <code>voice-demo-audio</code>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  The voice demo will automatically use these files when users click "Try Personal AI Tour Guide"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};