
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Instagram, Copy, Loader2 } from 'lucide-react';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';
import { toast } from 'sonner';
import { Landmark } from '@/data/landmarks';

interface InstagramCaptionGeneratorProps {
  landmark: Landmark;
}

const InstagramCaptionGenerator: React.FC<InstagramCaptionGeneratorProps> = ({ landmark }) => {
  const [caption, setCaption] = useState<string>('');
  const { callGemini, isLoading } = useGeminiAPI();

  const generateCaption = async () => {
    const prompt = `Create an engaging Instagram caption for a travel photo taken at ${landmark.name}. 

    Include:
    - A captivating opening line about the experience
    - Interesting facts about ${landmark.name}
    - Relevant travel hashtags (mix of popular and location-specific)
    - A call-to-action or question for engagement
    - Keep it under 150 words
    
    Location description: ${landmark.description}
    
    Make it authentic, inspiring, and Instagram-ready!`;

    const systemInstruction = "You are a social media expert who specializes in creating engaging Instagram captions for travel content. Write captions that are authentic, inspiring, and designed to get high engagement.";

    const response = await callGemini(prompt, systemInstruction);
    
    if (response) {
      setCaption(response);
      toast.success("Instagram caption generated!");
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Caption copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy caption");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Instagram className="h-5 w-5" />
          Instagram Caption Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={generateCaption} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Instagram className="mr-2 h-4 w-4" />
              Generate Caption
            </>
          )}
        </Button>

        {caption && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-sm whitespace-pre-wrap">{caption}</p>
            </div>
            <Button 
              onClick={copyToClipboard}
              variant="outline"
              className="w-full"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy to Clipboard
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstagramCaptionGenerator;
