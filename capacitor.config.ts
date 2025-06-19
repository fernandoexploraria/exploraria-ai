
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.1349ca1f6be14b1d987344f9d88cdaf0',
  appName: 'exploraria-ai',
  webDir: 'dist',
  server: {
    url: 'https://1349ca1f-6be1-4b1d-9873-44f9d88cdaf0.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
