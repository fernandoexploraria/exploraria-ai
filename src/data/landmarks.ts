
export interface Landmark {
  id: string;
  name: string;
  description: string;
  coordinates: [number, number];
  rating?: number;
  photos?: string[];
  types?: string[];
  placeId?: string;
  formattedAddress?: string;
  tourId?: string; // 🔥 NEW: Optional tour_id for database-linked landmarks
}

export interface EnhancedLandmark extends Landmark {
  placeId?: string;
  coordinateSource: string;
  confidence: number;
  rating?: number;
  photos?: string[];
  types?: string[];
  formattedAddress?: string;
}

export const landmarks: Landmark[] = [
  {
    id: 'bellas-artes',
    name: 'Palacio de Bellas Artes',
    description: 'A prominent cultural center in Mexico City.',
    coordinates: [-99.1353, 19.4373],
    rating: 4.5,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Palacio_de_Bellas_Artes_Mexico_City.jpg/1280px-Palacio_de_Bellas_Artes_Mexico_City.jpg'
    ],
    types: ['museum', 'point_of_interest', 'establishment']
  },
  {
    id: 'zocalo',
    name: 'Zócalo',
    description: 'The main central square in Mexico City.',
    coordinates: [-99.1328, 19.4326],
    rating: 4.6,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Mexico_City_Zocalo_March_2018_01.jpg/1280px-Mexico_City_Zocalo_March_2018_01.jpg'
    ],
    types: ['tourist_attraction', 'point_of_interest', 'establishment']
  },
  {
    id: 'chapultepec-park',
    name: 'Chapultepec Park',
    description: 'One of the largest city parks in the Western Hemisphere, featuring museums, gardens, and a zoo.',
    coordinates: [-99.1944, 19.4189],
    rating: 4.7,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Lago_de_Chapultepec.jpg/1280px-Lago_de_Chapultepec.jpg'
    ],
    types: ['park', 'tourist_attraction', 'point_of_interest', 'establishment']
  },
  {
    id: 'coyoacan',
    name: 'Coyoacán',
    description: 'A historic neighborhood known for its cobblestone streets, colonial architecture, and Frida Kahlo Museum.',
    coordinates: [-99.1617, 19.3539],
    rating: 4.7,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Coyoacan_Mexico_City_October_2016-1a.jpg/1280px-Coyoacan_Mexico_City_October_2016-1a.jpg'
    ],
    types: ['neighborhood', 'point_of_interest', 'establishment']
  },
  {
    id: 'teotihuacan',
    name: 'Teotihuacan',
    description: 'An ancient Mesoamerican city known for its pyramids.',
    coordinates: [-98.8497, 19.6944],
    rating: 4.8,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Teotihuacan_pyramids.jpg/1280px-Teotihuacan_pyramids.jpg'
    ],
    types: ['historical_landmark', 'tourist_attraction', 'point_of_interest', 'establishment']
  },
  {
    id: 'xochimilco',
    name: 'Xochimilco',
    description: 'Known for its canals and colorful boats called trajineras.',
    coordinates: [-99.1056, 19.2550],
    rating: 4.6,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Chinampas_de_Xochimilco_M%C3%A9xico.jpg/1280px-Chinampas_de_Xochimilco_M%C3%A9xico.jpg'
    ],
    types: ['tourist_attraction', 'point_of_interest', 'establishment']
  },
  {
    id: 'museo-nacional-antropologia',
    name: 'Museo Nacional de Antropología',
    description: 'One of the most comprehensive anthropology museums in the world.',
    coordinates: [-99.1878, 19.4258],
    rating: 4.8,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Museo_Nacional_de_Antropolog%C3%ADa%2C_M%C3%A9xico_City_01.jpg/1280px-Museo_Nacional_de_Antropolog%C3%ADa%2C_M%C3%A9xico_City_01.jpg'
    ],
    types: ['museum', 'point_of_interest', 'establishment']
  },
  {
    id: 'castillo-de-chapultepec',
    name: 'Castillo de Chapultepec',
    description: 'A castle located on top of Chapultepec Hill, offering panoramic views and historical exhibits.',
    coordinates: [-99.1906, 19.4158],
    rating: 4.7,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Chapultepec_Castle_Exterior.jpg/1280px-Chapultepec_Castle_Exterior.jpg'
    ],
    types: ['castle', 'museum', 'point_of_interest', 'establishment']
  },
  {
    id: 'templo-mayor',
    name: 'Templo Mayor',
    description: 'The main temple of the Aztec capital, now an archaeological site.',
    coordinates: [-99.1308, 19.4353],
    rating: 4.5,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Templo_Mayor_at_night.jpg/1280px-Templo_Mayor_at_night.jpg'
    ],
    types: ['archaeological_site', 'museum', 'point_of_interest', 'establishment']
  },
  {
    id: 'parque-mexico',
    name: 'Parque México',
    description: 'A beautiful park in the Condesa neighborhood, known for its Art Deco design.',
    coordinates: [-99.1736, 19.4117],
    rating: 4.7,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Parque_M%C3%A9xico_Fuente_de_los_Coyotes_2018-03-24.jpg/1280px-Parque_M%C3%A9xico_Fuente_de_los_Coyotes_2018-03-24.jpg'
    ],
    types: ['park', 'point_of_interest', 'establishment']
  }
];
