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
import { ArrowRight } from "lucide-react"

interface SearchControlProps {
  landmarks: Landmark[]
  onSelectLandmark: (landmark: Landmark) => void
}

// Top 100 most visited landmarks around the world
const TOP_LANDMARKS = [
  "Eiffel Tower, Paris", "Times Square, New York", "Great Wall of China", "Statue of Liberty, New York",
  "Big Ben, London", "Machu Picchu, Peru", "Taj Mahal, India", "Colosseum, Rome", "Christ the Redeemer, Brazil",
  "Sydney Opera House, Australia", "Golden Gate Bridge, San Francisco", "Stonehenge, England",
  "Petra, Jordan", "Tower Bridge, London", "Sagrada Familia, Barcelona", "Neuschwanstein Castle, Germany",
  "Mount Rushmore, USA", "CN Tower, Toronto", "Buckingham Palace, London", "Empire State Building, New York",
  "Notre-Dame Cathedral, Paris", "Pyramids of Giza, Egypt", "Niagara Falls", "Burj Khalifa, Dubai",
  "Leaning Tower of Pisa, Italy", "Red Square, Moscow", "Brandenburg Gate, Berlin", "Acropolis, Athens",
  "Chichen Itza, Mexico", "Easter Island Statues, Chile", "Mount Fuji, Japan", "Angkor Wat, Cambodia",
  "Westminster Abbey, London", "Space Needle, Seattle", "Liberty Bell, Philadelphia", "Louvre Museum, Paris",
  "Vatican City", "Parthenon, Athens", "Forbidden City, Beijing", "London Eye, London",
  "Arc de Triomphe, Paris", "Alhambra, Spain", "St. Basil's Cathedral, Moscow", "Table Mountain, South Africa",
  "Uluru, Australia", "Santorini, Greece", "Mont-Saint-Michel, France", "Hagia Sophia, Istanbul",
  "Blue Mosque, Istanbul", "Prague Castle, Czech Republic", "Neuschwanstein Castle, Germany",
  "Palace of Versailles, France", "Edinburgh Castle, Scotland", "Windsor Castle, England",
  "Château de Chambord, France", "Alcatraz Island, San Francisco", "Mount Everest Base Camp, Nepal",
  "Victoria Falls, Zambia/Zimbabwe", "Giant's Causeway, Ireland", "Cliffs of Moher, Ireland",
  "Milford Sound, New Zealand", "Banff National Park, Canada", "Grand Canyon, USA", "Yellowstone National Park, USA",
  "Yosemite National Park, USA", "Zion National Park, USA", "Bryce Canyon, USA", "Death Valley, USA",
  "Monument Valley, USA", "Antelope Canyon, USA", "Horseshoe Bend, USA", "Arches National Park, USA",
  "Great Barrier Reef, Australia", "Blue Hole, Belize", "Galápagos Islands, Ecuador", "Iguazu Falls, Argentina/Brazil",
  "Angel Falls, Venezuela", "Salar de Uyuni, Bolivia", "Torres del Paine, Chile", "Rio de Janeiro, Brazil",
  "Copacabana Beach, Brazil", "Ipanema Beach, Brazil", "Sugarloaf Mountain, Brazil", "Corcovado, Brazil",
  "Ushuaia, Argentina", "Patagonia, Argentina/Chile", "Mendoza, Argentina", "Buenos Aires, Argentina",
  "Machu Picchu, Peru", "Cusco, Peru", "Lima, Peru", "Nazca Lines, Peru", "Lake Titicaca, Peru/Bolivia",
  "La Paz, Bolivia", "Atacama Desert, Chile", "Santiago, Chile", "Valparaíso, Chile", "Easter Island, Chile",
  "Cartagena, Colombia", "Bogotá, Colombia", "Medellín, Colombia", "Quito, Ecuador", "Galápagos Islands, Ecuador",
  "Caracas, Venezuela", "Georgetown, Guyana", "Paramaribo, Suriname", "Cayenne, French Guiana"
];

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
    onSelectLandmark(landmark)
    setOpen(false)
  }

  const handleTopLandmarkSelect = (landmarkName: string) => {
    // Create a temporary landmark object for top landmarks
    const tempLandmark: Landmark = {
      id: `temp-${Date.now()}`,
      name: landmarkName,
      coordinates: [0, 0], // Default coordinates [longitude, latitude]
      description: `Explore ${landmarkName} - one of the world's most visited landmarks`
    };
    onSelectLandmark(tempLandmark)
    setOpen(false)
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
            {TOP_LANDMARKS.map((landmarkName, index) => (
              <CommandItem
                key={`top-${index}`}
                onSelect={() => handleTopLandmarkSelect(landmarkName)}
                className="cursor-pointer"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                <span>{landmarkName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

export default SearchControl
