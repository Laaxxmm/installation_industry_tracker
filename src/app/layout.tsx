import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAB India Tracker",
  description:
    "Project, inventory and P&L tracking for medical equipment installations.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SAB Tracker" },
};

export const viewport: Viewport = {
  themeColor: "#0B5CAD",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground font-[system-ui] antialiased" suppressHydrationWarning>
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
