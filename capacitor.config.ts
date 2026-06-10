import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.when2go.app',
  appName: 'when2go',
  webDir: 'dist',
  server: {
    // Points the WebView at the live Vercel deployment.
    // This avoids CORS / SameSite cookie issues during development and testing.
    // Replace with your actual Vercel URL (find it in the Vercel dashboard).
    url: 'https://www.when2go.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
}

export default config
