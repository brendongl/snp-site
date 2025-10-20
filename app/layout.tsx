'use client';

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { usePageView } from "@/lib/hooks/usePageView";
import { ToastProvider } from "@/lib/context/toast-context";
import { ToastContainer } from "@/components/ui/toast-container";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  usePageView();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
