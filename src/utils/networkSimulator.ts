
export interface NetworkCondition {
  type: '2g' | '3g' | '4g' | '5g' | 'wifi' | 'offline';
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
}

export const NETWORK_CONDITIONS: Record<string, NetworkCondition> = {
  'offline': {
    type: 'offline',
    effectiveType: 'slow-2g',
    downlink: 0,
    rtt: 0,
    saveData: true
  },
  'slow-2g': {
    type: '2g',
    effectiveType: 'slow-2g',
    downlink: 0.05,
    rtt: 2000,
    saveData: true
  },
  '2g': {
    type: '2g',
    effectiveType: '2g',
    downlink: 0.25,
    rtt: 1400,
    saveData: true
  },
  '3g': {
    type: '3g',
    effectiveType: '3g',
    downlink: 0.7,
    rtt: 400,
    saveData: false
  },
  '4g': {
    type: '4g',
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  },
  'wifi': {
    type: 'wifi',
    effectiveType: '4g',
    downlink: 50,
    rtt: 50,
    saveData: false
  }
};

class NetworkSimulator {
  private originalConnection: any = null;
  private simulatedCondition: NetworkCondition | null = null;

  simulate(conditionName: keyof typeof NETWORK_CONDITIONS) {
    if (!this.originalConnection) {
      this.originalConnection = (navigator as any).connection;
    }

    const condition = NETWORK_CONDITIONS[conditionName];
    this.simulatedCondition = condition;

    // Mock the navigator.connection object
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      value: {
        effectiveType: condition.effectiveType,
        downlink: condition.downlink,
        rtt: condition.rtt,
        saveData: condition.saveData,
        type: condition.type,
        addEventListener: () => {},
        removeEventListener: () => {}
      }
    });

    // Mock navigator.onLine for offline simulation
    if (conditionName === 'offline') {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
    } else {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
    }

    console.log(`🔧 Network simulated: ${conditionName}`, condition);
  }

  restore() {
    if (this.originalConnection) {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: this.originalConnection
      });
    }

    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    this.simulatedCondition = null;
    console.log('🔧 Network simulation restored');
  }

  getCurrentCondition(): NetworkCondition | null {
    return this.simulatedCondition;
  }

  isSimulating(): boolean {
    return this.simulatedCondition !== null;
  }
}

export const networkSimulator = new NetworkSimulator();

// Helper function to test strategy selection with different conditions
export const testStrategySelection = (distance: number) => {
  const conditions = Object.keys(NETWORK_CONDITIONS);
  const results: Array<{
    condition: string;
    distance: number;
    strategy: string;
    quality: string;
    reasoning: string;
  }> = [];

  conditions.forEach(conditionName => {
    networkSimulator.simulate(conditionName as keyof typeof NETWORK_CONDITIONS);
    
    // This would need to be imported from the actual hook
    // const { getViewpointStrategy } = useEnhancedStreetViewMulti();
    // const strategy = getViewpointStrategy(distance, conditionName);
    
    // For now, simulate the logic
    const isSlowNetwork = conditionName === 'slow-2g' || conditionName === '2g';
    let strategy, quality, reasoning;
    
    if (!distance) {
      strategy = 'single';
      quality = 'medium';
      reasoning = 'No distance provided';
    } else if (distance < 100) {
      strategy = 'all';
      quality = isSlowNetwork ? 'medium' : 'high';
      reasoning = 'Very close distance, full coverage needed';
    } else if (distance < 500) {
      strategy = 'smart';
      quality = isSlowNetwork ? 'low' : 'medium';
      reasoning = 'Close distance, smart viewpoints optimal';
    } else if (distance < 1000) {
      strategy = 'cardinal';
      quality = isSlowNetwork ? 'low' : 'medium';
      reasoning = 'Moderate distance, cardinal directions sufficient';
    } else {
      strategy = 'single';
      quality = 'medium';
      reasoning = 'Far distance, single view adequate';
    }

    results.push({
      condition: conditionName,
      distance,
      strategy,
      quality,
      reasoning
    });
  });

  networkSimulator.restore();
  return results;
};

// Performance testing utilities
export const performanceTimer = {
  timers: new Map<string, number>(),
  
  start(label: string) {
    this.timers.set(label, performance.now());
    console.log(`⏱️ Timer started: ${label}`);
  },
  
  end(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`⚠️ Timer not found: ${label}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(label);
    console.log(`⏱️ Timer ended: ${label} - ${duration.toFixed(2)}ms`);
    return duration;
  },
  
  measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    return fn().finally(() => this.end(label));
  }
};
