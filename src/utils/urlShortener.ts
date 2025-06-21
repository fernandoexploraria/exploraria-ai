
interface ShortUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  type: 'image' | 'audio';
  destination: string;
  createdAt: string;
}

// In-memory storage for demo - in production you'd use a database
const urlStore = new Map<string, ShortUrl>();

export const createShortUrl = (
  originalUrl: string, 
  type: 'image' | 'audio', 
  destination: string
): string => {
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
  
  // Return a user-friendly URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/media/${shortCode}`;
};

export const resolveShortUrl = (shortCode: string): string | null => {
  const urlData = urlStore.get(shortCode);
  return urlData ? urlData.originalUrl : null;
};

export const getShortUrlInfo = (shortCode: string): ShortUrl | null => {
  return urlStore.get(shortCode) || null;
};
