
import { ProximitySettings } from '@/types/proximityAlerts';
import { supabase } from '@/integrations/supabase/client';

export interface LazyLoadState {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  lastLoadTime: number | null;
}

export class GracePeriodLazyLoader {
  private static instance: GracePeriodLazyLoader;
  private loadState: LazyLoadState = {
    isLoaded: false,
    isLoading: false,
    error: null,
    lastLoadTime: null,
  };
  
  private loadPromise: Promise<ProximitySettings | null> | null = null;
  private settings: ProximitySettings | null = null;
  private subscribers = new Set<(settings: ProximitySettings | null) => void>();

  private constructor() {
    console.log('🚀 [Lazy Loader] Grace period lazy loader initialized');
  }

  static getInstance(): GracePeriodLazyLoader {
    if (!GracePeriodLazyLoader.instance) {
      GracePeriodLazyLoader.instance = new GracePeriodLazyLoader();
    }
    return GracePeriodLazyLoader.instance;
  }

  subscribe(callback: (settings: ProximitySettings | null) => void): () => void {
    this.subscribers.add(callback);
    
    // If already loaded, notify immediately
    if (this.loadState.isLoaded && this.settings) {
      callback(this.settings);
    }
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.settings));
  }

  async loadSettingsIfNeeded(userId: string, force = false): Promise<ProximitySettings | null> {
    console.log('📥 [Lazy Loader] Load requested:', { userId, force, isLoaded: this.loadState.isLoaded });
    
    // Return cached settings if available and not forced
    if (!force && this.loadState.isLoaded && this.settings) {
      console.log('📥 [Lazy Loader] Returning cached settings');
      return this.settings;
    }

    // Return existing promise if already loading
    if (this.loadState.isLoading && this.loadPromise) {
      console.log('📥 [Lazy Loader] Returning existing load promise');
      return this.loadPromise;
    }

    // Start new load operation
    this.loadState.isLoading = true;
    this.loadState.error = null;

    this.loadPromise = this.performLoad(userId);
    
    try {
      const settings = await this.loadPromise;
      this.settings = settings;
      this.loadState.isLoaded = true;
      this.loadState.lastLoadTime = Date.now();
      this.loadState.error = null;
      
      console.log('✅ [Lazy Loader] Settings loaded successfully');
      this.notifySubscribers();
      
      return settings;
    } catch (error) {
      this.loadState.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Lazy Loader] Failed to load settings:', error);
      throw error;
    } finally {
      this.loadState.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async performLoad(userId: string): Promise<ProximitySettings | null> {
    console.log('🔄 [Lazy Loader] Performing database load for user:', userId);
    
    const { data, error } = await supabase
      .from('proximity_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ [Lazy Loader] Database error:', error);
      throw error;
    }

    if (!data) {
      console.log('📭 [Lazy Loader] No settings found for user');
      return null;
    }

    const settings: ProximitySettings = {
      id: data.id,
      user_id: data.user_id,
      is_enabled: data.is_enabled,
      notification_distance: data.notification_distance,
      outer_distance: data.outer_distance,
      card_distance: data.card_distance,
      // Remove initialization_timestamp from database loading - handle in memory only
      initialization_timestamp: undefined,
      grace_period_initialization: data.grace_period_initialization ?? 15000,
      grace_period_movement: data.grace_period_movement ?? 8000,
      grace_period_app_resume: data.grace_period_app_resume ?? 5000,
      significant_movement_threshold: data.significant_movement_threshold ?? 150,
      grace_period_enabled: data.grace_period_enabled ?? true,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    console.log('📥 [Lazy Loader] Loaded settings:', settings);
    return settings;
  }

  updateCachedSettings(settings: ProximitySettings | null): void {
    console.log('🔄 [Lazy Loader] Updating cached settings');
    this.settings = settings;
    this.loadState.isLoaded = true;
    this.loadState.lastLoadTime = Date.now();
    this.notifySubscribers();
  }

  getLoadState(): LazyLoadState {
    return { ...this.loadState };
  }

  getCachedSettings(): ProximitySettings | null {
    return this.settings;
  }

  clearCache(): void {
    console.log('🧹 [Lazy Loader] Clearing cache');
    this.settings = null;
    this.loadState.isLoaded = false;
    this.loadState.lastLoadTime = null;
    this.loadState.error = null;
  }
}

export const gracePeriodLazyLoader = GracePeriodLazyLoader.getInstance();
