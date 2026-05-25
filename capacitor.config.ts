import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.motocarepro.standalone',
  appName: 'Sơn Nam',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
