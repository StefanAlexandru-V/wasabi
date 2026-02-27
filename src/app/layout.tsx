import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Repo Rot Detector",
  description: "Rank GitHub repositories by rot risk within an organization",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Repo Rot Detector",
    description: "Find neglected repositories, surface hidden risks, and keep your GitHub organization healthy.",
    type: "website",
    siteName: "Repo Rot Detector",
  },
  twitter: {
    card: "summary_large_image",
    title: "Repo Rot Detector",
    description: "Find neglected repositories, surface hidden risks, and keep your GitHub organization healthy.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="bg-surface-0 text-text-primary min-h-screen font-sans antialiased">
        <ThemeProvider>
          <ToastProvider>
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:outline-none">
              Skip to content
            </a>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
