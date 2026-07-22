import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.friendsnone.ledger',
  appName: 'Ledger',
  webDir: 'www',
  server: {
    // Opt-in, end-to-end-encrypted GitHub sync is the app's only network call.
    // Nothing else is reachable, and nothing leaves the device unencrypted.
    allowNavigation: ['api.github.com']
  },
  plugins: {
    SystemBars: {
      // The app's own default theme is "system", so start the bars there too and
      // let native.js take over once applyTheme() has resolved. Under Capacitor 8
      // the bars are transparent (edge-to-edge) and --paper shows through, which
      // is what makes the status bar #f4f1ea in the light theme.
      style: 'DEFAULT'
    }
  }
};

export default config;
