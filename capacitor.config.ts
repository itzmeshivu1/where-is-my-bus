import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ksrtcbus.smart',
  appName: 'KSRTC Smart Bus',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
