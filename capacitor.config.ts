import type { CapacitorConfig } from "@capacitor/cli";

// Thin-wrapper configuration. The WebView loads the live Next.js app via
// `server.url`; webDir holds only a fallback index.html for offline-start cases.
// When we later ship a static-exported bundle, `server.url` comes out and
// `webDir` points at the Next `out/` directory.
const config: CapacitorConfig = {
  appId: "com.sabindia.tracker",
  appName: "SAB Tracker",
  webDir: "dist-mobile",
  server: {
    url: "https://broadcast-toll-resulting-repeat.trycloudflare.com",
    androidScheme: "https",
    cleartext: false,
    allowNavigation: [
      "*.trycloudflare.com",
      "sab-india-tracker.vercel.app",
    ],
  },
  android: {
    backgroundColor: "#f7f4ee",
  },
  plugins: {
    StatusBar: {
      // Reserve space for the system status bar — do NOT overlay the WebView.
      // Android 15 (API 35) defaults to edge-to-edge; this opts us out so
      // page headers don't fight the clock / notification icons.
      overlaysWebView: false,
      style: "LIGHT",
      backgroundColor: "#d97757",
    },
  },
};

export default config;
