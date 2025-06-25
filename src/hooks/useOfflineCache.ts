import { useState, useCallback, useEffect } from 'react';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  version: string;
}

interface OfflineCacheConfig {
  storeName: string;
  maxAge?: number; // in milliseconds
  maxItems?: number;
  version?: string;
}

const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_MAX_ITEMS = 100;
const DEFAULT_VERSION = '1.0';

export const useOfflineCache = <T>(config: OfflineCacheConfig) => {
  const [isSupported, setIsSupported] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  
  const {
    storeName,
    maxAge = DEFAULT_MAX_AGE,
    maxItems = DEFAULT_MAX_ITEMS,
    version = DEFAULT_VERSION
  } = config;

  // Check IndexedDB support
  useEffect(() => {
    const checkSupport = () => {
      const supported = 'indexedDB' in window && window.indexedDB !== null;
      setIsSupported(supported);
      
      if (supported) {
        initDB();
      }
    };

    const initDB = async () => {
      try {
        const request = indexedDB.open(`offline-cache-${storeName}`, 1);
        
        request.onerror = () => {
          console.error('Failed to open IndexedDB');
          setDbReady(false);
        };
        
        request.onsuccess = () => {
          setDbReady(true);
        };
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        };
      } catch (error) {
        console.error('IndexedDB initialization failed:', error);
        setDbReady(false);
      }
    };

    checkSupport();
  }, [storeName]);

  const getDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`offline-cache-${storeName}`, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [storeName]);

  const setItem = useCallback(async (key: string, data: T): Promise<void> => {
    if (!isSupported || !dbReady) return;

    try {
      const db = await getDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const cacheItem: CacheItem<T> & { id: string } = {
        id: key,
        data,
        timestamp: Date.now(),
        version
      };
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(cacheItem);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      // Clean up old items
      await cleanup();
    } catch (error) {
      console.error('Failed to cache item:', error);
    }
  }, [isSupported, dbReady, getDB, storeName, version]);

  const getItem = useCallback(async (key: string): Promise<T | null> => {
    if (!isSupported || !dbReady) return null;

    try {
      const db = await getDB();
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const result = await new Promise<(CacheItem<T> & { id: string }) | undefined>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (!result) return null;
      
      // Check if item is expired
      const age = Date.now() - result.timestamp;
      if (age > maxAge || result.version !== version) {
        await removeItem(key);
        return null;
      }
      
      return result.data;
    } catch (error) {
      console.error('Failed to get cached item:', error);
      return null;
    }
  }, [isSupported, dbReady, getDB, storeName, maxAge, version]);

  const removeItem = useCallback(async (key: string): Promise<void> => {
    if (!isSupported || !dbReady) return;

    try {
      const db = await getDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to remove cached item:', error);
    }
  }, [isSupported, dbReady, getDB, storeName]);

  const cleanup = useCallback(async (): Promise<void> => {
    if (!isSupported || !dbReady) return;

    try {
      const db = await getDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const items = await new Promise<Array<CacheItem<T> & { id: string }>>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      // Remove expired items
      const now = Date.now();
      const itemsToDelete = items.filter(item => 
        now - item.timestamp > maxAge || item.version !== version
      );
      
      // Remove excess items (keep most recent)
      if (items.length > maxItems) {
        const sorted = items.sort((a, b) => b.timestamp - a.timestamp);
        itemsToDelete.push(...sorted.slice(maxItems));
      }
      
      for (const item of itemsToDelete) {
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = store.delete(item.id);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      }
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }, [isSupported, dbReady, getDB, storeName, maxAge, maxItems, version]);

  const clear = useCallback(async (): Promise<void> => {
    if (!isSupported || !dbReady) return;

    try {
      const db = await getDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, [isSupported, dbReady, getDB, storeName]);

  return {
    isSupported,
    isReady: dbReady,
    setItem,
    getItem,
    removeItem,
    cleanup,
    clear
  };
};
