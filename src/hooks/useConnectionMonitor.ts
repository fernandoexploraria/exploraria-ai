
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

  // Health check function
  const performHealthCheck = () => {
    const now = Date.now();
    const issues: string[] = [];
    
    console.log('🏥 Connection Health Check:', { tourStatus, proximityStatus });

    // Check tour stats connection
    if (tourStatus.status === 'failed') {
      issues.push(`Tour Stats: Failed (${tourStatus.consecutiveFailures} consecutive failures)`);
    } else if (tourStatus.status === 'polling') {
      issues.push('Tour Stats: Using polling fallback (real-time unavailable)');
    } else if (tourStatus.status === 'connecting') {
      const connectingTime = tourStatus.lastConnectionTime ? now - tourStatus.lastConnectionTime : 0;
      if (connectingTime > 30000) { // 30 seconds
        issues.push('Tour Stats: Connection taking too long');
      }
    }

    // Check proximity alerts connection
    if (proximityStatus.status === 'failed') {
      issues.push(`Proximity Alerts: Failed (${proximityStatus.consecutiveFailures} consecutive failures)`);
    } else if (proximityStatus.status === 'polling') {
      issues.push('Proximity Alerts: Using polling fallback (real-time unavailable)');
    } else if (proximityStatus.status === 'connecting') {
      const connectingTime = proximityStatus.lastConnectionTime ? now - proximityStatus.lastConnectionTime : 0;
      if (connectingTime > 30000) { // 30 seconds
        issues.push('Proximity Alerts: Connection taking too long');
      }
    }

    // Check for stale data
    const STALE_DATA_THRESHOLD = 300000; // 5 minutes
    if (tourStatus.lastDataUpdate && now - tourStatus.lastDataUpdate > STALE_DATA_THRESHOLD) {
      issues.push('Tour Stats: Data may be stale (no updates for 5+ minutes)');
    }
    if (proximityStatus.lastDataUpdate && now - proximityStatus.lastDataUpdate > STALE_DATA_THRESHOLD) {
      issues.push('Proximity Alerts: Data may be stale (no updates for 5+ minutes)');
    }

    const isHealthy = issues.length === 0;
    
    setConnectionHealth({
      isHealthy,
      issues,
      lastHealthCheck: now
    });

    // Show toast notification for new critical issues (with cooldown)
    if (!isHealthy && now - lastToastRef.current > TOAST_COOLDOWN) {
      const criticalIssues = issues.filter(issue => 
        issue.includes('Failed') || issue.includes('taking too long')
      );
      
      if (criticalIssues.length > 0) {
        console.log('🚨 Connection Health: Critical issues detected', criticalIssues);
        toast({
          title: "Connection Issues Detected",
          description: `${criticalIssues.length} service(s) experiencing problems. Check connection status for details.`,
          variant: "destructive",
        });
        lastToastRef.current = now;
      }
    }

    console.log('🏥 Connection Health Result:', { isHealthy, issues: issues.length });
  };

  // Start background monitoring
  useEffect(() => {
    console.log('🏥 Starting connection health monitoring');
    
    // Initial health check
    performHealthCheck();
    
    // Set up periodic health checks every 60 seconds
    healthCheckIntervalRef.current = setInterval(performHealthCheck, 60000);
    
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      console.log('🏥 Stopped connection health monitoring');
    };
  }, []);

  // Trigger health check when connection status changes
  useEffect(() => {
    performHealthCheck();
  }, [
    tourStatus.status,
    tourStatus.consecutiveFailures,
    proximityStatus.status,
    proximityStatus.consecutiveFailures
  ]);

  return {
    connectionHealth,
    performHealthCheck
  };
};
