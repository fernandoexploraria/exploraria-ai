
interface ShortUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  type: 'image' | 'audio';
  destination: string;
  createdAt: string;
}

// Use localStorage instead of in-memory storage
const STORAGE_KEY = 'exploraria_short_urls';

const getStoredUrls = (): Map<string, ShortUrl> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Map();
    
    const data = JSON.parse(stored);
    return new Map(Object.entries(data));
  } catch (error) {
    console.error('Error loading stored URLs:', error);
    return new Map();
  }
};

const saveStoredUrls = (urlStore: Map<string, ShortUrl>) => {
  try {
    const data = Object.fromEntries(urlStore);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving URLs to storage:', error);
  }
};

export const createShortUrl = (
  originalUrl: string, 
  type: 'image' | 'audio', 
  destination: string
): string => {
  const urlStore = getStoredUrls();
  
  // Generate a meaningful short code
  const timestamp = Date.now().toString(36);
  const typePrefix = type === 'image' ? 'img' : 'aud';
  const destinationCode = destination.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 3);
  const shortCode = `${typePrefix}-${destinationCode}-${timestamp}`;
  
  const shortUrl: ShortUrl = {
    id: crypto.randomUUID(),
    originalUrl,
    shortCode,
    type,
    destination,
    createdAt: new Date().toISOString()
  };
  
  urlStore.set(shortCode, shortUrl);
  saveStoredUrls(urlStore);
  
  console.log('Created short URL:', { shortCode, originalUrl, type, destination });
  
  // Return a user-friendly URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/media/${shortCode}`;
};

export const resolveShortUrl = (shortCode: string): string | null => {
  const urlStore = getStoredUrls();
  const urlData = urlStore.get(shortCode);
  console.log('Resolving short URL:', { shortCode, found: !!urlData, originalUrl: urlData?.originalUrl });
  return urlData ? urlData.originalUrl : null;
};

export const getShortUrlInfo = (shortCode: string): ShortUrl | null => {
  const urlStore = getStoredUrls();
  const urlData = urlStore.get(shortCode);
  console.log('Getting short URL info:', { shortCode, found: !!urlData, info: urlData });
  return urlData || null;
};
