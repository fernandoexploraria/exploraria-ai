
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.exploraria',
  appName: 'exploraria-ai',
  webDir: 'dist',
  server: {
    url: 'https://1349ca1f-6be1-4b1d-9873-44f9d88cdaf0.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  ios: {
    plist: {
      NSPhotoLibraryUsageDescription: 'This app uses the camera to capture photos of landmarks and places you visit during your tours.',
      NSCameraUsageDescription: 'This app uses the camera to capture photos of landmarks and places you visit during your tours.',
      ITSAppUsesNonExemptEncryption: false
    }
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
