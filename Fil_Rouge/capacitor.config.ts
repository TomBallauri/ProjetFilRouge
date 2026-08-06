import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uquail.app',
  appName: 'U-Quail',
  webDir: 'dist',
  server: {
    // DEV ONLY — pointe vers le serveur Vite local via l'alias réseau de l'émulateur Android
    // (10.0.2.2 = localhost de la machine hôte). Remettre 'https://u-quail.com' avant tout
    // build de release.
    url: 'http://10.0.2.2:5173',
    cleartext: true
  }
};

export default config;
