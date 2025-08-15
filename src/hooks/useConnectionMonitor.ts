
import { useEffect, useRef, useState } from 'react';
import { useTourStats } from './useTourStats';
import { useProximityAlerts } from './useProximityAlerts';
import { useToast } from './use-toast';

interface ConnectionHealth {
  isHealthy: boolean;
  issues: string[];
  lastHealthCheck: number;
}

export const useConnectionMonitor = () => {
  const { connectionStatus: tourStatus } = useTourStats();
  const { connectionStatus: proximityStatus } = useProximityAlerts();
  const { toast } = useToast();
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    isHealthy: true,
    issues: [],
    lastHealthCheck: Date.now()
  });
  
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastToastRef = useRef<number>(0);
  const TOAST_COOLDOWN = 30000; // 30 seconds between connection issue toasts

  // Simplified health check function
  const performHealthCheck = () => {
    const now = Date.now();
    const issues: string[] = [];

    // Basic connection checks for tour stats
    if (tourStatus.status === 'disconnected') {
      issues.push('Tour Stats: Disconnected');
    } else if (tourStatus.status === 'connecting') {
      const connectingTime = tourStatus.lastConnectionTime ? now - tourStatus.lastConnectionTime : 0;
      if (connectingTime > 30000) { // 30 seconds
        issues.push('Tour Stats: Connection taking too long');
      }
    }

    // Basic connection checks for proximity alerts
    if (proximityStatus.status === 'disconnected') {
      issues.push('Proximity Alerts: Disconnected');
    } else if (proximityStatus.status === 'connecting') {
      const connectingTime = proximityStatus.lastConnectionTime ? now - proximityStatus.lastConnectionTime : 0;
      if (connectingTime > 30000) { // 30 seconds
        issues.push('Proximity Alerts: Connection taking too long');
      }
    }

    const isHealthy = issues.length === 0;
    
    setConnectionHealth({
      isHealthy,
      issues,
      lastHealthCheck: now
    });

    // Show toast notification for reconnection (with cooldown)
    if (!isHealthy && now - lastToastRef.current > TOAST_COOLDOWN) {
      const criticalIssues = issues.filter(issue => 
        issue.includes('taking too long')
      );
      
      if (criticalIssues.length > 0) {
        toast({
          title: "Reconnecting...",
          description: "Getting you back up to speed",
          variant: "default",
        });
        lastToastRef.current = now;
      }
    }

    
  };

  // Start background monitoring
  useEffect(() => {
    // Initial health check
    performHealthCheck();
    
    // Set up periodic health checks every 60 seconds
    healthCheckIntervalRef.current = setInterval(performHealthCheck, 60000);
    
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, []);

  // Trigger health check when connection status changes
  useEffect(() => {
    performHealthCheck();
  }, [
    tourStatus.status,
    proximityStatus.status
  ]);

  return {
    connectionHealth,
    performHealthCheck
  };
};
