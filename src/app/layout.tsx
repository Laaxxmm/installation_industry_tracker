import type { Metadata, Viewport } from "next";
import { Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sab-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sab-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SAB India Tracker",
  description:
    "Project, inventory and P&L tracking for fire-safety installations.",
  manifest: "/manifest.webmanifest",
  applicationName: "SAB Tracker",
  appleWebApp: {
    capable: true,
    title: "SAB Tracker",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#d97757",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        {children}
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "rounded-md border border-slate-200 shadow-card",
            },
          }}
        />
      </body>
    </html>
  );
}
