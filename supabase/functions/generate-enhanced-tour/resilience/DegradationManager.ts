
export interface DegradationPolicy {
  level: number;
  name: string;
  description: string;
  enabledServices: string[];
  qualityThreshold: number;
  timeoutMs: number;
}

export interface ServiceHealth {
  serviceName: string;
  isHealthy: boolean;
  responseTimeMs: number;
  successRate: number;
  lastCheckTime: number;
  consecutiveFailures: number;
}

export class DegradationManager {
  private static readonly DEGRADATION_LEVELS: DegradationPolicy[] = [
    {
      level: 0,
      name: 'FULL_SERVICE',
      description: 'All services available with full quality',
      enabledServices: ['places', 'geocoding', 'gemini', 'streetview'],
      qualityThreshold: 0.9,
      timeoutMs: 10000
    },
    {
      level: 1,
      name: 'REDUCED_QUALITY',
      description: 'Reduced API calls and shorter timeouts',
      enabledServices: ['places', 'geocoding', 'gemini'],
      qualityThreshold: 0.7,
      timeoutMs: 7000
    },
    {
      level: 2,
      name: 'ESSENTIAL_ONLY',
      description: 'Only essential coordinate services',
      enabledServices: ['places', 'geocoding'],
      qualityThreshold: 0.5,
      timeoutMs: 5000
    },
    {
      level: 3,
      name: 'CACHE_ONLY',
      description: 'Use cached data and fallback coordinates',
      enabledServices: ['cache'],
      qualityThreshold: 0.3,
      timeoutMs: 2000
    },
    {
      level: 4,
      name: 'MINIMAL_SERVICE',
      description: 'Basic landmark list without coordinates',
      enabledServices: [],
      qualityThreshold: 0.1,
      timeoutMs: 1000
    }
  ];

  private static currentLevel: number = 0;
  private static serviceHealth: Map<string, ServiceHealth> = new Map();
  private static cache: Map<string, any> = new Map();

  static getCurrentPolicy(): DegradationPolicy {
    return this.DEGRADATION_LEVELS[this.currentLevel];
  }

  static updateServiceHealth(serviceName: string, isSuccess: boolean, responseTimeMs: number): void {
    const current = this.serviceHealth.get(serviceName) || {
      serviceName,
      isHealthy: true,
      responseTimeMs: 0,
      successRate: 1.0,
      lastCheckTime: Date.now(),
      consecutiveFailures: 0
    };

    current.lastCheckTime = Date.now();
    current.responseTimeMs = responseTimeMs;

    if (isSuccess) {
      current.consecutiveFailures = 0;
      current.isHealthy = true;
      // Update success rate with exponential moving average
      current.successRate = current.successRate * 0.9 + 0.1;
    } else {
      current.consecutiveFailures++;
      current.isHealthy = current.consecutiveFailures < 3;
      current.successRate = current.successRate * 0.9;
    }

    this.serviceHealth.set(serviceName, current);
    this.evaluateDegradationLevel();
  }

  private static evaluateDegradationLevel(): void {
    const healthyServices = Array.from(this.serviceHealth.values())
      .filter(health => health.isHealthy);
    
    const overallHealth = healthyServices.length / Math.max(this.serviceHealth.size, 1);
    const avgResponseTime = Array.from(this.serviceHealth.values())
      .reduce((sum, health) => sum + health.responseTimeMs, 0) / Math.max(this.serviceHealth.size, 1);

    let newLevel = 0;

    if (overallHealth < 0.3 || avgResponseTime > 15000) {
      newLevel = 4; // MINIMAL_SERVICE
    } else if (overallHealth < 0.5 || avgResponseTime > 10000) {
      newLevel = 3; // CACHE_ONLY
    } else if (overallHealth < 0.7 || avgResponseTime > 7000) {
      newLevel = 2; // ESSENTIAL_ONLY
    } else if (overallHealth < 0.9 || avgResponseTime > 5000) {
      newLevel = 1; // REDUCED_QUALITY
    }

    if (newLevel !== this.currentLevel) {
      console.log(`🔄 Degradation level changing from ${this.currentLevel} (${this.DEGRADATION_LEVELS[this.currentLevel].name}) to ${newLevel} (${this.DEGRADATION_LEVELS[newLevel].name})`);
      this.currentLevel = newLevel;
    }
  }

  static isServiceEnabled(serviceName: string): boolean {
    const policy = this.getCurrentPolicy();
    return policy.enabledServices.includes(serviceName);
  }

  static getTimeoutForService(serviceName: string): number {
    const policy = this.getCurrentPolicy();
    return policy.timeoutMs;
  }

  static getCachedResult(key: string): any {
    return this.cache.get(key);
  }

  static setCachedResult(key: string, value: any, ttlMs: number = 3600000): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  static clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (cached.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  static getSystemHealth(): {
    level: number;
    policy: DegradationPolicy;
    services: ServiceHealth[];
    cacheSize: number;
  } {
    return {
      level: this.currentLevel,
      policy: this.getCurrentPolicy(),
      services: Array.from(this.serviceHealth.values()),
      cacheSize: this.cache.size
    };
  }

  static forceLevel(level: number): void {
    if (level >= 0 && level < this.DEGRADATION_LEVELS.length) {
      this.currentLevel = level;
      console.log(`🔧 Forced degradation level to ${level} (${this.DEGRADATION_LEVELS[level].name})`);
    }
  }
}
