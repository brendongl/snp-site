'use client';

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { usePageView } from "@/lib/hooks/usePageView";
import { useAdminMode } from "@/lib/hooks/useAdminMode";
import { ToastProvider } from "@/lib/context/toast-context";
import { ToastContainer } from "@/components/ui/toast-container";
import { AdminPOSHeader } from "@/components/features/admin/AdminPOSHeader";
import { PersistentStaffHeader } from "@/components/features/staff/PersistentStaffHeader";

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
  const isAdmin = useAdminMode();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          {/* Persistent Staff Header */}
          <PersistentStaffHeader />

          {isAdmin && <AdminPOSHeader />}

          {/* Add padding to compensate for fixed header */}
          <div className="pt-10">
            {children}
          </div>

          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
