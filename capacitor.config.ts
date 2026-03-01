import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig & { version: string } = {
  appId: 'com.giri.levelup',
  appName: 'Level-Up',
  version: '1.6',
  webDir: 'dist/habitTracker/browser',
  plugins: {
    StatusBar: {
      overlaysWebView: false
    }
  }
};

export default config;
