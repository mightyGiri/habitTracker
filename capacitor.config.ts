import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.giri.levelup',
  appName: 'Level-Up',
  webDir: 'dist/habitTracker/browser',
  plugins: {
    StatusBar: {
      overlaysWebView: false
    }
  }
};

export default config;
