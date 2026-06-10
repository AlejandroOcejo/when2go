/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.when2go.app',
  appName: 'when2go',
  webDir: 'dist',
  server: {
    url: 'https://www.when2go.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
}

module.exports = config
