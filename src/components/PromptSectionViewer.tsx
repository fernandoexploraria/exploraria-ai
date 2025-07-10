import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface PromptSectionViewerProps {
  prompt: string;
}

interface PromptSection {
  title: string;
  content: string;
  type: 'text' | 'json' | 'list';
}

export const PromptSectionViewer: React.FC<PromptSectionViewerProps> = ({ prompt }) => {
  const parsePromptIntoSections = (promptText: string): PromptSection[] => {
    if (!promptText.trim()) {
      return [];
    }

    const lines = promptText.split('\n');
    const sections: PromptSection[] = [];
    
    // Helper function to find content between markers
    const findSection = (startMarker: string, endMarker?: string) => {
      const startIndex = lines.findIndex(line => line.includes(startMarker));
      if (startIndex === -1) return '';
      
      let endIndex = lines.length;
      if (endMarker) {
        endIndex = lines.findIndex((line, index) => index > startIndex && line.includes(endMarker));
        if (endIndex === -1) endIndex = lines.length;
      }
      
      return lines.slice(startIndex, endIndex).join('\n');
    };

    // 1. Agent Persona & Role Definition
    const personaContent = lines.slice(0, 3).join('\n');
    sections.push({
      title: 'Agent Persona & Role Definition',
      content: personaContent,
      type: 'text'
    });

    // 2. Core Mission & Behavioral Principles
    const missionContent = findSection('**Your Core Mission:**', '**Tour Destination Overview');
    sections.push({
      title: 'Core Mission & Behavioral Principles',
      content: missionContent,
      type: 'list'
    });

    // 3. Primary Tour Destination Overview (Static Data)
    const destinationContent = findSection('**Tour Destination Overview (Structured Data):**', '**Key Landmarks for this Tour');
    sections.push({
      title: 'Primary Tour Destination Overview (Static Data)',
      content: destinationContent,
      type: 'json'
    });

    // 4. Pre-identified Key Landmarks for this Tour (Static Data)
    const landmarksContent = findSection('**Key Landmarks for this Tour (Structured Initial Discovery):**', '**Function Calling Instructions');
    sections.push({
      title: 'Pre-identified Key Landmarks for this Tour (Static Data)',
      content: landmarksContent,
      type: 'json'
    });

    // 5. General Function Calling Instructions
    const functionsIntroContent = findSection('**Function Calling Instructions for Real-time Place Information:**', '**Available Tools and Their Triggers:**');
    sections.push({
      title: 'General Function Calling Instructions',
      content: functionsIntroContent,
      type: 'text'
    });

    // 6. Available Tools & Trigger Definitions
    const toolsContent = findSection('**Available Tools and Their Triggers:**', '**Grounding Instructions:**');
    sections.push({
      title: 'Available Tools & Trigger Definitions',
      content: toolsContent,
      type: 'list'
    });

    // 7. Data Grounding & Prioritization Instructions
    const groundingContent = findSection('**Grounding Instructions:**', '**Real-time Location Awareness');
    sections.push({
      title: 'Data Grounding & Prioritization Instructions',
      content: groundingContent,
      type: 'list'
    });

    // 8. Real-time Location Awareness & Dynamic POI Discovery
    const locationAwarenessContent = findSection('**Real-time Location Awareness & Integration (Dynamic Discoveries):**', '**Your Protocol for Handling Nearby POIs:**');
    sections.push({
      title: 'Real-time Location Awareness & Dynamic POI Discovery',
      content: locationAwarenessContent,
      type: 'text'
    });

    // 9. Protocol for Handling Dynamic POI Discoveries
    const protocolContent = findSection('**Your Protocol for Handling Nearby POIs:**');
    sections.push({
      title: 'Protocol for Handling Dynamic POI Discoveries',
      content: protocolContent,
      type: 'list'
    });

    return sections.filter(section => section.content.trim().length > 0);
  };

  const sections = parsePromptIntoSections(prompt);

  const formatContent = (content: string, type: string) => {
    // Remove excessive line breaks and clean up formatting
    const cleaned = content.replace(/\n{3,}/g, '\n\n').trim();
    
    if (type === 'json') {
      // Extract JSON blocks and format them
      const jsonMatches = cleaned.match(/```json\n([\s\S]*?)\n```/g);
      if (jsonMatches) {
        return (
          <div className="space-y-4">
            {cleaned.split('```json').map((part, index) => {
              if (index === 0) {
                return part.trim() && <p key={index} className="text-sm">{part.trim()}</p>;
              }
              
              const [jsonPart, ...restParts] = part.split('```');
              return (
                <div key={index} className="space-y-2">
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                      {jsonPart.trim()}
                    </pre>
                  </div>
                  {restParts.length > 0 && restParts.join('```').trim() && (
                    <p className="text-sm">{restParts.join('```').trim()}</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      }
    }
    
    if (type === 'list') {
      // Format bullet points and numbered lists
      const lines = cleaned.split('\n').filter(line => line.trim());
      return (
        <div className="space-y-2">
          {lines.map((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('*') || trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
              return (
                <div key={index} className="text-sm pl-4 border-l-2 border-primary/20">
                  {trimmed.replace(/^[*\-\d\.]\s*/, '')}
                </div>
              );
            } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
              return (
                <h4 key={index} className="font-semibold text-sm mt-3 mb-1">
                  {trimmed.slice(2, -2)}
                </h4>
              );
            }
            return trimmed && <p key={index} className="text-sm">{trimmed}</p>;
          })}
        </div>
      );
    }
    
    // Default text formatting
    return (
      <div className="space-y-2">
        {cleaned.split('\n\n').map((paragraph, index) => (
          paragraph.trim() && (
            <p key={index} className="text-sm whitespace-pre-wrap">
              {paragraph.trim()}
            </p>
          )
        ))}
      </div>
    );
  };

  if (sections.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No prompt generated yet. Complete the previous steps to see the AI personality sections.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {sections.map((section, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {index + 1}
              </Badge>
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-64 overflow-y-auto">
              {formatContent(section.content, section.type)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};