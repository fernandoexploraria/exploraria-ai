import * as React from "react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Landmark } from "@/data/landmarks";
import { TOP_LANDMARKS } from "@/data/topLandmarks";
import { ArrowRight } from "lucide-react";
import LandmarkEnrichmentTest from "./LandmarkEnrichmentTest";
import { useDemoMode } from "@/hooks/useDemoMode";
interface SearchControlProps {
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
}
const SearchControl: React.FC<SearchControlProps> = ({
  landmarks,
  onSelectLandmark
}) => {
  const [open, setOpen] = React.useState(false);
  const [showEnrichmentTest, setShowEnrichmentTest] = React.useState(false);
  const {
    isDemoMode
  } = useDemoMode();
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  const handleSelect = (landmark: Landmark) => {
    // Remove the fromSearch flag - let the marker click handle everything
    onSelectLandmark(landmark);
    setOpen(false);
  };
  const handleTopLandmarkSelect = (topLandmark: any) => {
    // Create a temporary landmark object for top landmarks
    const tempLandmark: Landmark = {
      id: `top-${Date.now()}`,
      name: topLandmark.name,
      coordinates: topLandmark.coordinates,
      description: topLandmark.description,
      placeId: topLandmark.place_id // Add place_id to enable photo fetching
    };

    // Remove the fromSearch flag - let the marker click handle everything
    onSelectLandmark(tempLandmark);
    setOpen(false);
  };
  return <>
      <div className="flex gap-2">
        <Button variant="outline" className="bg-background/80 backdrop-blur-sm shadow-lg" onClick={() => setOpen(true)}>
          <span className="mr-2 hidden sm:inline">Search destination...</span>
          <span className="mr-2 sm:hidden">Search...</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        
        {/* Conditionally render test button only when demo mode is on */}
        {isDemoMode && <Button variant="secondary" size="sm" onClick={() => setShowEnrichmentTest(!showEnrichmentTest)} className="text-xs">
            {showEnrichmentTest ? 'Hide' : 'Test'} Enrichment
          </Button>}
      </div>

      {/* Repositioned enrichment test component to top-right - only shown in demo mode */}
      {isDemoMode && showEnrichmentTest && <div className="fixed top-4 right-4 z-50 w-96 max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg">
          <LandmarkEnrichmentTest />
        </div>}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Where to?" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {landmarks.length > 0 && <CommandGroup heading="Your Destinations">
              {landmarks.map(landmark => <CommandItem key={landmark.id} onSelect={() => handleSelect(landmark)} className="cursor-pointer">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  <span>{landmark.name}</span>
                </CommandItem>)}
            </CommandGroup>}
          <CommandGroup heading="Top 100 World Landmarks">
            {TOP_LANDMARKS.map((topLandmark, index) => <CommandItem key={`top-${index}`} onSelect={() => handleTopLandmarkSelect(topLandmark)} className="cursor-pointer">
                <ArrowRight className="mr-2 h-4 w-4" />
                <span>{topLandmark.name}</span>
              </CommandItem>)}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>;
};
export default SearchControl;