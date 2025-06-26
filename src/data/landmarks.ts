
export interface Landmark {
  id: string;
  name: string;
  coordinates: [number, number];
  location: {
    lat: number;
    lng: number;
  };
  description: string;
  placeId?: string;
}

export const landmarks: Landmark[] = [
  {
    id: "eiffel-tower",
    name: "Eiffel Tower",
    coordinates: [2.2945, 48.8584],
    location: { lat: 48.8584, lng: 2.2945 },
    description: "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower. It has become a global cultural icon of France and one of the most recognizable structures in the world."
  },
  {
    id: "statue-of-liberty",
    name: "Statue of Liberty",
    coordinates: [-74.0445, 40.6892],
    location: { lat: 40.6892, lng: -74.0445 },
    description: "The Statue of Liberty is a colossal neoclassical sculpture on Liberty Island in New York Harbor in New York City, in the United States. The copper statue, a gift from the people of France, was designed by French sculptor Frédéric Auguste Bartholdi and its metal framework was built by Gustave Eiffel."
  },
  {
    id: "great-wall-of-china",
    name: "Great Wall of China",
    coordinates: [116.5704, 40.4319],
    location: { lat: 40.4319, lng: 116.5704 },
    description: "The Great Wall of China is a series of fortifications that were built across the historical northern borders of ancient Chinese states and Imperial China as protection against various nomadic groups from the Eurasian Steppe. It is the longest structure ever built by humans."
  },
  {
    id: "pyramids-of-giza",
    name: "Pyramids of Giza",
    coordinates: [31.1342, 29.9792],
    location: { lat: 29.9792, lng: 31.1342 },
    description: "The Giza pyramid complex, is the site on the Giza Plateau in Greater Cairo, Egypt that includes the Great Pyramid of Giza, the Pyramid of Khafre, and the Pyramid of Menkaure, along with their associated pyramid complexes and the Great Sphinx of Giza. All were built during the Fourth Dynasty of the Old Kingdom of Ancient Egypt."
  },
  {
    id: "colosseum",
    name: "Colosseum",
    coordinates: [12.4922, 41.8902],
    location: { lat: 41.8902, lng: 12.4922 },
    description: "The Colosseum is an oval amphitheatre in the centre of the city of Rome, Italy, just east of the Roman Forum. It is the largest ancient amphitheatre ever built, and is still the largest standing amphitheatre in the world today, despite its age. Construction began under the emperor Vespasian in 72 AD and was completed in 80 AD under his successor and heir, Titus."
  }
];
