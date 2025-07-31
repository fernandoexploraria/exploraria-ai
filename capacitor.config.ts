
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.exploraria',
  appName: 'exploraria-ai',
  webDir: 'dist',
  ios: {
    scheme: 'app.lovable.exploraria',
    plist: {
      NSPhotoLibraryUsageDescription: 'This app uses the camera to capture photos of landmarks and places you visit during your tours.',
      NSCameraUsageDescription: 'This app uses the camera to capture photos of landmarks and places you visit during your tours.',
      ITSAppUsesNonExemptEncryption: false,
      CFBundleURLTypes: [
        {
          CFBundleURLName: 'app.lovable.exploraria',
          CFBundleURLSchemes: ['app.lovable.exploraria']
        }
      ]
    }
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
