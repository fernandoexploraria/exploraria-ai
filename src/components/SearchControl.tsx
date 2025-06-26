
import * as React from "react"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Landmark } from "@/data/landmarks"
import { TOP_LANDMARKS } from "@/data/topLandmarks"
import { ArrowRight } from "lucide-react"
import { validateAndNormalizeLandmark } from "@/utils/landmarkUtils"

interface SearchControlProps {
  landmarks: Landmark[]
  onSelectLandmark: (landmark: Landmark) => void
}

const SearchControl: React.FC<SearchControlProps> = ({ landmarks, onSelectLandmark }) => {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleSelect = (landmark: Landmark) => {
    // Validate landmark before selecting
    const validatedLandmark = validateAndNormalizeLandmark(landmark);
    if (validatedLandmark) {
      onSelectLandmark(validatedLandmark);
      setOpen(false);
    } else {
      console.warn('Invalid landmark selected:', landmark);
    }
  }

  const handleTopLandmarkSelect = (topLandmark: any) => {
    // Create a temporary landmark object for top landmarks
    const tempLandmark = {
      id: `top-${Date.now()}`,
      name: topLandmark.name,
      coordinates: topLandmark.coordinates,
      description: topLandmark.description
    };
    
    // Validate before selecting
    const validatedLandmark = validateAndNormalizeLandmark(tempLandmark);
    if (validatedLandmark) {
      onSelectLandmark(validatedLandmark);
      setOpen(false);
    } else {
      console.warn('Invalid top landmark selected:', topLandmark);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="bg-background/80 backdrop-blur-sm shadow-lg"
        onClick={() => setOpen(true)}
      >
        <span className="mr-2 hidden sm:inline">Search destination...</span>
        <span className="mr-2 sm:hidden">Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Where to?" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {landmarks.length > 0 && (
            <CommandGroup heading="Your Destinations">
              {landmarks.map((landmark) => (
                <CommandItem
                  key={landmark.id}
                  onSelect={() => handleSelect(landmark)}
                  className="cursor-pointer"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  <span>{landmark.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Top 100 World Landmarks">
            {TOP_LANDMARKS.map((topLandmark, index) => (
              <CommandItem
                key={`top-${index}`}
                onSelect={() => handleTopLandmarkSelect(topLandmark)}
                className="cursor-pointer"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                <span>{topLandmark.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

export default SearchControl
