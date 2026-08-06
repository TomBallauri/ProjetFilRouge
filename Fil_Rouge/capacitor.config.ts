import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uquail.app',
  appName: 'U-Quail',
  webDir: 'dist',
  server: {
    url: 'https://u-quail.com',
    cleartext: false
  }
};

export default config;
