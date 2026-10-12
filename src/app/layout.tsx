import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import { BRAND, themeCssVars } from "@/lib/config";

const display = Inter_Tight({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
  applicationName: BRAND.short,
};

export const viewport: Viewport = {
  themeColor: "#060B1A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable}`}
      style={themeCssVars() as React.CSSProperties}
    >
      <body className="font-sans antialiased min-h-screen">
        {/* One quiet light source at the top; the page itself is flat navy. */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{ background: "radial-gradient(80rem 36rem at 50% -14rem, rgb(var(--accent-rgb) / 0.10), transparent 70%), #060B1A" }}
        />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
