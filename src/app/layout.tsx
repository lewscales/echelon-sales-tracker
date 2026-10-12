import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BRAND, themeCssVars } from "@/lib/config";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
  applicationName: BRAND.short,
};

export const viewport: Viewport = {
  themeColor: "#0C0E12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      style={themeCssVars() as React.CSSProperties}
    >
      <body className="font-sans antialiased min-h-screen">
        {/* Static ambient wash, same as Echelon. */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(70rem 44rem at 15% -12%, rgb(var(--accent-rgb) / 0.10), transparent 60%)," +
              "radial-gradient(60rem 44rem at 100% 0%, rgb(var(--accent-rgb) / 0.06), transparent 55%)," +
              "#0C0E12",
          }}
        />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
