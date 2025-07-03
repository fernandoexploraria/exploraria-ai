import { GracePeriodState, ProximitySettings } from '@/types/proximityAlerts';

// Grace Period History Entry
export interface GracePeriodHistoryEntry {
  id: string;
  timestamp: number;
  action: 'activated' | 'cleared' | 'expired' | 'overridden';
  reason?: GracePeriodState['gracePeriodReason'];
  duration?: number;
  trigger: 'automatic' | 'manual' | 'debug' | 'system';
  context?: {
    movementDistance?: number;
    backgroundDuration?: number;
    preset?: string;
    userLocation?: { latitude: number; longitude: number };
  };
  performance?: {
    effectiveness: 'high' | 'medium' | 'low';
    userSatisfaction?: number; // 1-5 scale
    preventedFalseAlerts?: number;
  };
}

// Performance Metrics
export interface GracePeriodMetrics {
  totalActivations: number;
  totalClears: number;
  totalExpired: number;
  averageDuration: number;
  effectivenessRate: number;
  reasonBreakdown: Record<string, number>;
  triggerBreakdown: Record<string, number>;
  recentActivity: GracePeriodHistoryEntry[];
}

class GracePeriodHistoryManager {
  private static instance: GracePeriodHistoryManager;
  private history: GracePeriodHistoryEntry[] = [];
  private maxHistorySize = 100;
  private storageKey = 'grace_period_history';

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): GracePeriodHistoryManager {
    if (!GracePeriodHistoryManager.instance) {
      GracePeriodHistoryManager.instance = new GracePeriodHistoryManager();
    }
    return GracePeriodHistoryManager.instance;
  }

  // Add a new history entry
  addEntry(entry: Omit<GracePeriodHistoryEntry, 'id' | 'timestamp'>): void {
    const historyEntry: GracePeriodHistoryEntry = {
      id: `gp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...entry
    };

    this.history.unshift(historyEntry);
    
    // Keep only the most recent entries
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    this.saveToStorage();
    
    console.log('📊 Grace Period History Entry Added:', historyEntry);
  }

  // Get recent history
  getRecentHistory(limit: number = 10): GracePeriodHistoryEntry[] {
    return this.history.slice(0, limit);
  }

  // Get full history
  getFullHistory(): GracePeriodHistoryEntry[] {
    return [...this.history];
  }

  // Get metrics
  getMetrics(): GracePeriodMetrics {
    const totalActivations = this.history.filter(h => h.action === 'activated').length;
    const totalClears = this.history.filter(h => h.action === 'cleared').length;
    const totalExpired = this.history.filter(h => h.action === 'expired').length;
    
    // Calculate average duration for completed grace periods
    const completedPeriods = this.history.filter(h => h.duration);
    const averageDuration = completedPeriods.length > 0 
      ? completedPeriods.reduce((sum, h) => sum + (h.duration || 0), 0) / completedPeriods.length
      : 0;

    // Calculate effectiveness rate (natural expiry vs manual clearing)
    const effectivenessRate = totalExpired + totalClears > 0 
      ? (totalExpired / (totalExpired + totalClears)) * 100
      : 0;

    // Reason breakdown
    const reasonBreakdown: Record<string, number> = {};
    this.history.forEach(entry => {
      if (entry.reason) {
        reasonBreakdown[entry.reason] = (reasonBreakdown[entry.reason] || 0) + 1;
      }
    });

    // Trigger breakdown
    const triggerBreakdown: Record<string, number> = {};
    this.history.forEach(entry => {
      triggerBreakdown[entry.trigger] = (triggerBreakdown[entry.trigger] || 0) + 1;
    });

    return {
      totalActivations,
      totalClears,
      totalExpired,
      averageDuration,
      effectivenessRate,
      reasonBreakdown,
      triggerBreakdown,
      recentActivity: this.getRecentHistory(5)
    };
  }

  // Clear history
  clearHistory(): void {
    this.history = [];
    this.saveToStorage();
    console.log('🗑️ Grace Period History Cleared');
  }

  // Get history for a specific time range
  getHistoryByTimeRange(startTime: number, endTime: number): GracePeriodHistoryEntry[] {
    return this.history.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  // Get history by reason
  getHistoryByReason(reason: GracePeriodState['gracePeriodReason']): GracePeriodHistoryEntry[] {
    return this.history.filter(entry => entry.reason === reason);
  }

  // Get history by trigger type
  getHistoryByTrigger(trigger: GracePeriodHistoryEntry['trigger']): GracePeriodHistoryEntry[] {
    return this.history.filter(entry => entry.trigger === trigger);
  }

  // Export history for analysis
  exportHistory(): string {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      totalEntries: this.history.length,
      metrics: this.getMetrics(),
      history: this.history
    }, null, 2);
  }

  // Import history
  importHistory(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.history && Array.isArray(parsed.history)) {
        this.history = parsed.history;
        this.saveToStorage();
        console.log('📥 Grace Period History Imported:', parsed.totalEntries, 'entries');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to import grace period history:', error);
      return false;
    }
  }

  // Performance analysis
  analyzePerformance(): {
    summary: string;
    recommendations: string[];
    trends: Record<string, number>;
  } {
    const metrics = this.getMetrics();
    const recent = this.getRecentHistory(20);
    
    const summary = `
Grace Period Performance Analysis:
- Total Activations: ${metrics.totalActivations}
- Effectiveness Rate: ${metrics.effectivenessRate.toFixed(1)}%
- Average Duration: ${(metrics.averageDuration / 1000).toFixed(1)}s
- Most Common Reason: ${Object.entries(metrics.reasonBreakdown)
  .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
    `.trim();

    const recommendations: string[] = [];
    
    if (metrics.effectivenessRate < 70) {
      recommendations.push("Consider increasing grace period durations - many are being manually cleared");
    }
    
    if (metrics.reasonBreakdown.movement > metrics.totalActivations * 0.6) {
      recommendations.push("High movement-triggered activations - consider adjusting movement threshold");
    }
    
    if (metrics.averageDuration > 20000) {
      recommendations.push("Grace periods may be too long - consider shorter durations for better UX");
    }

    const trends: Record<string, number> = {};
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    trends.last24h = this.getHistoryByTimeRange(dayAgo, now).length;
    trends.lastWeek = this.getHistoryByTimeRange(weekAgo, now).length;
    trends.activationRate = trends.last24h / 24; // per hour

    return { summary, recommendations, trends };
  }

  // Private methods
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        version: 1,
        history: this.history.slice(0, 50) // Save only recent entries
      }));
    } catch (error) {
      console.error('❌ Failed to save grace period history:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.history && Array.isArray(parsed.history)) {
          this.history = parsed.history;
          console.log('📥 Loaded grace period history:', this.history.length, 'entries');
        }
      }
    } catch (error) {
      console.error('❌ Failed to load grace period history:', error);
      this.history = [];
    }
  }
}

// Export singleton instance
export const gracePeriodHistory = GracePeriodHistoryManager.getInstance();

// Convenience functions
export const trackGracePeriodActivation = (
  reason: GracePeriodState['gracePeriodReason'],
  trigger: GracePeriodHistoryEntry['trigger'] = 'automatic',
  context?: GracePeriodHistoryEntry['context']
) => {
  gracePeriodHistory.addEntry({
    action: 'activated',
    reason,
    trigger,
    context
  });
};

export const trackGracePeriodClear = (
  trigger: GracePeriodHistoryEntry['trigger'] = 'automatic',
  duration?: number
) => {
  gracePeriodHistory.addEntry({
    action: 'cleared',
    trigger,
    duration
  });
};

export const trackGracePeriodExpiry = (
  reason: GracePeriodState['gracePeriodReason'],
  duration: number
) => {
  gracePeriodHistory.addEntry({
    action: 'expired',
    reason,
    trigger: 'automatic',
    duration
  });
};
